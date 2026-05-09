import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsageTable } from '../src/stats/normalize.js';

test('Other exclusion renormalizes remaining percentages to 100', () => {
  const normalized = normalizeUsageTable({ A: 50, B: 30, Other: 20 });

  assert.equal(Object.hasOwn(normalized, 'Other'), false);
  assert.equal(Number((normalized.A + normalized.B).toFixed(8)), 100);
  assert.equal(Number(normalized.A.toFixed(6)), 62.5);
  assert.equal(Number(normalized.B.toFixed(6)), 37.5);
});
