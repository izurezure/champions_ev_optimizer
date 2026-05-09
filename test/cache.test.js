import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildCachePath, readCachedChaos, writeCachedChaos } from '../src/stats/smogonClient.js';

test('cache can be read back with warning context when network update fails', async (t) => {
  const cacheDir = new URL('./tmp-cache/', import.meta.url);
  t.after(async () => {
    await fs.rm(cacheDir, { recursive: true, force: true });
  });
  const payload = { info: { format: 'test' }, data: { Garchomp: { usage: 100 } } };

  await writeCachedChaos({ cacheDir, month: '2026-04', format: 'gen9championsbssregma', rating: '1500', payload });
  const cached = await readCachedChaos({ cacheDir, month: '2026-04', format: 'gen9championsbssregma', rating: '1500' });

  assert.deepEqual(cached.payload, payload);
  assert.match(cached.warning, /cached data/);
});

test('BSS and OU cache files are separated by canonical format id', async (t) => {
  const cacheDir = new URL('./tmp-cache-separated/', import.meta.url);
  t.after(async () => {
    await fs.rm(cacheDir, { recursive: true, force: true });
  });

  const bssPayload = { info: { format: 'gen9championsbssregma' }, data: { Garchomp: { usage: 100 } } };
  const ouPayload = { info: { format: 'gen9championsou' }, data: { GreatTusk: { usage: 100 } } };

  await writeCachedChaos({ cacheDir, month: '2026-04', format: 'gen9championsbssregma', rating: '1500', payload: bssPayload });
  await writeCachedChaos({ cacheDir, month: '2026-04', format: 'gen9championsou', rating: '1500', payload: ouPayload });

  assert.deepEqual(
    (await readCachedChaos({ cacheDir, month: '2026-04', format: 'gen9championsbssregma', rating: '1500' })).payload,
    bssPayload
  );
  assert.deepEqual(
    (await readCachedChaos({ cacheDir, month: '2026-04', format: 'gen9championsou', rating: '1500' })).payload,
    ouPayload
  );

  const files = await fs.readdir(cacheDir);
  assert.ok(files.includes('2026-04-gen9championsbssregma-1500.json'));
  assert.ok(files.includes('2026-04-gen9championsou-1500.json'));
});

test('cache path rejects unvalidated path separator values', () => {
  assert.throws(
    () => buildCachePath({ cacheDir: new URL('./tmp-cache-invalid/', import.meta.url), month: '../2026-04', format: 'gen9championsou', rating: '1500', gzip: false }),
    /Invalid cache path segment/
  );
  assert.throws(
    () => buildCachePath({ cacheDir: new URL('./tmp-cache-invalid/', import.meta.url), month: '2026-04', format: 'gen9championsou/evil', rating: '1500', gzip: false }),
    /Invalid cache path segment/
  );
});
