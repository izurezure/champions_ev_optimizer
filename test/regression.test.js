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

test('Champions OU format returns legal results with OU metadata intact', async () => {
  const result = await optimizeFromPaste(`Great Tusk @ Booster Energy
Ability: Protosynthesis
Level: 50
- Headlong Rush
- Close Combat
- Rapid Spin
- Knock Off`, {
    format: 'gen9championsou',
    month: '2026-04',
    rating: '1500',
    naturePolicy: 'neutral',
    megaPolicy: 'never',
    coarseTopK: 40,
    finalTopK: 5,
    statsProvider: async () => ({
      payload: {
        info: { format: 'gen9championsou', month: '2026-04' },
        data: {
          Kingambit: {
            usage: 60,
            Abilities: { SupremeOverlord: 100 },
            Items: { BlackGlasses: 80, Other: 20 },
            Spreads: { 'Adamant:32/32/0/0/0/2': 80, Other: 20 },
            Moves: { KowtowCleave: 80, SuckerPunch: 70, Other: 10 }
          },
          Gholdengo: {
            usage: 40,
            Abilities: { GoodasGold: 100 },
            Items: { ChoiceScarf: 50, Other: 50 },
            Spreads: { 'Timid:0/0/0/32/2/32': 80, Other: 20 },
            Moves: { MakeItRain: 80, ShadowBall: 70, Other: 10 }
          }
        }
      },
      month: '2026-04',
      source: 'provided',
      warning: '',
      log: []
    })
  });

  assert.equal(result.format, 'gen9championsou');
  assert.equal(result.formatLabel, '[Gen 9 Champions] OU');
  assert.equal(result.month, '2026-04');
  assert.equal(result.rating, '1500');
  assert.equal(result.results.length, 5);
  assert.ok(result.results.every((row) => row.statPointTotal <= 66));
});

test('defensive utility sets favor bulk instead of maxing a token attack move', async () => {
  const result = await optimizeFromPaste(`Toxapex @ Sitrus Berry
Ability: Regenerator
Level: 50
- Poison Jab
- Toxic
- Recover`, {
    format: 'gen9championsou',
    month: '2026-04',
    rating: '1500',
    naturePolicy: 'fixed',
    megaPolicy: 'never',
    coarseTopK: 80,
    finalTopK: 5,
    statsProvider: async () => ({
      payload: {
        info: { format: 'gen9championsou', month: '2026-04' },
        data: {
          'Great Tusk': {
            usage: 55,
            Abilities: { Protosynthesis: 100 },
            Items: { 'Booster Energy': 100 },
            Spreads: { 'Adamant:32/32/0/0/0/2': 100 },
            Moves: { 'Headlong Rush': 80, Earthquake: 70, 'Close Combat': 50 }
          },
          Gholdengo: {
            usage: 45,
            Abilities: { GoodasGold: 100 },
            Items: { ChoiceScarf: 100 },
            Spreads: { 'Timid:0/0/0/32/2/32': 100 },
            Moves: { MakeItRain: 80, ShadowBall: 70 }
          }
        }
      },
      month: '2026-04',
      source: 'provided',
      warning: '',
      log: []
    })
  });

  const best = result.results[0];

  assert.equal(result.attackProfile.primaryCategory, 'defensive');
  assert.ok(result.attackProfile.roles.some((role) => role.id === 'recoveryWall'));
  assert.ok(result.attackProfile.roles.some((role) => role.id === 'statusPressure'));
  assert.equal(best.nature, 'Serious');
  assert.equal(best.statPoints.spe, 0);
  assert.ok(best.statPoints.atk <= 8);
  assert.ok(best.statPoints.hp + best.statPoints.def + best.statPoints.spd >= 56);
  assert.match(best.explanation, /recovery|status|bulk/);
});

test('Gengar-Mega with Protect does not report a certain speed win probability', async () => {
  const result = await optimizeFromPaste(`Gengar-Mega @ Gengarite
Ability: Shadow Tag
Level: 50
- Protect
- Shadow Ball
- Sludge Wave
- Focus Blast`, {
    format: 'gen9championsou',
    month: '2026-04',
    rating: '1500',
    naturePolicy: 'fixed',
    megaPolicy: 'always',
    coarseTopK: 80,
    finalTopK: 5,
    statsProvider: async () => ({
      payload: {
        info: { format: 'gen9championsou', month: '2026-04' },
        data: {
          Clefable: {
            usage: 100,
            Abilities: { MagicGuard: 100 },
            Items: { Leftovers: 100 },
            Spreads: { 'Bold:32/0/32/0/2/0': 100 },
            Moves: { Moonblast: 80, ThunderWave: 40 }
          }
        }
      },
      month: '2026-04',
      source: 'provided',
      warning: '',
      log: []
    })
  });

  assert.equal(result.input.species, 'Gengar-Mega');
  assert.equal(result.attackProfile.primaryCategory, 'special');
  assert.ok(result.results.every((row) => row.p < 1));
});
