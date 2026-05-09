# Champions EV Optimizer

Pokemon Champions の Stat Point 配分をローカルで最適化するツールです。

Pokemon Showdown paste を入力として受け取り、Smogon の
`[Gen 9 Champions] BSS Reg M-A` chaos 統計を更新・取得し、相手メタ母集団を生成したうえで、
`champions_ev_optimizer_spec.md` の総合能力指数に基づいて合法な Champions Stat Point 配分を順位付けします。

既定のREADMEは英語版の [README.md](README.md) です。

## 主な機能

- `127.0.0.1` のみにバインドするローカルGUI。
- 再現しやすいCLI実行。
- Pokemon Showdown paste から、種族、持ち物、特性、レベル、性格、技、配分行を解析。
- Champions Stat Point を直接処理:
  - 各ステータス: `0..32`
  - 合計: `0..66`
  - 対象: `HP / Atk / Def / SpA / SpD / Spe`
- Smogon chaos JSON の更新確認、取得、gzip/JSONキャッシュ。
- `Other` を除外した条件付き割合への正規化。
- 使用率、特性、持ち物、配分、技から相手サンプルを生成。
- 先攻確率 `P`、与ダメージ `D_out`、耐久価値 `V`、相手HP逆数 `n`、説明用係数 `m` を出力。
- Mega policy: `auto`, `always`, `never`。
- Z技、ダイマックス、テラスタル用の拡張stub。
- 仕様書のGarchomp入力に対する回帰テスト。

## 必要環境

- Node.js 20 以上。
- npm。
- 初回取得または統計更新時のネットワーク接続。

外部公開用のサーバーはありません。計算とキャッシュはローカルマシン内に留まります。

## クイックスタート

```sh
npm install
npm start
```

表示されたローカルURLを開きます。

```text
http://127.0.0.1:3000
```

Windows PowerShell で `npm.ps1` がブロックされる場合は、次を使ってください。

```sh
npm.cmd install
npm.cmd start
```

## GUIの使い方

1. 入力欄に Pokemon Showdown paste を貼り付けます。
2. format、年月、レート帯、Mega policy、Nature policy、積みシナリオを選びます。
3. `Calculate` を押します。
4. 結果テーブルと生成された Showdown paste を確認します。

既定formatは次です。

```text
gen9championsbssregma
```

Smogon年月の既定値は `latest` です。Smogon stats index を確認し、利用可能な最新月を使います。ネットワーク更新に失敗し、キャッシュが存在する場合は、警告を出したうえでキャッシュを使用します。

## CLIの使い方

標準入力からpasteを渡します。

```sh
node src/cli.js --month latest --rating 1500 < set.txt
```

ファイルからpasteを渡します。

```sh
node src/cli.js --file set.txt --month 2026-04 --rating 1500 --nature optimize --mega never
```

主なオプション:

```text
--month   latest, 2026-04 など
--format  gen9championsbssregma
--rating  0, 1500, 1630, 1760
--nature  fixed, neutral, optimize
--mega    auto, always, never
--setup   0, 1, 2
```

## 入力例

```text
Garchomp @ Focus Sash
Ability: Rough Skin
Level: 50
- Swords Dance
- Earthquake
- Rock Tomb
- Stealth Rock
```

## 出力

上位配分について、次の列を返します。

- rank
- Stat Points
- Nature
- Stats
- `Z`
- `P`
- `V`
- `D_out`
- `m`
- `n`
- explanation

さらに、最上位配分を反映した Showdown paste を生成します。

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

## 計算モデル概要

スコアは次の式です。

```text
Z = D_out * (V + P) / { 1 + n * D_out * (1/2 - P) }
```

各値の意味:

- `D_out`: サンプル相手への重み付き期待与ダメージ。
- `P`: 重み付き先攻確率。
- `V`: 重み付き耐久・行動価値。
- `n`: `E[1 / opponentHP]`。
- `m`: `D_out / offensiveStat` として出す説明用係数。

実装は、隠れた手作業調整よりも、検証可能で決定的なMVP挙動を優先しています。物理型・特殊型では支配劣位の配分を除外します。混合型では攻撃2軸を代表点に絞り、残りステータスを厳密配分することで、任意paste入力でも応答性を保ちます。

## Smogonデータとキャッシュ

Smogon統計は次から取得します。

```text
https://www.smogon.com/stats/
```

キャッシュは次に保存されます。

```text
src/stats/cache/
```

キャッシュファイルはgit管理対象外です。削除しても問題ありません。次回実行時に再取得を試みます。

## テスト

```sh
npm test
```

テスト対象:

- Showdown paste 解析。
- Champions Stat Point 制約と実数値計算式。
- `Other` 除外正規化。
- Smogon chaos URL生成とキャッシュfallback。
- 先攻確率。
- 総合能力指数の式。
- Mega plugin。
- Garchomp回帰。
- 混合アタッカーのbounded optimization。

## ディレクトリ構成

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

## 現時点の制限

- ダメージ計算はMVP近似です。Pokemonデータ、技威力、タイプ相性、STAB、一部持ち物、一部特性を使いますが、完全なバトルシミュレータではありません。
- 天候、フィールド、場の状態、揮発状態、チーム単位の制約は限定的です。
- 単体pasteから、チーム内のメガシンカ権の使用者までは確定できません。別のメガ枠がいる場合は `--mega never` でも比較してください。

## トラブルシューティング

PowerShellでnpmがブロックされる場合:

```sh
npm.cmd install
npm.cmd start
```

Smogon更新に失敗する場合、存在が分かっている年月を指定して一度実行してください。

```sh
node src/cli.js --month 2026-04 --rating 1500 < set.txt
```

キャッシュが古い場合は、`src/stats/cache/` を削除して再実行してください。
