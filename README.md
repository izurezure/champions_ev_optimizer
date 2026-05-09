# Champions EV Optimizer

Local optimizer for Pokemon Champions Stat Point spreads.

It accepts a Pokemon Showdown paste, refreshes Smogon chaos stats for
`[Gen 9 Champions] BSS Reg M-A`, builds an opponent sample population, and
ranks legal Champions Stat Point allocations by the total power index described
in `champions_ev_optimizer_spec.md`.

Japanese documentation is available in [README.ja.md](README.ja.md).

## Features

- Local-only GUI bound to `127.0.0.1`.
- CLI mode for repeatable optimization runs.
- Pokemon Showdown paste parsing for species, item, ability, level, nature,
  moves, and pasted Stat Point or EV-style spread lines.
- Direct Champions Stat Point handling:
  - each stat: `0..32`
  - total: `0..66`
  - target stats: `HP / Atk / Def / SpA / SpD / Spe`
- Smogon chaos JSON refresh and local gzip/JSON cache fallback.
- `Other` exclusion and conditional percentage renormalization.
- Opponent sampling from usage, abilities, items, spreads, and moves.
- Speed-order probability `P`, outgoing damage `D_out`, durability value `V`,
  inverse HP constant `n`, and explanatory damage coefficient `m`.
- Mega Evolution policy support: `auto`, `always`, and `never`.
- Stub plugin slots for Z-Move, Dynamax, and Terastal support.
- Regression tests for the Garchomp sample from the specification.

## Requirements

- Node.js 20 or newer.
- npm.
- Network access for first-time or refreshed Smogon stats.

The project has no hosted backend. All calculation and cached data stay on the
local machine.

## Quick Start

```sh
npm install
npm start
```

Open the printed local URL:

```text
http://127.0.0.1:3000
```

On Windows PowerShell, script execution policy may block `npm.ps1`. In that
case, run:

```sh
npm.cmd install
npm.cmd start
```

## GUI Usage

1. Paste a Pokemon Showdown set into the input area.
2. Choose the format, month, rating, Mega policy, nature policy, and setup
   scenario.
3. Click `Calculate`.
4. Review the ranked table and generated Showdown paste output.

The default format is:

```text
gen9championsbssregma
```

The default Smogon month is `latest`, which checks the Smogon stats index and
uses the newest available monthly stats. If the network refresh fails and a
cache exists, the app uses cached data with a visible warning.

## CLI Usage

Read a paste from standard input:

```sh
node src/cli.js --month latest --rating 1500 < set.txt
```

Read a paste from a file:

```sh
node src/cli.js --file set.txt --month 2026-04 --rating 1500 --nature optimize --mega never
```

Common options:

```text
--month   latest, 2026-04, etc.
--format  gen9championsbssregma
--rating  0, 1500, 1630, or 1760
--nature  fixed, neutral, or optimize
--mega    auto, always, or never
--setup   0, 1, or 2
```

## Example Input

```text
Garchomp @ Focus Sash
Ability: Rough Skin
Level: 50
- Swords Dance
- Earthquake
- Rock Tomb
- Stealth Rock
```

## Output

The optimizer returns the top ranked spreads with:

- rank
- Stat Points
- nature
- final stats
- `Z`
- `P`
- `V`
- `D_out`
- `m`
- `n`
- explanation

It also emits a Showdown paste with the best spread, for example:

```text
Garchomp @ Focus Sash
Ability: Rough Skin
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Swords Dance
- Earthquake
- Rock Tomb
- Stealth Rock
```

## Model Summary

The score is:

```text
Z = D_out * (V + P) / { 1 + n * D_out * (1/2 - P) }
```

Where:

- `D_out` is the weighted expected outgoing damage against sampled opponents.
- `P` is the weighted probability of moving first.
- `V` is the weighted durability/action value.
- `n` is `E[1 / opponentHP]`.
- `m` is an explanatory coefficient calculated as `D_out / offensiveStat`.

The implementation favors verifiable, deterministic MVP behavior over hidden
manual tuning. Physical and special attackers prune dominated allocations.
Mixed attackers use a bounded offensive grid plus exact allocation over the
remaining stats so arbitrary paste input remains responsive.

## Smogon Data and Cache

Smogon stats are fetched from:

```text
https://www.smogon.com/stats/
```

Cached files are written under:

```text
src/stats/cache/
```

These cache files are ignored by git. They can be safely deleted; the next run
will attempt to download fresh stats again.

## Tests

```sh
npm test
```

The test suite covers:

- Showdown paste parsing.
- Champions Stat Point constraints and stat formula.
- `Other` exclusion normalization.
- Smogon chaos URL generation and cache fallback.
- Speed-order probability.
- Total power index formula.
- Mega plugin behavior.
- Garchomp regression behavior.
- Mixed-attacker bounded optimization.

## Project Structure

```text
src/
  cli.js
  server.js
  ui/
  stats/
  ps/
  model/
  mechanics/
  config/
test/
```

## Current Limitations

- Damage calculation is an MVP approximation built on Pokemon data, move power,
  type effectiveness, STAB, selected items, and selected abilities. It is not a
  complete battle simulator.
- Weather, terrain, field state, volatile boosts, and team-level constraints are
  intentionally limited.
- Team-level Mega ownership cannot be inferred from a single paste. If another
  team member may Mega Evolve, compare results with `--mega never`.

## Troubleshooting

If npm is blocked in PowerShell:

```sh
npm.cmd install
npm.cmd start
```

If Smogon refresh fails, run once with a specific month that is known to exist:

```sh
node src/cli.js --month 2026-04 --rating 1500 < set.txt
```

If cached stats look stale, delete `src/stats/cache/` and run again.
