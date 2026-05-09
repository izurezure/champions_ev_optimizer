import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePaste } from '../src/ps/pasteParser.js';

test('paste parser extracts species, item, ability, level, and moves', () => {
  const set = parsePaste(`Garchomp @ Focus Sash
Ability: Rough Skin
Level: 50
- Swords Dance
- Earthquake
- Rock Tomb
- Stealth Rock`);

  assert.equal(set.species, 'Garchomp');
  assert.equal(set.item, 'Focus Sash');
  assert.equal(set.ability, 'Rough Skin');
  assert.equal(set.level, 50);
  assert.deepEqual(set.moves, ['Swords Dance', 'Earthquake', 'Rock Tomb', 'Stealth Rock']);
});

test('paste parser reads Champions Stat Points from EVs line', () => {
  const set = parsePaste(`Garchomp @ Focus Sash
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Earthquake`);

  assert.deepEqual(set.statPoints, { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 });
  assert.deepEqual(set.statPointInputs, { hp: true, atk: true, def: false, spa: false, spd: false, spe: true });
  assert.equal(set.nature, 'Jolly');
});

test('paste parser tracks whether Spe was explicitly entered', () => {
  const withSpeed = parsePaste(`Garchomp @ Focus Sash
EVs: 15 S
- Earthquake`);
  const withoutSpeed = parsePaste(`Garchomp @ Focus Sash
EVs: 15 Atk
- Earthquake`);

  assert.equal(withSpeed.statPoints.spe, 15);
  assert.equal(withSpeed.statPointInputs.spe, true);
  assert.equal(withoutSpeed.statPoints.spe, 0);
  assert.equal(withoutSpeed.statPointInputs.spe, false);
});
