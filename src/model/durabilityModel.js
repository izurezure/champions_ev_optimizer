import { bestIncomingDamage } from './damageEngine.js';

export function estimateDurability(self, opponents) {
  if (!opponents.length) return 1;
  const weighted = opponents.reduce((sum, opponent) => {
    const incoming = bestIncomingDamage(opponent, self, opponent.moves);
    const damage = Math.max(1, incoming.damage);
    let survived = Math.max(0, self.stats.hp / damage - 1);
    if (isFocusSash(self.item)) survived = Math.max(survived, 1);
    return sum + opponent.weight * survived;
  }, 0);
  return Number.isFinite(weighted) ? weighted : 0;
}

export function estimateN(opponents) {
  if (!opponents.length) return 0.01;
  return opponents.reduce((sum, opponent) => sum + opponent.weight * (1 / Math.max(1, opponent.stats.hp)), 0);
}

function isFocusSash(item = '') {
  return String(item).toLowerCase().replace(/[^a-z0-9]/g, '') === 'focussash';
}
