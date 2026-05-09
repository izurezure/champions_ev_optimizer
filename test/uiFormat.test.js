import test from 'node:test';
import assert from 'node:assert/strict';
import { ratingStateForFormat } from '../src/ui/formatOptions.js';

const formats = [
  { id: 'bss', label: 'BSS', ratings: ['0', '1500'] },
  { id: 'ou', label: 'OU', ratings: ['1500', '1630', '1760'] },
  { id: 'custom', label: 'Custom', ratings: ['1000', '1200'] }
];

test('rating options are derived from defaults.format instead of formats[0]', () => {
  assert.deepEqual(ratingStateForFormat({ formats, formatId: 'ou', currentRating: '1630' }), {
    ratings: ['1500', '1630', '1760'],
    selectedRating: '1630'
  });
});

test('rating is preserved on format change when the new format supports it', () => {
  assert.deepEqual(ratingStateForFormat({ formats, formatId: 'ou', currentRating: '1500' }), {
    ratings: ['1500', '1630', '1760'],
    selectedRating: '1500'
  });
});

test('rating falls back to 1500 or first available option when unsupported', () => {
  assert.equal(ratingStateForFormat({ formats, formatId: 'ou', currentRating: '0' }).selectedRating, '1500');
  assert.equal(ratingStateForFormat({ formats, formatId: 'custom', currentRating: '1500' }).selectedRating, '1000');
});
