# 総合能力指数最大化ツール 仕様書 v0.1

## 1. 目的

Showdown paste形式で入力されたポケモンについて、PS! `[Gen 9 Champions] BSS Reg M-A` のSmogon統計を利用し、総合能力指数 `Z` を最大化するChampions式Stat Point配分を推定する。

MVPは以下を満たす。

- PS! `[Gen 9 Champions] BSS Reg M-A` で利用できる。
- 統計情報はツール起動時に毎回更新確認する。
- 年月・レート帯をGUIから差し替えられる。
- `Other` を除いた条件付き割合に補正して計算する。
- Championsの努力値仕様、つまりStat Point制約に合わせる。
- MVPではメガシンカのみ対応する。
- Z技・ダイマックス・テラスタル等は後から追加できる設計にする。
- 外部サービス化せず、Git clone後にCLIからローカル起動できる。

---

## 2. 入力仕様

### 2.1 入力形式

Showdown paste互換形式。

```text
Garchomp @ Focus Sash
Ability: Rough Skin
Level: 50
- Swords Dance
- Earthquake
- Rock Tomb
- Stealth Rock
```

### 2.2 対応フィールド

| フィールド | 必須 | 備考 |
|---|---:|---|
| Species | 必須 | `Garchomp` 等 |
| Item | 任意 | メガストーンならMega評価対象 |
| Ability | 任意 | 未指定時は統計上の補正後最大割合を採用 |
| Level | 任意 | 未指定時は50 |
| Moves | 必須 | 1〜4個 |
| Nature / Stat Alignment | 任意 | 未指定時はGUI設定に従う |
| EVs / Stat Points | 任意 | 既存配分の評価にも使える |

---

## 3. Champions Stat Point仕様

MVPでは以下の制約で配分を探索する。

```text
各ステータス: 0〜32
合計: 0〜66
整数のみ
対象: HP / Atk / Def / SpA / SpD / Spe
```

内部名は `statPoints` とし、UI上は「Stat Points / Champions努力値」と表示する。

出力例：

```text
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
```

旧世代のEVへ換算して処理するのではなく、Champions用Stat Pointを直接扱う。

---

## 4. 総合能力指数モデル

添付記事の式を、物理・特殊・混合へ拡張しやすいように次の形で実装する。

```text
Z = D_out × (V + P) / { 1 + n × D_out × (1/2 - P) }
```

ここで：

| 記号 | 意味 | 推定方法 |
|---|---|---|
| `D_out` | こちらの一撃平均ダメージ。記事の `mC` に相当 | 入力技とSmogonメタサンプルへの平均ダメージ |
| `P` | 先攻確率 | 相手Speed分布から経験CDFで算出 |
| `V` | 攻撃を耐える回数 | 相手火力分布から被ダメージシミュレーション |
| `n` | 相手HPの逆数 | `E[1 / opponentHP]` |
| `m` | 攻撃実数値に対するダメージ比例係数 | `D_out / offensiveStat` として逆算・説明用に出す |

添付記事では `P=a+bS` の一次近似が使われているが、実装ではSmogon統計から相手Speed分布を作り、`P(S)` を経験分布で直接推定する。局所的な説明用にのみ `a,b` を回帰する。

---

## 5. メタ母集団生成

### 5.1 入力データ

Smogon chaos JSONの主な利用フィールド：

- `usage`
- `Abilities`
- `Items`
- `Spreads`
- `Moves`
- `Teammates`
- `Checks and Counters`

### 5.2 サンプル作成

統計は基本的に周辺分布なので、MVPでは以下の独立仮定を置く。

```text
P(set) ≒ P(species) × P(ability|species) × P(item|species) × P(spread|species) × Π P(moveSlot|species)
```

全組合せは爆発するため、各ポケモンについて上位候補だけをbeam searchで展開する。

デフォルト：

```json
{
  "topSpecies": 80,
  "topItemsPerSpecies": 5,
  "topAbilitiesPerSpecies": 3,
  "topSpreadsPerSpecies": 10,
  "topMovesPerSpecies": 12,
  "maxSetSamplesPerSpecies": 20,
  "maxOpponentSamples": 1500
}
```

---

## 6. 定数逆算仕様

### 6.1 `n` の推定

