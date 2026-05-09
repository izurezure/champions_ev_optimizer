# Champions EV Optimizer

Pokemon Champions の Stat Point 配分をローカルで最適化するツールです。

Pokemon Showdown paste を入力として受け取り、Smogon の
`[Gen 9 Champions] BSS Reg M-A` または `[Gen 9 Champions] OU` の chaos 統計を更新・取得し、
選択formatの相手メタ母集団を生成したうえで、`champions_ev_optimizer_spec.md` の総合能力指数に基づいて合法な Champions Stat Point 配分を順位付けします。

既定のREADMEは英語版の [README.md](README.md) です。

## 主な機能

- `127.0.0.1` のみにバインドするローカルGUI。
- 再現しやすいCLI実行。
- Champions BSS Reg M-A と Champions OU のformat選択。
- format、年月、レート帯、Mega policy、Nature policy、積みシナリオ、`Other` 除外の共通validation。
- Pokemon Showdown paste から、種族、持ち物、特性、レベル、性格、技、配分行を解析。
- Champions Stat Point を直接処理:
  - 各ステータス: `0..32`
  - 合計: `0..66`
  - 対象: `HP / Atk / Def / SpA / SpD / Spe`
- Smogon chaos JSON の更新確認、取得、format別gzip/JSONキャッシュ。
- `Other` を除外した条件付き割合への正規化。
- 使用率、特性、持ち物、配分、技から相手サンプルを生成。
- 先攻確率 `P`、与ダメージまたはロール圧力 `D_out`、耐久価値 `V`、相手HP逆数 `n`、説明用係数 `m` を出力。
- Mega policy: `auto`, `always`, `never`。
- Z技、ダイマックス、テラスタル用の拡張stub。
- 攻撃型、混合型、OU、耐久ユーティリティ型に対する回帰テスト。

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
2. BSSまたはOU、年月、レート帯、Mega policy、Nature policy、積みシナリオを選びます。
3. `Calculate` を押します。
4. 結果テーブルと生成された Showdown paste を確認します。

対応formatは次です。

```text
gen9championsbssregma
gen9championsou
```

既定formatは引き続き `gen9championsbssregma` です。

Smogon年月の既定値は `latest` です。Smogon stats index を確認し、選択formatとレート帯の統計が存在する最新月を使います。ネットワーク更新に失敗し、対応するキャッシュが存在する場合は、警告を出したうえでキャッシュを使用します。

## CLIの使い方

標準入力からpasteを渡します。

```sh
node src/cli.js --format gen9championsbssregma --month latest --rating 1500 < set.txt
```

Champions OUを既知の年月で実行します。

```sh
node src/cli.js --format gen9championsou --month 2026-04 --rating 1500 < set.txt
```

ファイルからpasteを渡します。

```sh
node src/cli.js --file set.txt --month 2026-04 --rating 1500 --nature optimize --mega never
```

主なオプション:

```text
--month   latest, 2026-04 など
--format  gen9championsbssregma または gen9championsou
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

- `D_out`: サンプル相手への重み付き圧力。純粋な攻撃型では期待与ダメージ、ユーティリティ型では状態異常、設置技、回復、除去、壁、対面操作などの技ベース圧力も含みます。
- `P`: 重み付き先攻確率。
- `V`: 重み付き耐久・行動価値。
- `n`: `E[1 / opponentHP]`。
- `m`: `D_out / offensiveStat` として出す説明用係数。

実装は、隠れた手作業調整よりも、検証可能で決定的なMVP挙動を優先しています。プロファイルはポケモン名ではなく技から推定します。物理型・特殊型では支配劣位の配分を除外します。耐久型・ユーティリティ型では耐久寄りの配分を探索し、混合型では攻撃2軸を代表点に絞り、残りステータスを厳密配分することで、任意paste入力でも応答性を保ちます。

## Smogonデータとキャッシュ

Smogon統計は次から取得します。

```text
https://www.smogon.com/stats/
```

キャッシュは次に保存されます。

```text
src/stats/cache/
```

キャッシュファイルは年月、canonical Smogon format id、レート帯ごとに分離されます。例: `2026-04-gen9championsou-1500.json.gz`。
これらはgit管理対象外です。削除しても問題ありません。次回実行時に再取得を試みます。

OUのcanonical idは `gen9championsou` です。綴り違いの `gen9champoinsou` へ黙ってfallbackしません。canonical統計が対象年月に存在しない場合、その年月は選択formatで利用不可として扱います。

## テスト

```sh
npm test
```

テスト対象:

- Showdown paste 解析。
- Champions Stat Point 制約と実数値計算式。
- `Other` 除外正規化。
- Smogon chaos URL生成、format-aware `latest`、キャッシュfallback、BSS/OU cache分離。
- format、年月、レート帯、unsupported format metadataのconfig validation。
- GUIでformat変更時のrating同期。
- 先攻確率。
- 総合能力指数の式。
- Mega plugin。
- Garchomp回帰。
- Champions OU回帰。
- 混合アタッカーのbounded optimization。
- 技ベースのロール分類と耐久ユーティリティ型の回帰。

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
- OUの完全な合法性、banlist検証、6匹単位のチーム最適化は今回のMVP対象外です。OUでは、選択したOUのSmogon相手母集団を使い、BSSと同じ単体ポケモン用 Champions Stat Point optimizer で評価します。

## トラブルシューティング

PowerShellでnpmがブロックされる場合:

```sh
npm.cmd install
npm.cmd start
```

Smogon更新に失敗する場合、存在が分かっている年月を指定して一度実行してください。

```sh
node src/cli.js --format gen9championsou --month 2026-04 --rating 1500 < set.txt
```

キャッシュが古い場合は、`src/stats/cache/` を削除して再実行してください。
