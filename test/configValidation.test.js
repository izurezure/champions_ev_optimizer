import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, validateStartupConfig } from '../src/config/validation.js';

const defaults = {
  format: 'gen9championsbssregma',
  month: 'latest',
  rating: '1500',
  megaPolicy: 'auto',
  naturePolicy: 'fixed',
  excludeOther: true,
  setupBoost: 0
};

const formats = [
  {
    id: 'gen9championsbssregma',
    smogonFormat: 'gen9championsbssregma',
    label: '[Gen 9 Champions] BSS Reg M-A',
    battleType: 'singles',
    rulesetKind: 'flat',
    defaultLevel: 50,
    ratings: ['0', '1500', '1630', '1760']
  },
  {
    id: 'gen9championsou',
    smogonFormat: 'gen9championsou',
    label: '[Gen 9 Champions] OU',
    battleType: 'singles',
    rulesetKind: 'standard',
    defaultLevel: 50,
    ratings: ['0', '1500', '1630', '1760']
  }
];

test('validateConfig accepts Champions OU and returns URL-facing metadata separately', () => {
  const config = validateConfig(
    { format: 'gen9championsou', month: '2026-04', rating: '1500', setupBoost: '2' },
    { defaults, formats }
  );

  assert.equal(config.format, 'gen9championsou');
  assert.equal(config.smogonFormat, 'gen9championsou');
  assert.equal(config.formatLabel, '[Gen 9 Champions] OU');
  assert.equal(config.month, '2026-04');
  assert.equal(config.rating, '1500');
  assert.equal(config.setupBoost, 2);
});

test('validateConfig rejects unknown format, invalid month, and invalid rating before URL use', () => {
  assert.throws(() => validateConfig({ format: 'unknown' }, { defaults, formats }), /Unknown format/);
  assert.throws(() => validateConfig({ month: '../../x' }, { defaults, formats }), /Invalid month/);
  assert.throws(() => validateConfig({ format: 'gen9championsou', rating: '1825' }, { defaults, formats }), /Invalid rating/);
});

test('validateConfig rejects unsupported format metadata for this optimizer', () => {
  assert.throws(
    () => validateConfig({ format: 'gen9championsvgc' }, {
      defaults,
      formats: [
        ...formats,
        {
          id: 'gen9championsvgc',
          smogonFormat: 'gen9championsvgc',
          label: '[Gen 9 Champions] VGC',
          battleType: 'doubles',
          rulesetKind: 'vgc',
          defaultLevel: 50,
          ratings: ['1500']
        }
      ]
    }),
    /Unsupported format/
  );
  assert.throws(
    () => validateConfig({ format: 'gen9championscustom' }, {
      defaults,
      formats: [
        ...formats,
        {
          id: 'gen9championscustom',
          smogonFormat: 'gen9championscustom',
          label: '[Gen 9 Champions] Custom',
          battleType: 'singles',
          rulesetKind: 'custom',
          defaultLevel: 100,
          ratings: ['1500']
        }
      ]
    }),
    /Unsupported format/
  );
});

test('validateStartupConfig rejects defaults that are missing from the registry', () => {
  assert.throws(
    () => validateStartupConfig({ defaults: { ...defaults, format: 'missing' }, formats }),
    /Unknown format/
  );
});
