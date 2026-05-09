import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStats, validateStatPoints } from '../src/ps/statCalculator.js';

test('Stat Point constraints reject per-stat and total overflow', () => {
  assert.equal(validateStatPoints({ hp: 0, atk: 32, def: 0, spa: 0, spd: 2, spe: 32 }).valid, true);
  assert.equal(validateStatPoints({ hp: 0, atk: 33, def: 0, spa: 0, spd: 1, spe: 32 }).valid, false);
  assert.equal(validateStatPoints({ hp: 2, atk: 32, def: 1, spa: 0, spd: 0, spe: 32 }).valid, false);
});

test('Champions stats use Level 50 Stat Point formula', () => {
  const stats = calculateStats('Garchomp', { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }, 'Jolly');

  assert.deepEqual(stats, {
    hp: 185,
    atk: 182,
    def: 115,
    spa: 90,
    spd: 105,
    spe: 169
  });
});
