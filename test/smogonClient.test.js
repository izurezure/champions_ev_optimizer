import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChaosUrl,
  fetchChaosJson,
  resolveLatestMonthForFormat,
  selectLatestMonthFromIndex
} from '../src/stats/smogonClient.js';

test('Smogon chaos URL swaps month, format, rating, and gzip preference', () => {
  assert.equal(
    buildChaosUrl({ month: '2026-04', format: 'gen9championsbssregma', rating: '1500', gzip: true }),
    'https://www.smogon.com/stats/2026-04/chaos/gen9championsbssregma-1500.json.gz'
  );
});

test('Smogon chaos URL supports Champions OU canonical format', () => {
  assert.equal(
    buildChaosUrl({ month: '2026-04', format: 'gen9championsou', rating: '1500', gzip: true }),
    'https://www.smogon.com/stats/2026-04/chaos/gen9championsou-1500.json.gz'
  );
});

test('latest month selection finds newest available month from Smogon index HTML', () => {
  const html = '<a href="2026-03/">2026-03/</a><a href="2026-04/">2026-04/</a>';
  assert.equal(selectLatestMonthFromIndex(html), '2026-04');
});

test('format-aware latest chooses newest month containing the requested format and rating', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method ?? 'GET' });
    if (url === 'https://www.smogon.com/stats/') {
      return okText('<a href="2026-04/">2026-04/</a><a href="2026-05/">2026-05/</a>');
    }
    if (url.includes('/2026-05/')) return notFound();
    if (url === 'https://www.smogon.com/stats/2026-04/chaos/gen9championsou-1500.json.gz') {
      return okText('');
    }
    return notFound();
  };

  const month = await resolveLatestMonthForFormat({ format: 'gen9championsou', rating: '1500', fetchImpl });

  assert.equal(month, '2026-04');
  assert.ok(calls.some((call) => call.url.includes('/2026-05/chaos/gen9championsou-1500.json.gz')));
  assert.ok(calls.some((call) => call.url.includes('/2026-04/chaos/gen9championsou-1500.json.gz')));
});

test('canonical Champions OU id does not silently fall back to typo id', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('gen9champoinsou')) return okText('{}');
    return notFound();
  };

  await assert.rejects(
    fetchChaosJson({ month: '2026-04', format: 'gen9championsou', rating: '1500', fetchImpl }),
    /Smogon chaos request failed/
  );
  assert.ok(calls.every((url) => !url.includes('gen9champoinsou')));
});

function okText(text) {
  return {
    ok: true,
    status: 200,
    text: async () => text,
    json: async () => JSON.parse(text || '{}'),
    arrayBuffer: async () => Buffer.from(text)
  };
}

function notFound() {
  return {
    ok: false,
    status: 404,
    text: async () => '',
    json: async () => ({}),
    arrayBuffer: async () => Buffer.from('')
  };
}
