import { displayMoveName, getMove, getSpecies, getTypeEffectiveness, isDamageMove, toId } from '../ps/dexAdapter.js';

const TYPE_BOOST_ITEMS = {
  blackbelt: 'Fighting',
  blackglasses: 'Dark',
  charcoal: 'Fire',
  dragonfang: 'Dragon',
  hardstone: 'Rock',
  magnet: 'Electric',
  metalcoat: 'Steel',
  miracleseed: 'Grass',
  mysticwater: 'Water',
  nevermeltice: 'Ice',
  poisonbarb: 'Poison',
  sharpbeak: 'Flying',
  silkscarf: 'Normal',
  silverpowder: 'Bug',
  softsand: 'Ground',
  spelltag: 'Ghost',
  twistedspoon: 'Psychic'
};

const ROLE_MOVE_GROUPS = [
  { id: 'stealthRock', moves: ['stealthrock'] },
  { id: 'spikes', moves: ['spikes', 'ceaselessedge'] },
  { id: 'toxicSpikes', moves: ['toxicspikes'] },
  { id: 'stickyWeb', moves: ['stickyweb'] },
  { id: 'hazardRemoval', moves: ['defog', 'rapidspin', 'mortalspin'] },
  { id: 'tidyUp', moves: ['tidyup'] },
  { id: 'teamHealing', moves: ['healingwish', 'lunardance'] },
  { id: 'wish', moves: ['wish'] },
  { id: 'screens', moves: ['reflect', 'lightscreen', 'auroraveil'] },
  { id: 'itemDisruption', moves: ['knockoff'] },
  { id: 'lockPunish', moves: ['encore'] },
  { id: 'antiSetup', moves: ['taunt', 'haze', 'clearsmog', 'roar', 'whirlwind', 'dragontail', 'circlethrow'] },
  { id: 'itemTrick', moves: ['trick', 'switcheroo'] },
  { id: 'physicalSetup', moves: ['swordsdance', 'bulkup', 'dragondance', 'bellydrum', 'curse'] },
  { id: 'specialSetup', moves: ['nastyplot', 'calmmind', 'quiverdance'] },
  { id: 'speedSetup', moves: ['agility', 'rockpolish', 'dragondance', 'shellsmash', 'quiverdance', 'shiftgear'] },
  { id: 'defenseSetup', moves: ['irondefense', 'acidarmor', 'shelter', 'cottonguard', 'cosmicpower', 'bulkup', 'curse'] },
  { id: 'pivot', moves: ['uturn', 'voltswitch', 'flipturn', 'chillyreception', 'partingshot'] },
  {
    id: 'recoveryWall',
    moves: [
      'recover',
      'roost',
      'slackoff',
      'softboiled',
      'moonlight',
      'morningsun',
      'synthesis',
      'shoreup',
      'strengthsap',
      'rest',
      'painsplit',
      'milkdrink',
      'healorder'
    ]
  },
  {
    id: 'statusPressure',
    moves: [
      'toxic',
      'willowisp',
      'thunderwave',
      'leechseed',
      'glare',
      'nuzzle',
      'yawn',
      'spore',
      'sleeppowder',
      'stunspore',
      'toxicthread'
    ]
  }
];

const HAZARD_ROLE_IDS = ['stealthRock', 'spikes', 'toxicSpikes', 'stickyWeb'];
const REMOVAL_ROLE_IDS = ['hazardRemoval', 'tidyUp'];
const SETUP_ROLE_IDS = ['physicalSetup', 'specialSetup', 'speedSetup', 'defenseSetup'];

