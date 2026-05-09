import { Dex } from '@pkmn/dex';
import { createMechanicPlugin } from './mechanicPlugin.js';

export const megaPlugin = createMechanicPlugin({
  id: 'mega',
  displayName: 'Mega Evolution',
  isApplicable(_ctx, set) {
    const item = Dex.items.get(set.item);
    return Boolean(item.exists && item.megaStone && item.megaStone[set.species]);
  },
  transformSpecies(set) {
    const item = Dex.items.get(set.item);
    if (!item.exists || !item.megaStone?.[set.species]) return { ...set };
    return { ...set, species: item.megaStone[set.species], megaAssumption: true };
  },
  explain(result) {
    if (!result.megaAssumption) return [];
    return [
      `この評価は ${result.input.species} がメガシンカ権を使用する前提です。`,
      'チーム内に別のメガ枠がいる場合は MegaPolicy=never でも再計算してください。'
    ];
  }
});
