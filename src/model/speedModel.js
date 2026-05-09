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

export function estimateSpeedWinProbability(self, opponents, priority = 0) {
  if (!opponents.length) return 0.5;
  return opponents.reduce((sum, opponent) => {
    return sum + opponent.weight * speedWin({ speed: self.speed, priority }, { speed: opponent.speed, priority: opponent.priority ?? 0 });
  }, 0);
}

function sameName(a, b) {
  return String(a).toLowerCase().replace(/[^a-z0-9]/g, '') === String(b).toLowerCase().replace(/[^a-z0-9]/g, '');
}
