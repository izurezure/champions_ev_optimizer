import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeFromPaste } from '../src/model/optimizer.js';

test('Garchomp regression returns legal Champions spreads and favors physical speed investment', async () => {
  const result = await optimizeFromPaste(`Garchomp @ Focus Sash
Ability: Rough Skin
Level: 50
- Swords Dance
- Earthquake
- Rock Tomb
- Stealth Rock`, {
    naturePolicy: 'optimize',
    megaPolicy: 'never',
    statsProvider: async () => ({
      info: { format: 'gen9championsbssregma', month: 'fixture' },
      data: {
        'Flutter Mane': {
          usage: 45,
          Abilities: { 'Protosynthesis': 100 },
          Items: { 'Booster Energy': 70, Other: 30 },
          Spreads: { 'Timid:0/0/0/32/0/32': 70, Other: 30 },
          Moves: { 'Moonblast': 80, 'Shadow Ball': 70, Other: 10 }
        },
        'Dragonite': {
          usage: 55,
          Abilities: { Multiscale: 100 },
          Items: { 'Choice Band': 40, Other: 60 },
          Spreads: { 'Jolly:0/32/0/0/2/32': 80, Other: 20 },
          Moves: { 'Extreme Speed': 80, Earthquake: 50, Other: 10 }
        }
      }
    })
  });

  assert.equal(result.input.species, 'Garchomp');
  assert.equal(result.attackProfile.primaryCategory, 'physical');
  assert.equal(result.results.length, 20);
  assert.ok(result.results.every((row) => row.statPointTotal <= 66));
  assert.ok(result.results.every((row) => row.statPoints.atk >= row.statPoints.spa));
  assert.ok(result.results[0].statPoints.atk >= 24);
  assert.ok(result.results[0].statPoints.spe >= 24);
  assert.match(result.outputPaste, /EVs: .*Atk.*Spe/);
  assert.match(result.explanations.join('\n'), /Focus Sash/);
});

test('mixed attackers return legal results without falling back to six-dimensional brute force', async () => {
  const result = await optimizeFromPaste(`Infernape @ Life Orb
Ability: Blaze
- Close Combat
- Flamethrower
- Grass Knot
- Mach Punch`, {
    naturePolicy: 'neutral',
    megaPolicy: 'never',
    coarseTopK: 40,
    finalTopK: 5,
    statsProvider: async () => ({
      info: { format: 'gen9championsbssregma', month: 'fixture' },
      data: {
        Milotic: {
          usage: 100,
          Abilities: { MarvelScale: 100 },
          Items: { Leftovers: 100 },
          Spreads: { 'Calm:32/0/0/0/32/2': 100 },
          Moves: { Surf: 80, IceBeam: 40 }
        }
      }
    })
  });

  assert.equal(result.attackProfile.primaryCategory, 'mixed');
  assert.equal(result.results.length, 5);
  assert.ok(result.results.every((row) => row.statPointTotal <= 66));
});
