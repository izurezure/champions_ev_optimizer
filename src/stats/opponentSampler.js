import { displayAbilityName, displayItemName, displayMoveName, getSpecies } from '../ps/dexAdapter.js';
import { calculateStats, parseSpread } from '../ps/statCalculator.js';
import { effectiveSpeed } from '../model/speedModel.js';
import { normalizeChaosData, sortedUsageEntries } from './normalize.js';

const DEFAULT_SAMPLER = {
  topSpecies: 80,
  topItemsPerSpecies: 5,
  topAbilitiesPerSpecies: 3,
  topSpreadsPerSpecies: 10,
  topMovesPerSpecies: 12,
  maxSetSamplesPerSpecies: 20,
  maxOpponentSamples: 1500
};

export function buildOpponentSamples(chaosData, options = {}) {
  const config = { ...DEFAULT_SAMPLER, ...options };
  const normalized = normalizeChaosData(chaosData, { excludeOther: options.excludeOther !== false });
  const speciesEntries = Object.entries(normalized.data ?? {})
    .filter(([, record]) => Number.isFinite(Number(record.usage)) && Number(record.usage) > 0)
    .sort((a, b) => Number(b[1].usage) - Number(a[1].usage))
    .slice(0, config.topSpecies);
  const speciesTotal = speciesEntries.reduce((sum, [, record]) => sum + Number(record.usage), 0) || 1;
  const samples = [];

  for (const [speciesName, record] of speciesEntries) {
    const speciesWeight = Number(record.usage) / speciesTotal;
    const abilities = topOrFallback(record.Abilities, config.topAbilitiesPerSpecies, '', displayAbilityName);
    const items = topOrFallback(record.Items, config.topItemsPerSpecies, '', displayItemName);
    const spreads = topOrFallback(record.Spreads, config.topSpreadsPerSpecies, 'Serious:0/0/0/0/0/0', String);
    const moves = sortedUsageEntries(record.Moves, { excludeOther: options.excludeOther !== false })
      .slice(0, config.topMovesPerSpecies)
      .map(([move, usage]) => ({ name: displayMoveName(move), weight: usage / 100 }));

    const combinations = [];
    for (const [spread, spreadPct] of spreads) {
      for (const [item, itemPct] of items) {
        for (const [ability, abilityPct] of abilities) {
          combinations.push({ spread, item, ability, weight: speciesWeight * spreadPct * itemPct * abilityPct });
        }
      }
    }

    combinations.sort((a, b) => b.weight - a.weight);
    for (const combo of combinations.slice(0, config.maxSetSamplesPerSpecies)) {
      const parsedSpread = parseSpread(combo.spread);
      let species;
      try {
        species = getSpecies(speciesName);
      } catch {
        continue;
      }
      const stats = calculateStats(species.name, parsedSpread.statPoints, parsedSpread.nature);
      const item = displayItemName(combo.item);
      const ability = displayAbilityName(combo.ability);
      const speed = effectiveSpeed(stats.spe, { item, ability });
      samples.push({
        species: species.name,
        item,
        ability,
        nature: parsedSpread.nature,
        statPoints: parsedSpread.statPoints,
        stats,
        speed,
        types: species.types,
        moves,
        weight: combo.weight
      });
    }
  }

  samples.sort((a, b) => b.weight - a.weight);
  const capped = samples.slice(0, config.maxOpponentSamples);
  const total = capped.reduce((sum, sample) => sum + sample.weight, 0) || 1;
  return capped.map((sample) => ({ ...sample, weight: sample.weight / total }));
}

function topOrFallback(table, limit, fallback, display) {
  const entries = sortedUsageEntries(table).slice(0, limit).map(([key, pct]) => [display(key), pct / 100]);
  if (entries.length > 0) return entries;
  return [[fallback, 1]];
}
