export const SPEED_MIRROR_WEIGHT = 0.01;

export function speedWin(self, opp) {
  const selfPriority = self.priority ?? 0;
  const oppPriority = opp.priority ?? 0;
  if (selfPriority > oppPriority) return 1;
  if (selfPriority < oppPriority) return 0;
  if (self.speed > opp.speed) return 1;
  if (self.speed < opp.speed) return 0;
  return 0.5;
}

export function effectiveSpeed(speed, { item = '', ability = '', weatherSpeedAbilities = false } = {}) {
  let value = Number(speed) || 0;
  if (sameName(item, 'Choice Scarf')) value *= 1.5;
  if (sameName(ability, 'Unburden')) value *= 2;
  if (weatherSpeedAbilities && ['Swift Swim', 'Chlorophyll', 'Sand Rush', 'Slush Rush'].some((name) => sameName(ability, name))) {
    value *= 2;
  }
  return Math.floor(value);
}

export function estimateSpeedWinProbability(self, opponents, priority = self.priority ?? 0) {
  const selfPriority = priority ?? 0;
  let winWeight = SPEED_MIRROR_WEIGHT * 0.5;
  let totalWeight = SPEED_MIRROR_WEIGHT;

  for (const opponent of opponents) {
    const weight = Number(opponent.weight);
    if (!Number.isFinite(weight) || weight <= 0) continue;
    winWeight += weight * speedWin({ speed: self.speed, priority: selfPriority }, { speed: opponent.speed, priority: opponent.priority ?? 0 });
    totalWeight += weight;
  }

  return totalWeight > 0 ? winWeight / totalWeight : 0.5;
}

function sameName(a, b) {
  return String(a).toLowerCase().replace(/[^a-z0-9]/g, '') === String(b).toLowerCase().replace(/[^a-z0-9]/g, '');
}
