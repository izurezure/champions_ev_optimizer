# Role Speed Probability Fix Spec

## 1. Purpose

Toxapex のような `Toxic + Recover` 型が `Spe` を探索したうえで `Spe 0` を選ぶようにし、同時に速度勝率 `P` が `1.000` になる不正な表示・評価を防ぐ。

この修正は、探索空間を狭めるものではない。`Spe` は引き続き合法配分として探索する。修正対象は、技構成から決まる「先に動く価値」の係数と、速度勝率推定の上限処理である。

## 2. Constraints

- ロール判定はポケモン名ではなく技構成から決める。
- `Spe` を探索対象から外さない。
- 既存の総合能力指数 `Z` の形は維持する。
- `P` は実際の先攻確率として表示する。
- スコア計算では、技構成に応じて `P` に係数 `kP` を掛ける。
- `P=1.000` は出さない。最高でも同速ミラーの可能性を考慮する。
- `Protect` など非攻撃の優先度技を、攻撃技の先攻確率へ流用しない。

## 3. Current Problems

### 3.1 Defensive Role Still Rewards Tiny Speed Gains

現在の defensive profile は `HP / Def / SpD / Spe` を探索するため、`Spe 1` や `Spe 2` も候補に入る。これは正しい。

問題は、`Toxic + Recover` のような耐久型でも、`P` の価値が攻撃型と同じ重みで `Z` に入ることにある。そのため、`P=0.016` から `P=0.022` 程度の微小な上昇が、耐久1点より高く評価される場合がある。

期待される挙動は、`Spe` を探索したうえで、耐久型では `Spe` 投資の価値が低いため `Spe 0` が上位になることである。

### 3.2 P Can Become 1.000

速度勝率 `P` が `1.000` になるのは不正である。どれだけ速いポケモンでも、自己ミラーまたは同速相手を考慮すれば最高は同速勝負を含む値になる。

また、`Protect` のような非攻撃の優先度技を `maxMovePriority()` で拾うと、`Shadow Ball` などの通常攻撃まで優先度付き行動として評価される。この場合、Gengar-Mega のような構成で `P=1.000` が発生しやすい。

## 4. Definitions

### 4.1 `P_raw`

実際の先攻確率。結果テーブルの `P` 列にはこの値を表示する。

`P_raw` は相手サンプル分布に、最小限の自己ミラー同速事前分布を混ぜて算出する。

```text
mirrorWeight = 0.01
P_raw = (sum(opponentWeight_j * speedWin(self, opponent_j)) + mirrorWeight * 0.5)
        / (sum(opponentWeight_j) + mirrorWeight)
```

相手サンプル全員に先制できる場合でも、`P_raw` は約 `0.995` になり、`1.000` にはならない。

### 4.2 `kP`

技構成から決まる先攻価値係数。

`P` 自体の意味は変えない。スコア計算に入れるときだけ、ロールに応じて `kP` を掛ける。

### 4.3 `P_eval`

スコア計算に使う先攻価値。

```text
P_eval = clamp(kP * P_raw, 0, P_CAP)
P_CAP = 0.995
```

## 5. Z Formula

既存式の構造は維持し、`P` の位置に `P_eval` を使う。

```text
Z = D_out * (V + P_eval) / { 1 + n * D_out * (1/2 - P_eval) }
```

表示用の `P` は `P_raw` のままにする。これにより、実際の先攻確率と、技構成上の先攻価値を分離して説明できる。

## 6. kP Rules

初期実装では、複雑な学習やポケモン名補正は入れず、技ロールから決定的に算出する。

| 技構成・ロール | 条件 | `kP` |
|---|---|---:|
| Recovery wall + status pressure | `recoveryWall` と `statusPressure` を両方持ち、`Taunt/Encore/screens/pivot/setup` を持たない | 0.20 |
| Recovery wall | `recoveryWall` を持ち、速度依存ロールを持たない | 0.30 |
| Status pressure only | `statusPressure` を持つが `recoveryWall` を持たない | 0.60 |
| Hazard / removal utility | hazards または removal が主ロール | 0.60 |
| Screens / Taunt / Encore / Trick | 先に押す価値が高い補助技 | 1.10 |
| Ordinary physical/special attacker | 通常の攻撃型 | 1.00 |
| Setup sweeper | 攻撃積み・素早さ積みを持つ攻撃型 | 1.15 |
| Priority attacker | 先制攻撃技を持つ攻撃型 | 1.00 |

補足:

- 先制攻撃技は `P` 係数で過剰補正しない。優先度は `speedWin` 側で処理する。
- `Protect`, `Detect`, `Endure`, `King's Shield`, `Spiky Shield`, `Baneful Bunker`, `Obstruct`, `Silk Trap` は攻撃用 `P` の優先度として扱わない。
- 複数ロールを持つ場合は、速度依存ロールが明確に存在する場合だけ `kP` を引き上げる。`recoveryWall + statusPressure` は低い `kP` を優先する。

