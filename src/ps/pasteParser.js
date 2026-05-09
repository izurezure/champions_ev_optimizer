import { STATS, STAT_LABELS } from './dexAdapter.js';
import { emptyStatPoints, evSpreadToStatPoints, normalizeStatPoints, trimToBudget } from './statCalculator.js';

const STAT_ALIASES = {
  hp: 'hp',
  atk: 'atk',
  attack: 'atk',
  def: 'def',
  defense: 'def',
  spa: 'spa',
  spatk: 'spa',
  'sp.atk': 'spa',
  'sp. atk': 'spa',
  spd: 'spd',
  spdef: 'spd',
  'sp.def': 'spd',
  'sp. def': 'spd',
  s: 'spe',
  spe: 'spe',
  speed: 'spe'
};

export function parsePaste(paste) {
  const lines = String(paste || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error('Showdown paste is empty');

  const first = lines[0];
  const [identity, itemPart] = first.split(/\s+@\s+/);
  const species = parseSpecies(identity);
  const set = {
    species,
    item: itemPart?.trim() || '',
    ability: '',
    level: 50,
    nature: '',
    statPoints: emptyStatPoints(),
    statPointInputs: emptyStatPointInputs(),
    moves: [],
    notes: []
  };

  for (const line of lines.slice(1)) {
    if (/^ability:/i.test(line)) {
      set.ability = line.replace(/^ability:\s*/i, '').trim();
      continue;
    }
    if (/^level:/i.test(line)) {
      const level = Number.parseInt(line.replace(/^level:\s*/i, ''), 10);
      if (Number.isFinite(level)) set.level = level;
      continue;
    }
    if (/^(evs|sp|stat points|statpoints):/i.test(line)) {
      const raw = line.replace(/^(evs|sp|stat points|statpoints):\s*/i, '');
      const parsed = parsePointLine(raw);
      const total = STATS.reduce((sum, stat) => sum + parsed.points[stat], 0);
      const max = Math.max(...STATS.map((stat) => parsed.points[stat]));
      if (/^evs:/i.test(line) && (max > 32 || total > 66)) {
        set.statPoints = evSpreadToStatPoints(parsed.points);
        set.notes.push('Classic EV line was converted to Champions Stat Points using HOME transfer rounding.');
      } else {
        set.statPoints = trimToBudget(parsed.points);
      }
      set.statPointInputs = parsed.inputs;
      continue;
    }
    const natureMatch = line.match(/^([A-Za-z]+)\s+Nature$/i);
    if (natureMatch) {
      set.nature = natureMatch[1][0].toUpperCase() + natureMatch[1].slice(1).toLowerCase();
      continue;
    }
    if (line.startsWith('-')) {
      const move = line.replace(/^-\s*/, '').trim();
      if (move) set.moves.push(move);
    }
  }

  if (set.moves.length === 0) throw new Error('At least one move is required');
  return set;
}

function parseSpecies(identity) {
  const value = String(identity || '').trim();
  const paren = value.match(/\(([^)]+)\)\s*(?:\([^)]*\))?$/);
  return (paren ? paren[1] : value.replace(/\s+\([MF]\)$/i, '')).trim();
}

function parsePointLine(raw) {
  const points = emptyStatPoints();
  const inputs = emptyStatPointInputs();
  for (const part of String(raw).split('/')) {
    const match = part.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const value = Number.parseInt(match[1], 10);
    const statKey = normalizeStatName(match[2]);
    if (statKey) {
      points[statKey] = value;
      inputs[statKey] = true;
    }
  }
  return { points: normalizeStatPoints(points), inputs };
}

function emptyStatPointInputs() {
  return Object.fromEntries(STATS.map((stat) => [stat, false]));
}

function normalizeStatName(name) {
  const compact = String(name).trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z.]/g, '');
  if (STAT_ALIASES[compact]) return STAT_ALIASES[compact];
  return STATS.find((stat) => STAT_LABELS[stat].toLowerCase() === compact) || null;
}
