import test from 'node:test';
import assert from 'node:assert/strict';
import { speedWin } from '../src/model/speedModel.js';

test('speedWin handles lower, equal, higher, and priority cases', () => {
  assert.equal(speedWin({ speed: 100, priority: 0 }, { speed: 120, priority: 0 }), 0);
  assert.equal(speedWin({ speed: 100, priority: 0 }, { speed: 100, priority: 0 }), 0.5);
  assert.equal(speedWin({ speed: 121, priority: 0 }, { speed: 120, priority: 0 }), 1);
  assert.equal(speedWin({ speed: 1, priority: 1 }, { speed: 999, priority: 0 }), 1);
});
