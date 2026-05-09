import { STATS, getNature, getSpecies } from './dexAdapter.js';

const ZERO_POINTS = Object.freeze({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

export function emptyStatPoints() {
  return { ...ZERO_POINTS };
}

export function normalizeStatPoints(points = {}) {
  const normalized = emptyStatPoints();
  for (const stat of STATS) {
    const value = Number(points[stat] ?? 0);
    normalized[stat] = Number.isFinite(value) ? Math.trunc(value) : 0;
  }
  return normalized;
}

export function validateStatPoints(points = {}) {
  const normalized = normalizeStatPoints(points);
  const errors = [];
  let total = 0;

  for (const stat of STATS) {
    const value = normalized[stat];
    total += value;
    if (!Number.isInteger(value)) errors.push(`${stat} must be an integer`);
    if (value < 0 || value > 32) errors.push(`${stat} must be between 0 and 32`);
  }

  if (total > 66) errors.push('total Stat Points must be 66 or less');
  return { valid: errors.length === 0, errors, total, statPoints: normalized };
}

export function evToStatPoint(evs) {
  const value = Math.max(0, Math.trunc(Number(evs) || 0));
  if (value < 4) return 0;
  return Math.min(32, 1 + Math.floor((value - 4) / 8));
}

export function evSpreadToStatPoints(evsByStat) {
  const converted = emptyStatPoints();
  for (const stat of STATS) converted[stat] = evToStatPoint(evsByStat[stat] ?? 0);
  return trimToBudget(converted);
}

export function trimToBudget(points, maxTotal = 66) {
  const statPoints = normalizeStatPoints(points);
  while (sumStatPoints(statPoints) > maxTotal) {
    const stat = [...STATS].sort((a, b) => statPoints[b] - statPoints[a])[0];
    statPoints[stat] -= 1;
  }
  return statPoints;
}

export function sumStatPoints(points = {}) {
  return STATS.reduce((sum, stat) => sum + (Number(points[stat]) || 0), 0);
}

export function calculateStats(speciesName, points = {}, natureName = 'Serious') {
  const species = getSpecies(speciesName);
  return makeStatCalculator(species.name, natureName)(points);
}

export function makeStatCalculator(speciesName, natureName = 'Serious') {
  const species = getSpecies(speciesName);
  const nature = getNature(natureName);
  const alignments = {};
  for (const stat of STATS) {
    alignments[stat] = nature.plus === stat ? 1.1 : nature.minus === stat ? 0.9 : 1;
  }
  return (points = {}) => {
    const statPoints = normalizeStatPoints(points);
    const stats = {};

    stats.hp = species.baseStats.hp + statPoints.hp + 75;
    for (const stat of STATS.filter((name) => name !== 'hp')) {
      stats[stat] = Math.floor((species.baseStats[stat] + statPoints[stat] + 20) * alignments[stat]);
    }

    return stats;
  };
}

export function parseSpread(spread = '') {
  const [nature = 'Serious', rawValues = '0/0/0/0/0/0'] = String(spread).split(':');
  const values = rawValues.split('/').map((value) => Number.parseInt(value, 10));
  const statPoints = emptyStatPoints();
  STATS.forEach((stat, index) => {
    statPoints[stat] = Number.isFinite(values[index]) ? values[index] : 0;
  });
  return { nature, statPoints: trimToBudget(statPoints) };
}

export function formatStatPoints(points = {}) {
  const statPoints = normalizeStatPoints(points);
  const labels = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
  const parts = STATS.filter((stat) => statPoints[stat] > 0).map((stat) => `${statPoints[stat]} ${labels[stat]}`);
  return parts.length ? parts.join(' / ') : '0 HP';
}
