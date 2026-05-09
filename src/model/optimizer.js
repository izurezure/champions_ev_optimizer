import { allNatures, displayAbilityName, displayItemName, getMove, getSpecies, STAT_LABELS, STATS } from '../ps/dexAdapter.js';
import { parsePaste } from '../ps/pasteParser.js';
import { calculateStats, formatStatPoints, makeStatCalculator, sumStatPoints } from '../ps/statCalculator.js';
import { buildOpponentSamples } from '../stats/opponentSampler.js';
import { loadChaosStats } from '../stats/smogonClient.js';
import { megaPlugin } from '../mechanics/mega.js';
import { bestOutgoingDamage, identifyAttackProfile } from './damageEngine.js';
import { estimateDurability, estimateN } from './durabilityModel.js';
import { effectiveSpeed, estimateSpeedWinProbability } from './speedModel.js';
import { totalPowerIndex } from './totalPowerIndex.js';

const DEFAULTS = {
  format: 'gen9championsbssregma',
  month: 'latest',
  rating: '1500',
  megaPolicy: 'auto',
  naturePolicy: 'fixed',
  excludeOther: true,
  setupBoost: 0,
  coarseTopK: 300,
  finalTopK: 20,
  sampler: {
    topSpecies: 80,
    topItemsPerSpecies: 5,
    topAbilitiesPerSpecies: 3,
    topSpreadsPerSpecies: 10,
    topMovesPerSpecies: 12,
    maxSetSamplesPerSpecies: 20,
    maxOpponentSamples: 1500
  }
};

export async function optimizeFromPaste(paste, options = {}) {
  const config = mergeConfig(DEFAULTS, options);
  const parsed = parsePaste(paste);
  const statsResult = await getStatsPayload(config);
  const chaosData = statsResult.payload ?? statsResult;
  const input = {
    ...parsed,
    item: displayItemName(parsed.item),
    ability: parsed.ability ? displayAbilityName(parsed.ability) : inferAbility(parsed.species, chaosData)
  };
  const opponents = config.opponents ?? buildOpponentSamples(chaosData, { ...config.sampler, excludeOther: config.excludeOther });
  if (!opponents.length) throw new Error('No opponent samples could be built from Smogon stats');

  const attackProfile = identifyAttackProfile(input.moves);
  const variants = buildMegaVariants(input, config.megaPolicy);
  const evaluated = variants.map((variant) => evaluateVariant(variant, opponents, attackProfile, config));
  evaluated.sort((a, b) => (b.results[0]?.z ?? 0) - (a.results[0]?.z ?? 0));
  const best = evaluated[0];
  const results = best.results.slice(0, config.finalTopK).map((row, index) => ({ ...row, rank: index + 1 }));
  const explanations = buildExplanations({ input, attackProfile, result: best, statsResult, config });

  return {
    input,
    format: config.format,
    month: statsResult.month ?? config.month,
    rating: config.rating,
    source: statsResult.source ?? (config.statsProvider ? 'provided' : 'network'),
    warning: statsResult.warning ?? '',
    attackProfile,
    opponents: opponents.length,
    megaAssumption: best.megaAssumption,
    results,
    explanations,
    outputPaste: renderPaste(input, results[0]),
    statsLog: statsResult.log ?? []
  };
}

function evaluateVariant(set, opponents, attackProfile, config) {
  const natures = natureCandidates(set, config.naturePolicy);
  const n = estimateN(opponents);
  const coarse = [];
  const coarseLimit = Math.max(config.coarseTopK * 4, config.coarseTopK);
  const estimateCoarseP = makeSpeedEstimator(opponents);
  const priority = maxMovePriority(set.moves);

  for (const nature of natures) {
    const calculateCandidateStats = makeStatCalculator(set.species, nature);
    for (const statPoints of legalAllocations(attackProfile)) {
      const stats = calculateCandidateStats(statPoints);
      const self = makeSelf(set, stats);
      const p = priority > 0 ? estimateSpeedWinProbability(self, opponents, priority) : estimateCoarseP(self.speed);
      const dOut = coarseDamage(stats, attackProfile, set, config.setupBoost);
      const v = coarseDurability(stats, attackProfile, set);
      const z = totalPowerIndex({ dOut, v, p, n });
      coarse.push({ statPoints, nature, stats, p, dOut, v, z });
      if (coarse.length > coarseLimit * 2) {
        coarse.sort((a, b) => b.z - a.z);
        coarse.length = coarseLimit;
      }
    }
  }

  coarse.sort((a, b) => b.z - a.z);
  const fine = coarse.slice(0, config.coarseTopK).map((candidate) => {
    const self = makeSelf(set, candidate.stats);
    const p = estimateSpeedWinProbability(self, opponents, maxMovePriority(set.moves));
    const dOut = opponents.reduce((sum, opponent) => {
      return sum + opponent.weight * bestOutgoingDamage(self, opponent, set.moves, { setupBoost: config.setupBoost }).damage;
    }, 0);
    const v = estimateDurability(self, opponents) + attackProfile.setup * 0.15 + attackProfile.hazard * 0.1;
    const offensiveStat = dominantOffensiveStat(candidate.stats, attackProfile);
    const z = totalPowerIndex({ dOut, v, p, n });
    return {
      ...candidate,
      statPointTotal: sumStatPoints(candidate.statPoints),
      p,
      v,
      dOut,
      m: dOut / Math.max(1, offensiveStat),
      n,
      z,
      explanation: explainCandidate(candidate, attackProfile, set)
    };
  });

  fine.sort((a, b) => b.z - a.z);
  return { set, megaAssumption: set.megaAssumption === true, results: fine };
}