```text
n = Σ weight_j × (1 / HP_j)
```

対象はOther除外後のメタサンプル。

### 6.2 `P` の推定

```text
P = Σ weight_j × speedWin(self, opponent_j)
```

```js
function speedWin(self, opp) {
  if (self.priority > opp.priority) return 1;
  if (self.priority < opp.priority) return 0;
  if (self.speed > opp.speed) return 1;
  if (self.speed < opp.speed) return 0;
  return 0.5;
}
```

MVPでは優先度補正は次だけ扱う。

- 技のpriority
- こだわりスカーフ等の明示的Speed補正
- 特性による常時Speed補正
- 天候・場依存Speed補正はGUIでON/OFF可能な仮定として扱う

### 6.3 `D_out` と `m` の推定

入力技から攻撃技を抽出する。

例：Garchomp入力の場合：

```text
Swords Dance: status/setup
Earthquake: physical damage
Rock Tomb: physical damage + speed control
Stealth Rock: status/hazard
```

`Earthquake` と `Rock Tomb` を攻撃技として評価する。`Swords Dance` はMVPでは「未積み」「1回積み」の2シナリオをGUIで切替可能にする。

```text
D_out = Σ opponent_j weight_j × max_or_weightedAvgDamage(selfMoves, opponent_j)
m = D_out / offensiveStat
```

デフォルトでは「最大期待ダメージ技」を採用する。将来設定で「技選択確率」や「一貫性評価」を入れる。

### 6.4 `V` の推定

```text
V = Σ opponent_j weight_j × survivedHitCount(self, opponent_j)
```

`survivedHitCount` は相手の上位攻撃技から最大期待ダメージを選び、乱数幅を平均して算出する。

MVPの簡易式：

```text
V = max(0, HP_self / avgIncomingDamage - 1)
```

高精度モード：

```text
V = E_damageRolls[max(0, numberOfHitsBeforeKO)]
```

添付記事由来の解析式 `T=HBD/(B+D)` は説明指標として併記するが、実際の最適化ではタイプ相性・技威力・特性・持ち物を含む被ダメージ推定を優先する。

---

## 7. 最適化仕様

### 7.1 探索対象

```text
HP, Atk, Def, SpA, SpD, Spe ∈ [0, 32]
sum <= 66
```

デフォルトでは全探索する。ただしダメージ計算は重いため、次の2段階に分ける。

1. 粗評価：事前計算したステータス表と近似 `D_out/P/V` で全合法配分をスコアリング
2. 精評価：上位N件のみ詳細ダメージ計算

デフォルト：

```json
{
  "coarseTopK": 300,
  "finalTopK": 20
}
```

### 7.2 性格・Stat Alignment

MVPでは3モード。

| モード | 内容 |
|---|---|
| fixed | 入力pasteのNatureを固定 |
| neutral | Natureなし、またはSerious扱い |
| optimize | 候補Natureを全探索 |

デフォルトは `fixed`。入力にNatureがない場合はGUIで確認可能にし、初期値は `optimize` とする。

### 7.3 出力

上位候補を表で表示する。

| rank | Stat Points | Nature | Stats | Z | P | V | D_out | m | n | 説明 |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|

加えて、Showdown pasteを生成する。

---

## 8. メガシンカ対応

MVPのメガポリシー：

```ts
type MegaPolicy = 'never' | 'always' | 'auto';
```

| policy | 内容 |
|---|---|
| never | メガ前として評価 |
| always | 対応メガストーンなら常にメガ後として評価 |
| auto | メガ前・メガ後を両方評価し、Zが高い方を採用 |

単体ツールでは「チーム内で誰がメガシンカするか」までは確定できないため、出力に次を表示する。

```text
この評価は Garchomp がメガシンカ権を使用する前提です。
チーム内に別のメガ枠がいる場合は MegaPolicy=never でも再計算してください。
```

---

## 9. 将来ギミック拡張

MVP時点で `MechanicPlugin` を用意する。

```ts
interface MechanicPlugin {
  id: string;
  displayName: string;

  isApplicable(ctx: BattleContext, set: PokemonSet): boolean;

  transformSpecies?(set: PokemonSet): PokemonSet;
  modifyStats?(stats: Stats, ctx: BattleContext): Stats;
  modifyMove?(move: Move, ctx: BattleContext): Move;
  modifyDamage?(damage: DamageRange, ctx: BattleContext): DamageRange;
  modifySpeedOrder?(order: SpeedOrderContext): SpeedOrderContext;

  explain?(result: EvaluationResult): string[];
}
```