## 7. Priority Handling

`P_raw` 計算に使う優先度は、評価対象の行動に関係する技だけから取る。

### 7.1 Offensive Profile

攻撃型では、攻撃技の最大優先度だけを見る。

```text
priority = max(priority of damaging moves)
```

`Protect` のような非攻撃技は除外する。

### 7.2 Defensive / Utility Profile

耐久・補助型では、原則として優先度を `0` とする。

将来、`Prankster` や優先度付き補助技を評価する場合でも、それは攻撃技の先攻確率ではなく、補助ロールの別補正として扱う。

## 8. Expected Behavior

### 8.1 Toxapex

Input:

```text
Toxapex @ Sitrus Berry
Ability: Regenerator
Level: 50
- Poison Jab
- Toxic
- Recover
```

Expected profile:

```text
primaryCategory: defensive
roles: statusPressure, recoveryWall
kP: 0.20
```

Expected allocation behavior:

- `Spe` は探索対象に含まれる。
- ただし上位候補は `Spe 0` を優先する。
- `Atk` は高投資しない。
- `HP / Def / SpD` に配分が寄る。

例:

```text
HP 32 / Atk 0 / Def 32 / SpA 0 / SpD 2 / Spe 0
HP 32 / Atk 0 / Def 31 / SpA 0 / SpD 3 / Spe 0
HP 32 / Atk 0 / Def 30 / SpA 0 / SpD 4 / Spe 0
```

`Spe 1` が候補に存在することは問題ではない。`Spe 1` が `Spe 0` を上回る場合だけ問題である。

### 8.2 Gengar-Mega

Input:

```text
Gengar-Mega @ Gengarite
Ability: Shadow Tag
Level: 50
- Protect
- Shadow Ball
- Sludge Wave
- Focus Blast
```

Expected profile:

```text
primaryCategory: special
kP: 1.00
```

Expected speed behavior:

- `Protect` の優先度を攻撃技の優先度として扱わない。
- `P_raw` は `1.000` にならない。
- 最高速側でも自己ミラー同速事前分布により `P_raw <= 0.995` 程度になる。

## 9. Acceptance Criteria

### 9.1 Unit Tests

1. `estimateSpeedWinProbability()` は全相手に先制できる入力でも `P < 1` を返す。
2. 同速相手だけの場合は `P = 0.5` を返す。
3. `Protect` を含む攻撃型で、攻撃技の優先度が `Protect` によって上がらない。
4. `recoveryWall + statusPressure` profile の `kP` は `0.20` になる。

### 9.2 Regression Tests

1. Toxapex `Poison Jab / Toxic / Recover` は最上位候補が `Spe 0` になる。
2. 同じToxapexで `Atk <= 8`、かつ `HP + Def + SpD >= 56` を満たす。
3. Gengar-Mega `Protect / Shadow Ball / Sludge Wave / Focus Blast` は `P < 1` になる。
4. 既存Garchomp回帰は引き続き `Atk` と `Spe` を高く評価する。
5. mixed attacker 回帰は引き続き合法配分を返す。

### 9.3 CLI Smoke Checks

固定データまたは既存キャッシュで次を確認する。

```text
Toxapex defensive set:
  top result has Spe 0

Gengar-Mega special set:
  P column is below 1.000
```

## 10. Implementation Plan

1. `speedModel` に自己ミラー同速事前分布を入れる。
2. `optimizer` の優先度取得を、全技最大ではなく profile に関係する技だけへ変更する。
3. 技ロールから `kP` を算出する小さな純粋関数を追加する。
4. `totalPowerIndex` または呼び出し側で `P_eval = kP * P_raw` を作り、Z式へ渡す。
5. 結果テーブルの `P` は `P_raw` のまま表示する。
6. 必要なら explanation に `Speed value coefficient: 0.20` のような説明を追加する。

## 11. Non-Goals

- ポケモン名によるロール補正。
- チーム単位のミラー確率推定。
- 完全なバトルシミュレーション。
- `Protect` のターン稼ぎ価値の完全評価。
- `Prankster` など特性込み補助優先度の詳細評価。

## 12. Risks

- `kP` の初期値は経験的であり、将来の実戦データで調整が必要になる。
- `P_eval` を分母にも入れるため、ロールによってZの絶対値が変わる。ランキング比較では意図通りだが、異なるロール間のZ絶対値比較には注意が必要。
- 自己ミラー事前分布 `mirrorWeight = 0.01` は安全側の近似であり、実際のミラー出現率そのものではない。

## 13. Done Definition

- 上記 acceptance criteria のテストが追加され、失敗から成功へ変わる。
- `npm.cmd test` が全件成功する。
- Toxapex実入力で `Spe 0` が最上位になる。
- Gengar-Mega実入力で `P=1.000` が出ない。
- `Spe` 探索を外していないことがコード上確認できる。
