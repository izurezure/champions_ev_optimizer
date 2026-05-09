import { Dex } from '@pkmn/dex';

export const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export const STAT_LABELS = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe'
};

export function toId(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function getSpecies(name) {
  const species = Dex.species.get(name);
  if (!species.exists) {
    throw new Error(`Unknown species: ${name}`);
  }
  return species;
}

export function getMove(name) {
  const move = Dex.moves.get(name);
  if (!move.exists) {
    return null;
  }
  return move;
}

export function displayMoveName(name) {
  const move = getMove(name);
  return move?.name ?? String(name);
}

export function displayItemName(name) {
  const item = Dex.items.get(name);
  return item.exists ? item.name : String(name);
}

export function displayAbilityName(name) {
  const ability = Dex.abilities.get(name);
  return ability.exists ? ability.name : String(name);
}

export function getNature(name = 'Serious') {
  const nature = Dex.natures.get(name || 'Serious');
  return nature.exists ? nature : Dex.natures.get('Serious');
}

export function allNatures() {
  return [...Dex.natures.all()].filter((nature) => nature.exists).map((nature) => nature.name);
}

export function isDamageMove(moveName) {
  const move = getMove(moveName);
  return Boolean(move && move.basePower > 0 && move.category !== 'Status');
}

export function getTypeEffectiveness(moveType, defenderTypes) {
  let multiplier = 1;
  for (const typeName of defenderTypes) {
    const type = Dex.types.get(typeName);
    const taken = type.damageTaken?.[moveType];
    if (taken === 1) multiplier *= 2;
    if (taken === 2) multiplier *= 0.5;
    if (taken === 3) multiplier *= 0;
  }
  return multiplier;
}

export function coerceKnownName(kind, idOrName) {
  if (!idOrName) return '';
  if (kind === 'move') return displayMoveName(idOrName);
  if (kind === 'item') return displayItemName(idOrName);
  if (kind === 'ability') return displayAbilityName(idOrName);
  const species = Dex.species.get(idOrName);
  return species.exists ? species.name : String(idOrName);
}
