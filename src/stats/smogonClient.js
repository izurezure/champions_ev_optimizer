import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const BASE_URL = 'https://www.smogon.com/stats';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CACHE_DIR = path.join(HERE, 'cache');

export function buildChaosUrl({ month, format, rating, gzip = true }) {
  const suffix = gzip ? '.json.gz' : '.json';
  return `${BASE_URL}/${month}/chaos/${format}-${rating}${suffix}`;
}

export function selectLatestMonthFromIndex(html) {
  const months = [...String(html).matchAll(/href="(\d{4}-\d{2})\/"/g)].map((match) => match[1]);
  if (months.length === 0) throw new Error('No Smogon monthly stats were found in index');
  return months.sort().at(-1);
}

export async function resolveLatestMonth(fetchImpl = fetch) {
  const response = await fetchImpl(`${BASE_URL}/`);
  if (!response.ok) throw new Error(`Smogon index request failed: ${response.status}`);
  return selectLatestMonthFromIndex(await response.text());
}

export async function loadChaosStats(options = {}) {
  const {
    month = 'latest',
    format = 'gen9championsbssregma',
    rating = '1500',
    cacheDir = DEFAULT_CACHE_DIR,
    fetchImpl = fetch
  } = options;

  let resolvedMonth = month;
  const log = [];

  try {
    if (month === 'latest') {
      resolvedMonth = await resolveLatestMonth(fetchImpl);
      log.push(`Latest Smogon month: ${resolvedMonth}`);
    }

    const payload = await fetchChaosJson({ month: resolvedMonth, format, rating, fetchImpl });
    await writeCachedChaos({ cacheDir, month: resolvedMonth, format, rating, payload });
    log.push(`Downloaded ${format}-${rating} ${resolvedMonth}`);
    return { payload, month: resolvedMonth, source: 'network', warning: '', log };
  } catch (error) {
    const cached = await readCachedChaos({ cacheDir, month: resolvedMonth, format, rating }).catch(async () => {
      if (month === 'latest') return readLatestCachedChaos({ cacheDir, format, rating });
      throw error;
    });
    const warning = `警告: 起動時の統計更新に失敗したため、${cached.month} cached data を使用しています。`;
    return { ...cached, source: 'cache', warning, log: [...log, warning, String(error.message || error)] };
  }
}

export async function fetchChaosJson({ month, format, rating, fetchImpl = fetch }) {
  const gzUrl = buildChaosUrl({ month, format, rating, gzip: true });
  const gzResponse = await fetchImpl(gzUrl);
  if (gzResponse.ok) {
    const buffer = Buffer.from(await gzResponse.arrayBuffer());
    return JSON.parse(zlib.gunzipSync(buffer).toString('utf8'));
  }

  const jsonUrl = buildChaosUrl({ month, format, rating, gzip: false });
  const jsonResponse = await fetchImpl(jsonUrl);
  if (!jsonResponse.ok) {
    throw new Error(`Smogon chaos request failed: ${gzResponse.status}/${jsonResponse.status}`);
  }
  return jsonResponse.json();
}

export async function writeCachedChaos({ cacheDir = DEFAULT_CACHE_DIR, month, format, rating, payload }) {
  const dir = pathFromMaybeUrl(cacheDir);
  await fs.mkdir(dir, { recursive: true });
  const jsonPath = cachePath({ cacheDir: dir, month, format, rating, gzip: false });
  const gzPath = cachePath({ cacheDir: dir, month, format, rating, gzip: true });
  const json = `${JSON.stringify(payload)}\n`;
  await fs.writeFile(jsonPath, json, 'utf8');
  await fs.writeFile(gzPath, zlib.gzipSync(json));
}

export async function readCachedChaos({ cacheDir = DEFAULT_CACHE_DIR, month, format, rating }) {
  const dir = pathFromMaybeUrl(cacheDir);
  const jsonPath = cachePath({ cacheDir: dir, month, format, rating, gzip: false });
  const gzPath = cachePath({ cacheDir: dir, month, format, rating, gzip: true });
  let payload;
  try {
    payload = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  } catch {
    const gz = await fs.readFile(gzPath);
    payload = JSON.parse(zlib.gunzipSync(gz).toString('utf8'));
  }
  return {
    payload,
    month,
    warning: `警告: ${month} cached data を使用しています。`,
    log: [`Read ${format}-${rating} ${month} from cache`]
  };
}

async function readLatestCachedChaos({ cacheDir = DEFAULT_CACHE_DIR, format, rating }) {
  const dir = pathFromMaybeUrl(cacheDir);
  const files = await fs.readdir(dir).catch(() => []);
  const pattern = new RegExp(`^(\\d{4}-\\d{2})-${escapeRegExp(format)}-${escapeRegExp(String(rating))}\\.json(?:\\.gz)?$`);
  const months = files.map((file) => file.match(pattern)?.[1]).filter(Boolean).sort();
  if (months.length === 0) throw new Error(`No cached Smogon stats for ${format}-${rating}`);
  return readCachedChaos({ cacheDir: dir, month: months.at(-1), format, rating });
}

function cachePath({ cacheDir, month, format, rating, gzip }) {
  return path.join(pathFromMaybeUrl(cacheDir), `${month}-${format}-${rating}.json${gzip ? '.gz' : ''}`);
}

function pathFromMaybeUrl(value) {
  if (value instanceof URL) return fileURLToPath(value);
  return value;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
