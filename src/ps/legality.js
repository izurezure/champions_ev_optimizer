import { validateStatPoints } from './statCalculator.js';

export function assertLegalStatPoints(statPoints) {
  const result = validateStatPoints(statPoints);
  if (!result.valid) {
    throw new Error(result.errors.join('; '));
  }
  return result.statPoints;
}
