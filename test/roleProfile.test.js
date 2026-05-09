import test from 'node:test';
import assert from 'node:assert/strict';
import { identifyAttackProfile } from '../src/model/damageEngine.js';

function roleIds(profile) {
  return new Set(profile.roles.map((role) => role.id));
}

test('Toxic plus recovery makes a defensive utility profile even with a weak attack', () => {
  const profile = identifyAttackProfile(['Poison Jab', 'Toxic', 'Recover']);
  const roles = roleIds(profile);

  assert.equal(profile.primaryCategory, 'defensive');
  assert.ok(roles.has('statusPressure'));
  assert.ok(roles.has('recoveryWall'));
});

test('role profile covers Champions OU compendium move families by move, not species', () => {
  const profile = identifyAttackProfile([
    'Stealth Rock',
    'Spikes',
    'Toxic Spikes',
    'Sticky Web',
    'Defog',
    'Rapid Spin',
    'Tidy Up',
    'Healing Wish',
    'Wish',
    'Reflect',
    'Knock Off',
    'Encore',
    'Taunt',
    'Trick',
    'Swords Dance',
    'Nasty Plot',
    'Agility',
    'Iron Defense',
    'Extreme Speed',
    'U-turn',
    'Recover',
    'Toxic'
  ]);
  const roles = roleIds(profile);

  for (const id of [
    'stealthRock',
    'spikes',
    'toxicSpikes',
    'stickyWeb',
    'hazardRemoval',
    'tidyUp',
    'teamHealing',
    'wish',
    'screens',
    'itemDisruption',
    'lockPunish',
    'antiSetup',
    'itemTrick',
    'physicalSetup',
    'specialSetup',
    'speedSetup',
    'defenseSetup',
    'priority',
    'pivot',
    'recoveryWall',
    'statusPressure'
  ]) {
    assert.ok(roles.has(id), `expected ${id}`);
  }
});
