#!/usr/bin/env node
import fs from 'node:fs/promises';
import { optimizeFromPaste, resultToTableRows } from './model/optimizer.js';

const args = parseArgs(process.argv.slice(2));
const paste = args.pasteFile ? await fs.readFile(args.pasteFile, 'utf8') : await readStdin();

if (!paste.trim()) {
  console.error('Showdown pasteを標準入力、または --file で渡してください。');
  process.exit(1);
}

try {
  const result = await optimizeFromPaste(paste, args);
  if (result.warning) console.error(result.warning);
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
      options.setupBoost = Number.parseInt(next, 10) || 0;
      i += 1;
    }
  }
  return options;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
