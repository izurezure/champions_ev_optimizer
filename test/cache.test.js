import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readCachedChaos, writeCachedChaos } from '../src/stats/smogonClient.js';

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
