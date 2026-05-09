import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChaosUrl, selectLatestMonthFromIndex } from '../src/stats/smogonClient.js';

test('Smogon chaos URL swaps month, format, rating, and gzip preference', () => {
  assert.equal(
    buildChaosUrl({ month: '2026-04', format: 'gen9championsbssregma', rating: '1500', gzip: true }),
    'https://www.smogon.com/stats/2026-04/chaos/gen9championsbssregma-1500.json.gz'
  );
});

test('latest month selection finds newest available month from Smogon index HTML', () => {
  const html = '<a href="2026-03/">2026-03/</a><a href="2026-04/">2026-04/</a>';
  assert.equal(selectLatestMonthFromIndex(html), '2026-04');
});