export function identifyAttackProfile(moves = []) {
  let physical = 0;
  let special = 0;
  const damagingMoves = [];
  const roles = new Map();
  const setupMoves = new Set();

  for (const name of moves) {
    const move = getMove(name);
    if (!move) continue;
    const id = toId(move.name);

    if (move.basePower > 0 && move.category !== 'Status') {
      damagingMoves.push(displayMoveName(name));
      if (move.category === 'Physical') physical += move.basePower;
      if (move.category === 'Special') special += move.basePower;
    }

    for (const group of ROLE_MOVE_GROUPS) {
      if (group.moves.includes(id)) {
        addRole(roles, group.id, move.name);
        if (SETUP_ROLE_IDS.includes(group.id)) setupMoves.add(id);
      }
    }
    if (move.priority > 0 && move.category !== 'Status') addRole(roles, 'priority', move.name);
  }

  const roleMoveCount = (id) => roles.get(id)?.size ?? 0;
  const roleSetCount = (ids) => ids.reduce((sum, id) => sum + roleMoveCount(id), 0);
  const hazard = roleSetCount(HAZARD_ROLE_IDS);
  const setup = setupMoves.size;
  const priority = roleMoveCount('priority');
  const utility = {
    hazards: hazard,
    removal: roleSetCount(REMOVAL_ROLE_IDS),
    screens: roleMoveCount('screens'),
    itemDisruption: roleMoveCount('itemDisruption'),
    lockPunish: roleMoveCount('lockPunish'),
    antiSetup: roleMoveCount('antiSetup'),
    itemTrick: roleMoveCount('itemTrick'),
    pivot: roleMoveCount('pivot'),
    teamHealing: roleMoveCount('teamHealing'),
    wish: roleMoveCount('wish')
  };
  const defensive = {
    recovery: roleMoveCount('recoveryWall'),
    statusPressure: roleMoveCount('statusPressure'),
    defenseBoost: roleMoveCount('defenseSetup'),
    antiSetup: utility.antiSetup,
    screens: utility.screens,
    wish: utility.wish
  };
  const offensive = {
    physicalPower: physical,
    specialPower: special,
    priority,
    setup,
    mixed: Boolean(physical && special && Math.min(physical, special) / Math.max(physical, special) > 0.35)
  };
  const scores = scoreRoles({ physical, special, offensive, utility, defensive });
  let primaryCategory = 'status';
  if (physical || special) primaryCategory = physical >= special ? 'physical' : 'special';
  if (offensive.mixed) primaryCategory = 'mixed';
  primaryCategory = refinePrimaryCategory(primaryCategory, scores, Boolean(physical || special));

  return {
    physical,
    special,
    setup,
    hazard,
    damagingMoves,
    primaryCategory,
    roles: [...roles.entries()].map(([id, sourceMoves]) => ({ id, sourceMoves: [...sourceMoves] })),
    offensive,
    utility,
    defensive,
    roleScores: scores
  };
}

function addRole(roles, id, moveName) {
  if (!roles.has(id)) roles.set(id, new Set());
  roles.get(id).add(displayMoveName(moveName));
}

function scoreRoles({ physical, special, offensive, utility, defensive }) {
  const offense = (physical + special) / 80 + offensive.setup * 0.45 + offensive.priority * 0.3;
  const defense =
    defensive.recovery * 2.2 +
    defensive.statusPressure * 1.2 +
    defensive.defenseBoost * 1.1 +
    defensive.antiSetup * 0.6 +
    defensive.screens * 0.5 +
    defensive.wish * 0.9;
  const support =
    utility.hazards * 0.9 +
    utility.removal * 0.9 +
    utility.screens * 0.7 +
    utility.itemDisruption * 0.5 +
    utility.lockPunish * 0.7 +
    utility.antiSetup * 0.7 +
    utility.itemTrick * 0.6 +
    utility.pivot * 0.5 +
    utility.teamHealing * 0.8 +
    utility.wish * 0.8;
  return { offense, defense, utility: support };
}

