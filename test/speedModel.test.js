import test from 'node:test';
import assert from 'node:assert/strict';
import { speedWin, estimateSpeedWinProbability } from '../src/model/speedModel.js';
import { identifyAttackProfile } from '../src/model/damageEngine.js';
import { speedPriorityForProfile, speedValueCoefficient } from '../src/model/optimizer.js';

test('speedWin handles lower, equal, higher, and priority cases', () => {
  assert.equal(speedWin({ speed: 100, priority: 0 }, { speed: 120, priority: 0 }), 0);
  assert.equal(speedWin({ speed: 100, priority: 0 }, { speed: 100, priority: 0 }), 0.5);
  assert.equal(speedWin({ speed: 121, priority: 0 }, { speed: 120, priority: 0 }), 1);
  assert.equal(speedWin({ speed: 1, priority: 1 }, { speed: 999, priority: 0 }), 1);
});

test('estimateSpeedWinProbability keeps a faster self below certainty with mirror risk', () => {
  const p = estimateSpeedWinProbability({ speed: 200 }, [
    { speed: 100, priority: 0, weight: 1 },
    { speed: 120, priority: 0, weight: 2 }
  ]);

  assert.ok(p < 1);
  assert.equal(Number(p.toFixed(6)), 0.998339);
});

test('estimateSpeedWinProbability returns a tie rate for a same-speed-only sample', () => {
  const p = estimateSpeedWinProbability({ speed: 100 }, [{ speed: 100, priority: 0, weight: 10 }]);

  assert.equal(p, 0.5);
});

test('Protect does not raise attacking speed priority for a special attacker', () => {
  const profile = identifyAttackProfile(['Protect', 'Shadow Ball', 'Sludge Wave', 'Focus Blast']);

  assert.equal(profile.primaryCategory, 'special');
  assert.equal(speedPriorityForProfile(['Protect', 'Shadow Ball', 'Sludge Wave', 'Focus Blast'], profile), 0);
});

test('recovery wall plus status pressure gets a low speed value coefficient', () => {
  const profile = identifyAttackProfile(['Poison Jab', 'Toxic', 'Recover']);

  assert.equal(speedValueCoefficient(profile), 0.2);
});