MVP実装：

```text
plugins/
  mega.js
```

将来追加：

```text
plugins/
  zmove.js
  dynamax.js
  terastal.js
```

この設計により、Regulation変更で「テラスタルが解禁」「ダイマックスが復帰」しても、Z評価本体を壊さずに追加できる。

---

## 10. GUI仕様

### 10.1 画面

1画面構成。

- Showdown paste入力欄
- Format選択
  - default: `gen9championsbssregma`
- 年月選択
  - `latest`
  - `2026-04` など
- レート帯選択
  - `0 / 1500 / 1630 / 1760`
- Mega policy
  - `auto / always / never`
- Nature policy
  - `fixed / neutral / optimize`
- Other除外
  - 常時ON、デバッグ時のみOFF可
- 計算ボタン
- 結果テーブル
- Showdown paste出力欄
- 統計更新ログ

### 10.2 起動時挙動

```text
1. 設定読込
2. Smogon index確認
3. 対象年月・format・ratingの統計を取得
4. gzip優先で保存
5. JSON parse
6. Other除外正規化
7. GUI起動
```

ネットワーク失敗時はキャッシュを使えるが、必ず警告を出す。

```text
警告: 起動時の統計更新に失敗したため、2026-04 cached data を使用しています。
```

---

## 11. ディレクトリ構成

```text
champions-ev-optimizer/
  package.json
  README.md
  src/
    cli.js
    server.js
    ui/
      index.html
      app.js
      style.css
    stats/
      smogonClient.js
      normalize.js
      opponentSampler.js
    ps/
      pasteParser.js
      dexAdapter.js
      statCalculator.js
      legality.js
    model/
      totalPowerIndex.js
      speedModel.js
      damageEngine.js
      durabilityModel.js
      optimizer.js
    mechanics/
      mechanicPlugin.js
      mega.js
      zmove.stub.js
      dynamax.stub.js
      terastal.stub.js
    config/
      defaults.json
      formats.json
    test/
      normalize.test.js
      championsStatPoints.test.js
      pasteParser.test.js
      totalPowerIndex.test.js
```

---

## 12. 検証仕様

### 12.1 単体テスト

| テスト | 合格条件 |
|---|---|
| paste parser | 入力例から species/item/ability/level/moves を抽出できる |
| Other除外正規化 | `Other` を除外し、残り合計が100になる |
| Stat Point制約 | 各stat 0〜32、合計66超を拒否 |
| Smogon URL生成 | month/rating/format差し替えが正しい |
| P推定 | 同速時0.5、上回る時1、下回る時0 |
| Z式 | 手計算可能な固定値と一致 |
| Mega plugin | 対応メガストーン時だけform変換する |
| キャッシュ | 更新失敗時に警告つきで既存cacheを読む |

### 12.2 回帰テスト用入力

```text
Garchomp @ Focus Sash
Ability: Rough Skin
Level: 50
- Swords Dance
- Earthquake
- Rock Tomb
- Stealth Rock
```

期待：

- 物理アタッカーとして判定される。
- `Atk` と `Spe` が主要探索対象になる。
- `Swords Dance` と `Stealth Rock` により、純フルアタより耐久価値がやや上がる。
- `Focus Sash` は耐久モデルに「最低1回行動保証」として反映される。
- 出力はChampions式 `0〜32 / 合計66` のStat Pointになる。

### 12.3 受け入れ基準

MVP完了条件：

- `npm install && npm start` だけで起動する。
- 起動時にSmogon統計を取得または更新確認する。
- GUIで年月・レート帯を変更して再計算できる。
- `[Gen 9 Champions] BSS Reg M-A` のchaos JSONを読める。
- `Other` 除外後の条件付き割合で計算する。
- 入力例に対して上位20配分を出せる。
- メガストーン持ちに対してメガ前後評価を切替できる。
- Z技・ダイマックス・テラスタル用のplugin stubがある。
- 外部公開なし、`127.0.0.1` のローカルGUIのみ。
