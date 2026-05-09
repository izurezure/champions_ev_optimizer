import test from 'node:test';
import assert from 'node:assert/strict';
import { megaPlugin } from '../src/mechanics/mega.js';

test('Mega plugin transforms only matching mega stone holders', () => {
  const applicable = { species: 'Garchomp', item: 'Garchompite' };
  const inapplicable = { species: 'Garchomp', item: 'Focus Sash' };

  assert.equal(megaPlugin.isApplicable({}, applicable), true);
  assert.equal(megaPlugin.transformSpecies(applicable).species, 'Garchomp-Mega');
  assert.equal(megaPlugin.isApplicable({}, inapplicable), false);
});
