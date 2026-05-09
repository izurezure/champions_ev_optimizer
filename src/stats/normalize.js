import { toId } from '../ps/dexAdapter.js';

export function normalizeUsageTable(table = {}, { excludeOther = true } = {}) {
  const entries = Object.entries(table)
    .filter(([key, value]) => Number.isFinite(Number(value)) && Number(value) > 0)
    .filter(([key]) => !(excludeOther && toId(key) === 'other'));

  const total = entries.reduce((sum, [, value]) => sum + Number(value), 0);
  if (total <= 0) return {};

  return Object.fromEntries(entries.map(([key, value]) => [key, (Number(value) / total) * 100]));
}

export function sortedUsageEntries(table = {}, options = {}) {
  return Object.entries(normalizeUsageTable(table, options)).sort((a, b) => b[1] - a[1]);
}

export function normalizeChaosData(chaosData, { excludeOther = true } = {}) {
  const data = {};
  for (const [species, record] of Object.entries(chaosData?.data ?? {})) {
    data[species] = {
      ...record,
      Abilities: normalizeUsageTable(record.Abilities, { excludeOther }),
      Items: normalizeUsageTable(record.Items, { excludeOther }),
      Spreads: normalizeUsageTable(record.Spreads, { excludeOther }),
      Moves: normalizeUsageTable(record.Moves, { excludeOther })
    };
  }
  return { ...chaosData, data };
}
