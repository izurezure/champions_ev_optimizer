#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { validateConfig } from './config/validation.js';
import { optimizeFromPaste, resultToTableRows } from './model/optimizer.js';

const require = createRequire(import.meta.url);
const DEFAULTS = require('./config/defaults.json');
const FORMATS = require('./config/formats.json');
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printUsage();
  process.exit(0);
}

let config;
try {
  config = validateConfig(args, { defaults: DEFAULTS, formats: FORMATS });
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}

const paste = config.pasteFile ? await fs.readFile(config.pasteFile, 'utf8') : await readStdin();

if (!paste.trim()) {
  console.error('Showdown pasteを標準入力、または --file で渡してください。');
  process.exit(1);
}

try {
  const result = await optimizeFromPaste(paste, config);
  if (result.warning) console.error(result.warning);
  console.error(`${result.formatLabel} / ${result.month} / ${result.rating} / ${result.source}`);
  console.table(resultToTableRows(result).slice(0, 20));
  console.log('\nShowdown paste:\n');
  console.log(result.outputPaste);
} catch (error) {
  console.error(error.stack || error.message || error);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--file' || arg === '-f') {
      options.pasteFile = next;
      i += 1;
    } else if (arg === '--month') {
      options.month = next;
      i += 1;
    } else if (arg === '--format') {
      options.format = next;
      i += 1;
    } else if (arg === '--rating') {
      options.rating = next;
      i += 1;
    } else if (arg === '--mega') {
      options.megaPolicy = next;
      i += 1;
    } else if (arg === '--nature') {
      options.naturePolicy = next;
      i += 1;
    } else if (arg === '--setup') {
      options.setupBoost = next;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }
  return options;
}

function printUsage() {
  console.log(`Usage:
  node src/cli.js [options] < set.txt
  node src/cli.js --file set.txt [options]

Options:
  --format  gen9championsbssregma or gen9championsou
  --month   latest or YYYY-MM
  --rating  0, 1500, 1630, or 1760
  --nature  fixed, neutral, or optimize
  --mega    auto, always, or never
  --setup   0, 1, or 2
  --file    input paste file
`);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
