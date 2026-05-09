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

export function selectMonthsFromIndex(html) {
  return [...new Set([...String(html).matchAll(/href="(\d{4}-\d{2})\/"/g)].map((match) => match[1]))].sort();
}

export function selectLatestMonthFromIndex(html) {
  const months = selectMonthsFromIndex(html);
  if (months.length === 0) throw new Error('No Smogon monthly stats were found in index');
  return months.at(-1);
}

export async function resolveLatestMonth(fetchImpl = fetch) {
  const response = await fetchImpl(`${BASE_URL}/`);
  if (!response.ok) throw new Error(`Smogon index request failed: ${response.status}`);
  return selectLatestMonthFromIndex(await response.text());
}

export async function resolveLatestMonthForFormat({ format, rating, fetchImpl = fetch }) {
  const response = await fetchImpl(`${BASE_URL}/`);
  if (!response.ok) throw new Error(`Smogon index request failed: ${response.status}`);
  const months = selectMonthsFromIndex(await response.text()).reverse();
  if (months.length === 0) throw new Error('No Smogon monthly stats were found in index');

  for (const month of months) {
    if (await chaosFileExists({ month, format, rating, fetchImpl })) return month;
  }
  throw new Error(`No Smogon chaos stats were found for ${format}-${rating}`);
}

export async function loadChaosStats(options = {}) {
  const {
    month = 'latest',
    format = 'gen9championsbssregma',
    smogonFormat = format,
    rating = '1500',
    cacheDir = DEFAULT_CACHE_DIR,
    fetchImpl = fetch
  } = options;

  let resolvedMonth = month;
  const log = [];

  try {
    if (month === 'latest') {
      resolvedMonth = await resolveLatestMonthForFormat({ format: smogonFormat, rating, fetchImpl });
      log.push(`Latest Smogon month for ${smogonFormat}-${rating}: ${resolvedMonth}`);
    }

    const payload = await fetchChaosJson({ month: resolvedMonth, format: smogonFormat, rating, fetchImpl });
    await writeCachedChaos({ cacheDir, month: resolvedMonth, format: smogonFormat, rating, payload });
    log.push(`Downloaded ${smogonFormat}-${rating} ${resolvedMonth}`);
    return { payload, month: resolvedMonth, source: 'network', warning: '', log };
  } catch (error) {
    const cached = await readCachedChaos({ cacheDir, month: resolvedMonth, format: smogonFormat, rating }).catch(async () => {
      if (month === 'latest') return readLatestCachedChaos({ cacheDir, format: smogonFormat, rating });
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
  const jsonPath = buildCachePath({ cacheDir: dir, month, format, rating, gzip: false });
  const gzPath = buildCachePath({ cacheDir: dir, month, format, rating, gzip: true });
  const json = `${JSON.stringify(payload)}\n`;
  await fs.writeFile(jsonPath, json, 'utf8');
  await fs.writeFile(gzPath, zlib.gzipSync(json));
}

export async function readCachedChaos({ cacheDir = DEFAULT_CACHE_DIR, month, format, rating }) {
  const dir = pathFromMaybeUrl(cacheDir);
  const jsonPath = buildCachePath({ cacheDir: dir, month, format, rating, gzip: false });
  const gzPath = buildCachePath({ cacheDir: dir, month, format, rating, gzip: true });
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

export function buildCachePath({ cacheDir, month, format, rating, gzip }) {
  const dir = path.resolve(pathFromMaybeUrl(cacheDir));
  for (const segment of [month, format, rating]) assertSafeCacheSegment(segment);
  const filePath = path.resolve(dir, `${month}-${format}-${rating}.json${gzip ? '.gz' : ''}`);
  const relative = path.relative(dir, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Cache path escapes cache directory: ${filePath}`);
  }
  return filePath;
}

function pathFromMaybeUrl(value) {
  if (value instanceof URL) return fileURLToPath(value);
  return value;
}

async function chaosFileExists({ month, format, rating, fetchImpl }) {
  for (const gzip of [true, false]) {
    const url = buildChaosUrl({ month, format, rating, gzip });
    const response = await fetchImpl(url, { method: 'HEAD' });
    if (response.ok) return true;
    if (response.status === 403 || response.status === 405) {
      const getResponse = await fetchImpl(url);
      if (getResponse.ok) return true;
    }
  }
  return false;
}

function assertSafeCacheSegment(value) {
  const text = String(value ?? '');
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.includes('..') || path.isAbsolute(text)) {
    throw new Error(`Invalid cache path segment: ${text}`);
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
