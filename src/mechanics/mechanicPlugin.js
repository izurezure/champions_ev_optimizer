export function createMechanicPlugin(plugin) {
  return Object.freeze({
    id: plugin.id,
    displayName: plugin.displayName,
    isApplicable: plugin.isApplicable ?? (() => false),
    transformSpecies: plugin.transformSpecies,
    modifyStats: plugin.modifyStats,
    modifyMove: plugin.modifyMove,
    modifyDamage: plugin.modifyDamage,
    modifySpeedOrder: plugin.modifySpeedOrder,
    explain: plugin.explain
  });
}
