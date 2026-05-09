#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimizeFromPaste } from './model/optimizer.js';
import { loadChaosStats } from './stats/smogonClient.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.join(HERE, 'ui');
const DEFAULTS = JSON.parse(await fs.readFile(path.join(HERE, 'config', 'defaults.json'), 'utf8'));
const FORMATS = JSON.parse(await fs.readFile(path.join(HERE, 'config', 'formats.json'), 'utf8'));
const port = Number(process.env.PORT || 3000);
const host = '127.0.0.1';
const statsCache = new Map();
const startupLog = [];

await primeStats(DEFAULTS).catch((error) => {
  startupLog.push(`Startup stats update failed: ${error.message}`);
});

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === 'GET' && url.pathname === '/api/config') {
      return sendJson(response, { defaults: DEFAULTS, formats: FORMATS, log: startupLog });
    }
    if (request.method === 'POST' && url.pathname === '/api/optimize') {
      const body = await readJson(request);
      const options = {
        ...DEFAULTS,
        ...body,
        statsProvider: async (config) => getStats(config)
      };
      const result = await optimizeFromPaste(body.paste, options);
      return sendJson(response, result);
    }
    if (request.method === 'GET' && url.pathname === '/api/stats') {
      const config = { ...DEFAULTS, ...Object.fromEntries(url.searchParams) };
      return sendJson(response, await getStats(config));
    }
    return serveStatic(response, url.pathname);
  } catch (error) {
    return sendJson(response, { error: error.message || String(error) }, 500);
  }
});

server.listen(port, host, () => {
  console.log(`Champions EV Optimizer running at http://${host}:${port}`);
});

async function primeStats(config) {
  const result = await getStats(config);
  startupLog.push(...(result.log ?? []));
}

async function getStats(config) {
  const key = `${config.month}|${config.format}|${config.rating}`;
  if (!statsCache.has(key)) {
    const result = await loadChaosStats(config);
    statsCache.set(key, result);
  }
  return statsCache.get(key);
}

async function serveStatic(response, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(UI_DIR, safePath));
  if (!filePath.startsWith(UI_DIR)) return sendText(response, 'Not found', 404, 'text/plain');
  const ext = path.extname(filePath);
  const type = ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/html';
  try {
    sendText(response, await fs.readFile(filePath), 200, type);
  } catch {
    sendText(response, 'Not found', 404, 'text/plain');
  }
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function sendJson(response, payload, status = 200) {
  sendText(response, JSON.stringify(payload), status, 'application/json');
}

function sendText(response, payload, status = 200, contentType = 'text/plain') {
  response.writeHead(status, { 'content-type': `${contentType}; charset=utf-8` });
  response.end(payload);
}
