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

export function identifyAttackProfile(moves = []) {
  let physical = 0;
  let special = 0;
  let setup = 0;
  let hazard = 0;
  const damagingMoves = [];

  for (const name of moves) {
    const move = getMove(name);
    if (!move) continue;
    if (move.basePower > 0 && move.category !== 'Status') {
      damagingMoves.push(displayMoveName(name));
      if (move.category === 'Physical') physical += move.basePower;
      if (move.category === 'Special') special += move.basePower;
    } else {
      const id = toId(move.name);
      if (['swordsdance', 'nastyplot', 'dragondance', 'calmmind', 'bulkup', 'quiverdance'].includes(id)) setup += 1;
      if (['stealthrock', 'spikes', 'toxicspikes', 'stickyweb'].includes(id)) hazard += 1;
    }
  }

  let primaryCategory = 'status';
  if (physical || special) primaryCategory = physical >= special ? 'physical' : 'special';
  if (physical && special && Math.min(physical, special) / Math.max(physical, special) > 0.35) primaryCategory = 'mixed';

  return { physical, special, setup, hazard, damagingMoves, primaryCategory };
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
