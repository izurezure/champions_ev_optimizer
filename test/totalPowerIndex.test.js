import test from 'node:test';
import assert from 'node:assert/strict';
import { totalPowerIndex } from '../src/model/totalPowerIndex.js';

test('Z formula matches a hand-checkable fixed value', () => {
  const z = totalPowerIndex({ dOut: 40, v: 1.5, p: 0.75, n: 0.01 });

  assert.equal(Number(z.toFixed(6)), 100);
});
