# Champions EV Optimizer

Pokemon Champions の Stat Point 配分をローカルで最適化するツールです。

Pokemon Showdown の paste を入力として受け取り、Smogon chaos stats の
`[Gen 9 Champions] BSS Reg M-A` または `[Gen 9 Champions] OU` を取得し、
選択したフォーマットの相手サンプル集合を作ったうえで、
`champions_ev_optimizer_spec.md` の総合能力指数 `Z` に基づいて合法な
Champions Stat Point 配分を順位付けします。

英語版 README は [README.md](README.md) です。

## 主な機能

- `127.0.0.1` のみに bind するローカル GUI。
- 再現しやすい CLI 実行。
- Champions BSS Reg M-A と Champions OU のフォーマット選択。
- format、month、rating、Mega policy、nature policy、setup scenario、
  `Other` 除外の共通 validation。
- Pokemon Showdown paste から species、item、ability、level、nature、
  moves、貼り付け済み Stat Point または EV 風の配分行を解析。
- Champions Stat Point の直接処理。
  - 各 stat: `0..32`
  - 合計: `0..66`
  - 対象 stat: `HP / Atk / Def / SpA / SpD / Spe`
- Smogon chaos JSON の更新確認と、format 別 gzip/JSON ローカル cache fallback。
- `Other` 除外と条件付き割合の再正規化。
- 使用率、特性、持ち物、配分、技から相手サンプルを生成。
- 先攻確率 `P`、与ダメージまたはロール圧力 `D_out`、耐久行動価値 `V`、
  相手 HP 逆数 `n`、説明用係数 `m` を出力。
- 素早さを先に固定し、残りの Stat Point で `Z` を最大化する speed-first optimization。
- paste 内の `EVs`、`SP`、`Stat Points` 行に `Spe` または `S` が明示されていれば、
  その値を固定 Spe 目標として自動採用。Spe が省略されている場合は、Spe 0 固定ではなく
  未入力として通常探索。
- Mega Evolution policy: `auto`、`always`、`never`。
- Z-Move、Dynamax、Terastal 用の plugin stub。
- offensive、mixed、OU、defensive utility profile の回帰テスト。

## 必要環境

- Node.js 20 以上。
- npm。
- 初回取得または Smogon stats 更新時のネットワーク接続。

外部公開用のバックエンドはありません。計算と cache はローカルマシン上に残ります。

## クイックスタート

```sh
npm install
npm start
```

表示されたローカル URL を開きます。

```text
http://127.0.0.1:3000
```

Windows PowerShell で `npm.ps1` がブロックされる場合は、次を使ってください。

```sh
npm.cmd install
npm.cmd start
```

## GUI の使い方

1. 入力欄に Pokemon Showdown set を貼り付けます。
2. BSS または OU、month、rating、Mega policy、nature policy、setup scenario、
   必要なら固定 Spe 目標を選びます。
3. `Calculate` を押します。
4. 結果テーブルと生成された Showdown paste を確認します。

対応フォーマット:

```text
gen9championsbssregma
gen9championsou
```

既定フォーマットは `gen9championsbssregma` です。

Smogon month の既定値は `latest` です。Smogon stats index を確認し、選択フォーマットと
rating の stats が存在する最新月を使います。ネットワーク更新に失敗し、対応する cache が
ある場合は、警告を出したうえで cache を使用します。

## CLI の使い方

標準入力から paste を渡します。

```sh
node src/cli.js --format gen9championsbssregma --month latest --rating 1500 < set.txt
```

既知の月で Champions OU を実行します。

```sh
node src/cli.js --format gen9championsou --month 2026-04 --rating 1500 < set.txt
```

ファイルから paste を渡します。

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
--speed   global または fixed
--spe     --speed fixed で使う Spe Stat Points, 0..32
```

素早さを先に固定してから、残り Stat Point で `Z` を最大化する例:

```sh
node src/cli.js --speed fixed --spe 20 < set.txt
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

paste 内で Spe を指定した場合は、自動的に speed-first optimization の固定 Spe 目標になります。

```text
Garchomp @ Focus Sash
Ability: Rough Skin
Level: 50
EVs: 15 Spe
- Swords Dance
- Earthquake
- Rock Tomb
- Stealth Rock
```