function makeSelf(set, stats) {
  return {
    species: set.species,
    item: set.item,
    ability: set.ability,
    level: set.level ?? 50,
    stats,
    speed: effectiveSpeed(stats.spe, { item: set.item, ability: set.ability })
  };
}

function natureCandidates(set, policy) {
  if (policy === 'neutral') return ['Serious'];
  if (policy === 'fixed' && set.nature) return [set.nature];
  if (policy === 'fixed' && !set.nature) return allNatures();
  if (policy === 'optimize') return allNatures();
  return [set.nature || 'Serious'];
}

function legalAllocations(profile) {
  if (profile.primaryCategory === 'physical') return legalAllocationIterator(['hp', 'atk', 'def', 'spd', 'spe']);
  if (profile.primaryCategory === 'special') return legalAllocationIterator(['hp', 'def', 'spa', 'spd', 'spe']);
  if (profile.primaryCategory === 'status') return legalAllocationIterator(['hp', 'def', 'spd', 'spe']);
  return mixedAllocationIterator();
}

function* legalAllocationIterator(activeStats) {
  const points = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  yield* allocate(activeStats, 0, 66, points);
}

function* allocate(activeStats, index, remaining, points) {
  if (index === activeStats.length - 1) {
    if (remaining >= 0 && remaining <= 32) {
      points[activeStats[index]] = remaining;
      yield { ...points };
      points[activeStats[index]] = 0;
    }
    return;
  }

  const stat = activeStats[index];
  const max = Math.min(32, remaining);
  for (let value = 0; value <= max; value += 1) {
    points[stat] = value;
    yield* allocate(activeStats, index + 1, remaining - value, points);
  }
  points[stat] = 0;
}

function* mixedAllocationIterator() {
  const offenseGrid = [0, 8, 16, 24, 32];
  for (const atk of offenseGrid) {
    for (const spa of offenseGrid) {
      const remaining = 66 - atk - spa;
      if (remaining < 0) continue;
      const points = { hp: 0, atk, def: 0, spa, spd: 0, spe: 0 };
      yield* allocate(['hp', 'def', 'spd', 'spe'], 0, remaining, points);
    }
  }
}

function coarseDamage(stats, profile, set, setupBoost) {
  const totalPower = Math.max(40, profile.physical + profile.special);
  const setupPhysical = setupBoost > 0 && set.moves.some((move) => /swords dance|dragon dance|bulk up/i.test(move)) ? 2 : 1;
  const setupSpecial = setupBoost > 0 && set.moves.some((move) => /nasty plot|calm mind|quiver dance/i.test(move)) ? 2 : 1;
  if (profile.primaryCategory === 'physical') return stats.atk * setupPhysical * totalPower / 260;
  if (profile.primaryCategory === 'special') return stats.spa * setupSpecial * totalPower / 260;
  if (profile.primaryCategory === 'mixed') return (stats.atk * setupPhysical * profile.physical + stats.spa * setupSpecial * profile.special) / 260;
  return Math.max(stats.atk, stats.spa) * 0.2;
}

function coarseDurability(stats, profile, set) {
  let value = stats.hp * (stats.def + stats.spd) / 26000;
  value += profile.setup * 0.12 + profile.hazard * 0.1;
  if (/focus sash/i.test(set.item)) value = Math.max(value, 1);
  return value;
}

function dominantOffensiveStat(stats, profile) {
  if (profile.primaryCategory === 'special') return stats.spa;
  if (profile.primaryCategory === 'mixed') return Math.max(stats.atk, stats.spa);
  return stats.atk;
}