function refinePrimaryCategory(category, scores, hasDamagingMove) {
  if (scores.defense >= Math.max(2.8, scores.offense * 1.15)) return 'defensive';
  if (!hasDamagingMove && scores.defense > 0) return 'defensive';
  if (!hasDamagingMove && scores.utility > 0) return 'utility';
  if (scores.utility >= Math.max(3.2, scores.offense * 1.5) && scores.defense < 1) return 'utility';
  return category;
}

export function bestOutgoingDamage(attacker, defender, moves, options = {}) {
  let best = { damage: 0, move: '', category: 'Status' };
  for (const moveName of moves) {
    if (!isDamageMove(moveName)) continue;
    const damage = calculateDamage({ attacker, defender, moveName, setupBoost: options.setupBoost ?? 0 });
    if (damage.average > best.damage) {
      best = { damage: damage.average, move: damage.move.name, category: damage.move.category };
    }
  }
  return best;
}

export function bestIncomingDamage(attacker, defender, moves) {
  let best = { damage: 1, move: '', category: 'Physical' };
  for (const move of moves) {
    const moveName = typeof move === 'string' ? move : move.name;
    if (!isDamageMove(moveName)) continue;
    const damage = calculateDamage({ attacker, defender, moveName });
    if (damage.average > best.damage) {
      best = { damage: damage.average, move: damage.move.name, category: damage.move.category };
    }
  }
  return best;
}

export function calculateDamage({ attacker, defender, moveName, setupBoost = 0 }) {
  const move = getMove(moveName);
  if (!move || move.basePower <= 0 || move.category === 'Status') {
    return { average: 0, min: 0, max: 0, move: move ?? { name: moveName, category: 'Status' } };
  }

  const attackStatName = move.category === 'Physical' ? 'atk' : 'spa';
  const defenseStatName = move.category === 'Physical' ? 'def' : 'spd';
  const atk = Math.max(1, Math.floor((attacker.stats[attackStatName] || 1) * stageMultiplier(setupBoost)));
  const def = Math.max(1, defender.stats[defenseStatName] || 1);
  const level = attacker.level ?? 50;
  const base = Math.floor(Math.floor(Math.floor((2 * level) / 5 + 2) * move.basePower * atk / def) / 50) + 2;
  const attackerSpecies = getSpecies(attacker.species);
  const defenderSpecies = getSpecies(defender.species);
  const stab = attackerSpecies.types.includes(move.type) ? (same(attacker.ability, 'Adaptability') ? 2 : 1.5) : 1;
  const effectiveness = getTypeEffectiveness(move.type, defenderSpecies.types);
  const itemMod = itemDamageModifier(attacker.item, move, move.category);
  const abilityMod = abilityDamageModifier(attacker.ability, move);
  const average = Math.floor(base * stab * effectiveness * itemMod * abilityMod * 0.925);
  const max = Math.floor(base * stab * effectiveness * itemMod * abilityMod);
  const min = Math.floor(max * 0.85);

  return {
    average: effectiveness === 0 ? 0 : Math.max(1, average),
    min: effectiveness === 0 ? 0 : Math.max(1, min),
    max: effectiveness === 0 ? 0 : Math.max(1, max),
    move
  };
}

function stageMultiplier(stage) {
  const clamped = Math.max(-6, Math.min(6, Number(stage) || 0));
  return clamped >= 0 ? (2 + clamped) / 2 : 2 / (2 - clamped);
}

function itemDamageModifier(item, move, category) {
  const id = toId(item);
  if (id === 'choiceband' && category === 'Physical') return 1.5;
  if (id === 'choicespecs' && category === 'Special') return 1.5;
  if (id === 'lifeorb') return 1.3;
  if (TYPE_BOOST_ITEMS[id] === move.type) return 1.2;
  return 1;
}

function abilityDamageModifier(ability, move) {
  const id = toId(ability);
  if (id === 'technician' && move.basePower <= 60) return 1.5;
  if (id === 'toughclaws' && move.flags?.contact) return 1.3;
  return 1;
}

function same(a, b) {
  return toId(a) === toId(b);
}