`EVs: 15 S` も同じ意味です。一方、`EVs: 15 Atk` のように Spe/S がない場合、Spe は
0 固定ではなく未入力として扱われ、通常どおり探索されます。

## 出力

上位候補について、次の列を返します。

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

さらに、最上位候補を反映した Showdown paste を生成します。

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

- `D_out`: サンプル相手への重み付き与圧力。純粋な攻撃型では期待ダメージ、utility 型では
  状態異常、設置技、回復、除去、壁、対面操作などの技ベース圧力も含めます。
- `P`: 重み付き先攻確率。
- `V`: 重み付き耐久・行動価値。
- `n`: `E[1 / opponentHP]`。
- `m`: `D_out / offensiveStat` として出す説明用係数。

実装では、隠れた手作業調整よりも、検証可能で決定的な MVP 挙動を優先しています。
profile はポケモン名ではなく技から推定します。物理型・特殊型では支配される配分を枝刈りし、
defensive・utility profile では耐久寄りの配分を探索します。mixed attacker では攻撃軸を
bounded grid にし、残り stat を厳密配分することで、任意の paste 入力でも応答性を保ちます。

`--speed fixed --spe N` を使うと、全ての候補が `Spe N` を維持します。そのうえで、残り予算を
ロールに応じた攻撃・耐久 stat に配分し、説明欄にも固定 Spe の前提を出します。同じ挙動は
`EVs: 15 Spe` や `EVs: 15 S` のような paste 入力からも推論されます。Spe を含まない EV 行は、
通常の global search のままです。

## Smogon データと cache

Smogon stats は次から取得します。

```text
https://www.smogon.com/stats/
```

cache は次に保存されます。

```text
src/stats/cache/
```

cache ファイルは、month、canonical Smogon format id、rating ごとに分かれます。
例: `2026-04-gen9championsou-1500.json.gz`。これらは git 管理対象外です。
削除しても問題ありません。次回実行時に再取得を試みます。

OU の canonical id は `gen9championsou` です。typo の `gen9champoinsou` には黙って
fallback しません。対象月に canonical stats が存在しない場合、その月は選択フォーマットで
利用不可として扱います。

## テスト

```sh
npm test
```

テスト対象:

- Showdown paste 解析。
- Champions Stat Point 制約と stat 計算式。
- `Other` 除外の再正規化。
- Smogon chaos URL 生成、format-aware `latest`、cache fallback、BSS/OU cache 分離。
- format、month、rating、unsupported format metadata の config validation。
- 固定 Spe validation と speed-first optimization 挙動。
- paste から推論される Spe 目標と、Spe 未記入を未入力として扱うケース。
- GUI の format 変更時 rating 同期。
- 先攻確率。
- 総合能力指数の式。
- Mega plugin 挙動。
- Garchomp 回帰挙動。
- Champions OU 回帰挙動。
- mixed attacker の bounded optimization。
- move-based role profile coverage と defensive utility 回帰挙動。

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

## 現在の制限

- ダメージ計算は MVP 近似です。Pokemon data、技威力、タイプ相性、STAB、一部持ち物、
  一部特性を使いますが、完全なバトルシミュレータではありません。
- 天候、フィールド、場の状態、未発動状態、チーム単位制約は限定的です。
- 単体 paste から、チーム内で誰が Mega Evolution 権を使うかまでは確定できません。
  別の Mega 枠がいる場合は `--mega never` でも比較してください。
- OU の完全な合法性、banlist 検証、6体単位のチーム最適化は今回の MVP 対象外です。
  OU では、選択した OU Smogon 相手母集団を使い、BSS と同じ単体用 Champions Stat Point
  optimizer で評価します。

## トラブルシューティング

PowerShell で npm がブロックされる場合:

```sh
npm.cmd install
npm.cmd start
```

Smogon 更新に失敗する場合は、存在することが分かっている特定月を指定して一度実行してください。

```sh
node src/cli.js --format gen9championsou --month 2026-04 --rating 1500 < set.txt
```

cache が古い場合は、`src/stats/cache/` を削除して再実行してください。