function maxMovePriority(moves) {
  return moves.reduce((best, moveName) => {
    const move = getMove(moveName);
    return Math.max(best, move?.priority ?? 0);
  }, 0);
}

function makeSpeedEstimator(opponents) {
  const buckets = new Map();
  for (const opponent of opponents) {
    buckets.set(opponent.speed, (buckets.get(opponent.speed) ?? 0) + opponent.weight);
  }
  const speeds = [...buckets.keys()].sort((a, b) => a - b);
  const prefix = [];
  let running = 0;
  for (const speed of speeds) {
    prefix.push(running);
    running += buckets.get(speed);
  }
  return (speed) => {
    const lessIndex = lowerBound(speeds, speed);
    const less = lessIndex <= 0 ? 0 : lessIndex >= speeds.length ? running : prefix[lessIndex];
    const equal = buckets.get(speed) ?? 0;
    return less + equal * 0.5;
  };
}

function lowerBound(values, target) {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (values[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}


function inferAbility(species, chaosData) {
  const record = chaosData?.data?.[species];
  const best = Object.entries(record?.Abilities ?? {}).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0];
  return best ? displayAbilityName(best) : '';
}

function buildMegaVariants(input, megaPolicy) {
  if (megaPolicy === 'never') return [{ ...input, megaAssumption: false }];
  const applicable = megaPlugin.isApplicable({}, input);
  if (megaPolicy === 'always') return [applicable ? megaPlugin.transformSpecies(input) : { ...input, megaAssumption: false }];
  if (megaPolicy === 'auto' && applicable) return [{ ...input, megaAssumption: false }, megaPlugin.transformSpecies(input)];
  return [{ ...input, megaAssumption: false }];
}

async function getStatsPayload(config) {
  if (config.statsProvider) return config.statsProvider(config);
  if (config.chaosData) return { payload: config.chaosData, source: 'provided', log: [] };
  return loadChaosStats(config);
}

function renderPaste(input, result) {
  if (!result) return '';
  const lines = [`${input.species}${input.item ? ` @ ${input.item}` : ''}`];
  if (input.ability) lines.push(`Ability: ${input.ability}`);
  if (input.level && input.level !== 50) lines.push(`Level: ${input.level}`);
  lines.push(`EVs: ${formatStatPoints(result.statPoints)}`);
  lines.push(`${result.nature} Nature`);
  for (const move of input.moves) lines.push(`- ${move}`);
  return lines.join('\n');
}

function explainCandidate(candidate, profile, set) {
  const priorities = [];
  if (profile.primaryCategory === 'physical') priorities.push('physical damage');
  if (profile.primaryCategory === 'special') priorities.push('special damage');
  if (profile.primaryCategory === 'mixed') priorities.push('mixed damage');
  if (candidate.statPoints.spe >= 24) priorities.push('speed control');
  if (candidate.statPoints.hp + candidate.statPoints.def + candidate.statPoints.spd >= 18) priorities.push('bulk');
  if (/focus sash/i.test(set.item)) priorities.push('Focus Sash action floor');
  return priorities.join(', ');
}

function buildExplanations({ input, attackProfile, result, statsResult }) {
  const explanations = [];
  explanations.push(`Attack profile: ${attackProfile.primaryCategory}`);
  if (attackProfile.setup) explanations.push('Setup moves slightly increase durability/action value in the MVP model.');
  if (attackProfile.hazard) explanations.push('Hazard moves add a small utility value through longer-game pressure.');
  if (/focus sash/i.test(input.item)) explanations.push('Focus Sash is reflected as a minimum one-action durability floor.');
  explanations.push(...megaPlugin.explain({ input, megaAssumption: result.megaAssumption }));
  if (statsResult.warning) explanations.push(statsResult.warning);
  return explanations;
}

function mergeConfig(defaults, options) {
  return {
    ...defaults,
    ...options,
    sampler: { ...defaults.sampler, ...(options.sampler ?? {}) }
  };
}

export function resultToTableRows(result) {
  return result.results.map((row) => ({
    rank: row.rank,
    statPoints: STATS.map((stat) => `${STAT_LABELS[stat]} ${row.statPoints[stat]}`).join(' / '),
    nature: row.nature,
    stats: STATS.map((stat) => `${STAT_LABELS[stat]} ${row.stats[stat]}`).join(' / '),
    Z: row.z,
    P: row.p,
    V: row.v,
    D_out: row.dOut,
    m: row.m,
    n: row.n,
    explanation: row.explanation
  }));
}
