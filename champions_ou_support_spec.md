# Champions OU対応 改修仕様書 v0.2

作成日: 2026-05-09

## 1. 目的

既存の Champions BSS 専用最適化ツールを、Champions BSS と Champions OU の両方で利用できるようにする。

対象ユーザーは、Pokemon Showdown paste を入力し、Smogon chaos 統計に基づいて Champions Stat Point 配分を比較したい利用者である。BSS と OU は対戦形式が違うため相手母集団は分けるが、単体ポケモンの Stat Point 最適化モデル、出力形式、CLI/GUI 操作は共通に保つ。

## 2. 前提と根拠

### 2.1 確認済みフォーマット

| 用途 | label | canonical Smogon format id | ruleset | default level | rating |
|---|---|---|---|---:|---|
| 既存BSS | `[Gen 9 Champions] BSS Reg M-A` | `gen9championsbssregma` | `Flat Rules` | 50 | `0`, `1500`, `1630`, `1760` |
| 追加OU | `[Gen 9 Champions] OU` | `gen9championsou` | `Standard` | 50 | `0`, `1500`, `1630`, `1760` |

根拠:

- Pokemon Showdown の format 定義に `[Gen 9 Champions] OU` があり、`mod: 'champions'`、`ruleset: ['Standard']` として定義されている。
  - https://github.com/smogon/pokemon-showdown/blob/master/config/formats.ts
- Champions mod の `Standard AG` は `Adjust Level = 50` を含み、`Standard` はこれを継承する。したがってOUも既存のLevel 50 Stat Point式を使う。
  - https://github.com/smogon/pokemon-showdown/blob/master/data/mods/champions/rulesets.ts
- Smogon stats `2026-04/chaos/` に `gen9championsou-{0,1500,1630,1760}.json` と `.json.gz` が存在する。
  - https://www.smogon.com/stats/2026-04/chaos/

### 2.2 採用する暫定解釈

- 正式に扱うOUの format id は `gen9championsou` とする。
- Smogon stats には `gen9champoinsou` という綴り違いのファイルも見えるが、表示フォーマットや通常の利用者入力としては採用しない。canonical id が取得できない場合も typo id へ黙ってfallbackしない。利用者には「選択formatの統計が対象年月に存在しない」と明示する。
- BSSの既定値は維持する。今回の改修で既存ユーザーのデフォルト挙動をOUへ変えない。
- Champions OUはシングル形式として扱う。VGC、Bo3、ダブルバトル、チーム単位の選出最適化は今回の対象外。
- `latest` は「Smogon全体の最新月」ではなく、「選択format/ratingのchaos JSONが存在する最新月」として解決する。Smogon側の月次index更新とformat別ファイル生成のタイミング差を吸収するためである。

## 3. 現状整理

### 3.1 BSS固定になっている箇所

| 領域 | 現状 | 改修要否 |
|---|---|---|
| `src/config/formats.json` | BSS 1件のみ | OUを追加し、format metadataの正にする |
| `src/config/defaults.json` | default format が BSS | 既定値は維持する |
| `src/model/optimizer.js` | 内部 `DEFAULTS.format` が BSS | 既定値は維持しつつ、API/CLIではvalidated configを渡す |
| `src/ui/app.js` | format select はあるが、rating候補は先頭format固定 | format変更時に対象formatのrating候補へ同期する |
| `src/server.js` | configのformatをAPI経由で渡せる | format/month/ratingをvalidationしてから使う |
| `src/stats/smogonClient.js` | `buildChaosUrl` はformat引数を受ける | URL生成、format-aware latest、cache path安全性を検証する |
| `test/smogonClient.test.js` | BSS URLのみ検証 | OU URLを追加する |
| README/仕様書 | BSS前提の記述 | 実装時に両対応表現へ更新する |

### 3.2 共通利用できる箇所

- Showdown paste parser
- Champions Stat Point 制約
- Smogon chaos JSON取得、gzip/JSON fallback、cache path
- `Other` 除外正規化
- 相手サンプル生成
- `P`, `D_out`, `V`, `n`, `m`, `Z` の評価モデル
- Mega policy、Nature policy、setupBoost

## 4. スコープ

### 4.1 対象

- GUIで BSS / OU を選択できる。
- CLIで `--format gen9championsou` を指定できる。
- APIで `format: "gen9championsou"` を受け取り、validation後にOUのSmogon chaos統計を使って最適化する。
- BSSとOUのcacheを混同しない。
- 結果の `format`、`month`、`rating`、`source` が選択フォーマットに対応する。
- BSS既存回帰が維持される。
- 不正な `format`、`month`、`rating` がURL生成やcache path生成へ流れない。

### 4.2 対象外

- OUの使用可能ポケモン、技、道具、banlistの完全な合法性検証。
- チーム単位の6匹最適化、採用率からのチーム相性最適化。
- VGC、ダブル、Bo3、Draftなどの追加format対応。
- 計算式 `Z` の再設計。
- Damage engine の完全シミュレータ化。
- Smogon format一覧の自動クロール。

## 5. 最小リリース単位

最初のリリース単位は「format registry に OU を追加し、既存の単体最適化パイプラインへ選択formatを正しく流す」こととする。

この単位を先に切る理由は、Smogon client と optimizer の大半が既に format 引数で汎用化されており、広い設計変更なしにユーザー価値を出せるためである。OU固有の合法性や6匹最適化は価値はあるが、最初の縦切りには含めない。

## 6. 機能要件

### 6.1 Format registry

`src/config/formats.json` を複数format対応の正とする。`id` は利用者・API入力値、`smogonFormat` はSmogon URL用のcanonical idとする。当面は同じ値にするが、将来表示名や内部idを変えてもSmogon URL生成を壊さないため分けておく。

必要な定義:

```json
[
  {
    "id": "gen9championsbssregma",
    "smogonFormat": "gen9championsbssregma",
    "label": "[Gen 9 Champions] BSS Reg M-A",
    "battleType": "singles",
    "rulesetKind": "flat",
    "defaultLevel": 50,
    "ratings": ["0", "1500", "1630", "1760"]
  },
  {
    "id": "gen9championsou",
    "smogonFormat": "gen9championsou",
    "label": "[Gen 9 Champions] OU",
    "battleType": "singles",
    "rulesetKind": "standard",
    "defaultLevel": 50,
    "ratings": ["0", "1500", "1630", "1760"]
  }
]
```

`battleType` と `defaultLevel` は今回から必須にする。理由は、formatが増えた時点で「この最適化モデルを適用してよいformatか」を機械的に判定できないと、VGCや特殊formatを誤って同じ単体シングルモデルへ流す危険があるためである。

### 6.2 既定値

- `src/config/defaults.json` の `format` は `gen9championsbssregma` のままにする。
- `src/model/optimizer.js` の内部 `DEFAULTS.format` も同じ既定値を保つ。
- ユーザーがformatを指定した場合のみOUを使う。
- server起動時の `/api/config` は `defaults.format` が `formats[].id` に存在することを検証する。存在しない場合は起動時に失敗させ、UIで壊れた既定値を配らない。

### 6.3 GUI

- Format select にBSSとOUを表示する。
- 初期表示時、rating select は `defaults.format` に対応するformatの `ratings` から生成する。`formats[0]` 固定にしない。
- Format変更時、rating select は選択中formatの `ratings` に差し替える。
- 変更前のratingが新formatにも存在する場合は維持する。存在しない場合は、そのformatの既定候補として `1500` を選ぶ。`1500` がなければ先頭を選ぶ。
- Format変更時は再計算する。少なくとも `Calculate` 押下時に正しいformat/ratingが送信されることを保証する。
- 結果summaryには、`result.format` ではなく表示labelもしくは `result.formatLabel` を含める。少なくともOU実行時にBSSと誤認しない表示にする。

### 6.4 CLI

- `node src/cli.js --format gen9championsou --month 2026-04 --rating 1500 < set.txt` がOU統計を使う。
- 既存の `--format gen9championsbssregma` は引き続き使える。
- CLIのオプション説明を更新する。
- format validationは必須とし、許可リストを `src/config/formats.json` から読む。未知formatは早期にエラーにする。
- `month` は `latest` または `YYYY-MM` のみ許可する。
- `rating` は選択formatの `ratings` に含まれる値のみ許可する。

### 6.5 API / server

- `POST /api/optimize` の `format` が `gen9championsou` のとき、`loadChaosStats` に同じformatを渡す。
- stats cache key は既存の `month|format|rating` を維持し、BSSとOUを分離する。
- 起動時primeは既定formatのみでよい。全formatを起動時取得すると初回起動が重くなるため、OUは選択時にlazy loadする。
- API入力は `format`、`month`、`rating`、`megaPolicy`、`naturePolicy`、`setupBoost`、`excludeOther` を型・許可値で検証する。
- validation後のconfigだけを `optimizeFromPaste` と `loadChaosStats` に渡す。

### 6.6 Smogon client

- `buildChaosUrl({ month: "2026-04", format: "gen9championsou", rating: "1500", gzip: true })` は次を返す。

```text
https://www.smogon.com/stats/2026-04/chaos/gen9championsou-1500.json.gz
```

- cache file名は `2026-04-gen9championsou-1500.json` および `.json.gz` とする。
- `gen9championsou` が404のときに `gen9champoinsou` へfallbackしない。canonical idと異なる母集団を黙って混ぜる方が、失敗より危険である。
- `month: "latest"` の場合、Smogon index上の最新月をそのまま使うのではなく、月次indexを新しい順に確認し、対象 `smogonFormat` と `rating` の chaos JSON または JSON gzip が存在する最新月を採用する。
- cache path生成前に、`month`、`smogonFormat`、`rating` はvalidation済みでなければならない。加えて、生成後の絶対pathがcache directory配下にあることをassertする。これはAPI経由のpath traversalを防ぐためである。

### 6.7 Optimizer

- 最適化モデルはBSS/OU共通にする。
- `result.format` は選択formatを返す。
- `result.formatLabel` を返す。UIとCLIは、人間向け表示にlabelを使う。
- `result.month` と `result.rating` は選択formatの統計取得結果に一致させる。
- OU対応のために `legalAllocations`, `coarseDamage`, `estimateDurability`, `totalPowerIndex` を変更しない。
- `format.battleType !== "singles"`、または `format.defaultLevel !== 50` のformatは、このMVP optimizerでは拒否する。

### 6.8 Validation helper

API、CLI、server startup、UI初期化が同じ判定を使えるよう、format validationを小さな純粋関数として切り出す。

想定責務:

- `formats.json` を入力として、format idからmetadataを引く。
- `format` 未指定時はdefaultsを使う。
- `month` は `latest` または `YYYY-MM` のみ許可する。
- `rating` は選択formatの `ratings` 内に限定する。
- `setupBoost` は `0`, `1`, `2` に限定する。
- `megaPolicy` は `auto`, `always`, `never` に限定する。
- `naturePolicy` は `fixed`, `neutral`, `optimize` に限定する。
- 戻り値では `format.id` と `format.smogonFormat` を明確に分ける。

### 6.9 Documentation

実装時には以下を更新する。

- `README.md`: BSS専用表現を BSS/OU 対応へ変更し、OUのCLI例を追加する。
- `README.ja.md`: 同上。
- 既存仕様書を更新する場合は、BSS前提の記述を「初期MVPはBSS」「現在はBSS/OU対応」に分ける。

## 7. 非機能要件

- 既存BSSのテスト結果と出力傾向を変えない。
- ネットワーク失敗時のcache fallbackはformat別に動く。
- UIのformat変更で不整合なratingが送信されない。
- format、month、ratingの不正値で外部URLやcache pathを任意に組み立てられない。
- 追加コードは既存構造を崩さない。大きなformat service抽象は作らないが、validation用の小さな純粋関数は許容する。
- 実装差分はformat追加、validation、format-aware latest、UI同期、その検証に限定する。

## 8. 受け入れ条件

### 8.1 GUI

Given アプリを起動している  
When Format select で `[Gen 9 Champions] OU` を選び、rating `1500` で計算する  
Then API payload の `format` は `gen9championsou` になり、結果summaryまたはレスポンスの `format` も `gen9championsou` になる。

Given `defaults.format` が先頭以外のformatを指している  
When `/api/config` を読み込んでUIを初期化する  
Then rating候補は `defaults.format` の `ratings` から生成される。

### 8.2 CLI

Given Showdown paste を標準入力で渡す  
When `node src/cli.js --format gen9championsou --month 2026-04 --rating 1500` を実行する  
Then Smogon URL は `gen9championsou-1500.json.gz` を参照し、上位配分とShowdown pasteが出力される。

Given `--format unknown` または `--month ../../x` を指定する  
When CLIを実行する  
Then Smogonへリクエストせず、validation errorで終了する。

### 8.3 BSS regression

Given 既存のGarchomp回帰テスト  
When `npm test` を実行する  
Then BSSの結果件数、合法Stat Point、物理/Spe寄りの傾向は維持される。

### 8.4 Cache separation

Given 同じ年月・ratingでBSSとOUを取得する  
When cacheを書き込む  
Then `2026-04-gen9championsbssregma-1500.*` と `2026-04-gen9championsou-1500.*` は別ファイルとして保存される。

Given `format`, `month`, `rating` のいずれかにpath separatorを含む値が渡る  
When cache pathを作る前のvalidationを行う  
Then その値は拒否され、cache directory外にファイルを書けない。

### 8.5 Rating sync

Given GUIでformatを変更する  
When 変更前のratingが変更後formatの候補に存在する  
Then ratingは維持される。  
When 存在しない  
Then `1500` または先頭候補へ自動補正される。

### 8.6 Format-aware latest

Given Smogon全体の最新月に対象formatがまだ存在せず、1つ前の月には存在する  
When `month: "latest"` でOUを計算する  
Then 対象format/ratingが存在する最新月を選び、存在しない月で404失敗しない。

### 8.7 Canonical id

Given `gen9championsou` が404で `gen9champoinsou` が存在する  
When OUを計算する  
Then typo idへfallbackせず、canonical idの統計がないことをエラーとして返す。

## 9. TDDテスト計画

### 9.1 先に追加する失敗テスト

- `smogonClient.test.js`
  - OUのgzip URLを生成できること。
  - `latest` が対象format/ratingの存在する最新月を選ぶこと。
  - canonical idが404でもtypo idへfallbackしないこと。
- `cache.test.js`
  - OU formatでもcache write/readでき、BSSとpathが衝突しないこと。
  - validation済みでないpath separator入り値を拒否すること。
- `regression.test.js`
  - `format: "gen9championsou"` とOU風fixtureで `optimizeFromPaste` が合法結果を返すこと。
- `configValidation.test.js`
  - unknown format、invalid month、invalid rating、unsupported battleType/defaultLevelを拒否すること。
- UIの純粋関数化を行う場合
  - format選択時にrating候補が更新されること。
  - 初期化時に `formats[0]` ではなく `defaults.format` のrating候補を使うこと。

### 9.2 既存テストで守るもの

- paste parser
- Stat Point constraints
- `Other` normalization
- BSS Smogon URL
- speed model
- total power index
- mega plugin
- BSS Garchomp regression
- mixed attacker regression

### 9.3 手動確認

ネットワークが使える環境で、少なくとも以下を確認する。

```sh
npm test
node src/cli.js --format gen9championsou --month 2026-04 --rating 1500 < set.txt
npm start
```

GUIではBSSとOUを切り替え、それぞれ `result.format` と取得ログが一致することを確認する。

## 10. 実装順序

1. OU URLとcache分離の失敗テストを追加する。
2. config validationの失敗テストを追加する。
3. `src/config/formats.json` に `gen9championsou` とmetadataを追加する。
4. CLI/API/server startupにvalidationを通す。
5. Smogon clientをformat-aware latestへ更新し、canonical id以外へsilent fallbackしないことを固定する。
6. GUIのformat変更時rating同期と初期rating生成を実装する。
7. OU regression fixtureを追加する。
8. README英日をBSS/OU対応へ更新する。
9. `npm test` を通す。
10. 手動でCLIとGUIのOU実行を確認する。

## 11. 変更対象予定

実装時に変更する想定ファイル:

- `src/config/formats.json`
- `src/config/defaults.json` 参照整合テストのみ。既定値自体は原則変更しない。
- `src/ui/app.js`
- `src/stats/smogonClient.js`
- `src/cli.js`
- `src/server.js`
- validation helperを置く最小ファイル、または既存config周辺モジュール
- `test/smogonClient.test.js`
- `test/cache.test.js`
- `test/regression.test.js`
- `test/configValidation.test.js`
- `README.md`
- `README.ja.md`
- 必要なら既存仕様書

今回の仕様書作成時点では、上記ファイルは変更しない。

## 12. リスクと判断

| リスク | 判断 |
|---|---|
| Smogon statsに `gen9champoinsou` という綴り違いが存在する | canonical idは `gen9championsou`。typoへsilent fallbackしない |
| UIがformat変更時に古いratingを送る | rating同期を受け入れ条件に入れる |
| OU合法性まで期待される | 今回はformat別メタ母集団の最適化まで。合法性検証は別increment |
| 起動時にOUも取得して遅くなる | 既定formatのみprimeし、OUはlazy load |
| BSS既定が変わる | defaultはBSS維持 |
| API/CLI入力でURL・cache pathを汚染できる | format/month/ratingを許可値・正規表現でvalidationし、cache pathの配下assertも入れる |
| Smogon最新月に対象formatだけまだ無い | `latest` をformat-awareにして、対象format/ratingが存在する最新月を選ぶ |
| 今後VGC等を誤って同じoptimizerへ流す | `battleType` と `defaultLevel` metadataを必須にし、unsupported formatは拒否する |

## 13. Definition of Done

- `formats.json` にBSSとOUが並び、GUIで両方選べる。
- CLIで `--format gen9championsou` が動く。
- format/month/rating validationがAPI/CLIに適用される。
- `latest` が選択format/ratingの存在を見て解決される。
- canonical id以外へのsilent fallbackがない。
- `buildChaosUrl`、cache、optimizer regression、config validationのOUテストがある。
- BSS既存テストが壊れていない。
- `npm test` が成功する。
- README英日がBSS専用表現からBSS/OU対応表現に更新されている。
- 既知の対象外範囲、特にOU合法性検証と6匹最適化が明示されている。

## 14. 改善ループ

### Loop 1: format同一性

観測された失敗:

- `gen9championsou` と `gen9champoinsou` が同じ月に存在するため、最初の戦略の「typoは無視」で済ませる判断は弱い。

更新した仮説:

- 正しい戦略は「canonical idを明示し、typoへsilent fallbackしない」である。

次の修正:

- `formats.json` に `smogonFormat` を明記し、Smogon URLは常にこれを使う。
- canonical idが存在しない場合は明示エラーにする。

追加検証:

- canonical id 404時にtypoへfallbackしないテスト。

合格基準:

- BSS/OUのcanonical URLが生成され、typo idが通常経路に混入しない。

残リスク:

- Smogon側が将来canonical idを変更した場合は、formats.jsonの更新が必要。

### Loop 2: 入力安全性

観測された失敗:

- 最初の戦略ではAPI/CLI入力をそのままURLとcache file名に使う危険を十分に扱っていなかった。

更新した仮説:

- format追加は、同時にformat/month/rating validationを入れないと不完全である。

次の修正:

- formatはregistry内、monthは `latest` または `YYYY-MM`、ratingは選択formatの候補内に限定する。
- cache path生成後にcache directory配下であることをassertする。

追加検証:

- `../../x`、path separator入りformat、未知ratingを拒否するテスト。

合格基準:

- 不正入力ではSmogon requestもcache writeも発生しない。

残リスク:

- paste本文自体の巨大入力制限は別課題。

### Loop 3: UI不整合

観測された失敗:

- 現行UIはrating候補を `formats[0]` から作るため、default formatが先頭でない構成や将来の並び替えで壊れる。

更新した仮説:

- UIは常に選択中formatのmetadataを参照すべきである。

次の修正:

- 初期化時も変更時も `defaults.format` / current formatからrating候補を作る。
- summaryにformat labelを表示する。

追加検証:

- `defaults.format` が先頭以外でもrating候補が一致するテストまたはブラウザ確認。

合格基準:

- GUIから送られる `format` と `rating` が常に同じmetadata由来になる。

残リスク:

- 現行UIはDOM直結なので、純粋関数化しない場合は自動テストが薄くなる。

### Loop 4: latest解決

観測された失敗:

- 最初の戦略では「Smogon全体の最新月」と「選択formatの最新月」を同一視していた。

更新した仮説:

- `latest` はformat-awareに解決しないと、月次更新直後にOUだけ404になる可能性がある。

次の修正:

- 月次indexを新しい順に確認し、対象format/ratingが存在する最新月を選ぶ。

追加検証:

- fake indexで最新月にOUが無く、1つ前にあるケースをテストする。

合格基準:

- `latest` で利用可能な最新OU統計に到達する。

残リスク:

- Smogon index HTML形式が大きく変わると再対応が必要。

### Loop 5: ルール適合

観測された失敗:

- 最初の戦略ではOUのLevel 50適用根拠を十分に仕様化していなかった。

更新した仮説:

- Champions modのrulesetを根拠に、OUでもLevel 50 Stat Point式を使うことを仕様に明記すべきである。

次の修正:

- format metadataに `defaultLevel: 50` を持たせる。
- `defaultLevel !== 50` のformatは拒否する。

追加検証:

- unsupported defaultLevelのformatをvalidationで拒否するテスト。

合格基準:

- 現行optimizerが想定するStat Point式を適用できるformatだけが通る。

残リスク:

- 完全なOU banlist検証は今回対象外。

## 15. 最終判断

v0.1戦略には、format同一性、入力安全性、UI初期化、latest解決、ルール根拠の抜けがあった。v0.2ではこれらを受け入れ条件とテスト計画に格上げしたため、実装戦略としての信頼度は十分に高い。

ただし、数学的な100%は主張しない。残る主要リスクは、Smogon/Pokemon Showdown側の将来変更、OU合法性検証を範囲外にしたこと、UI自動テストの厚みである。これらは今回の最小リリース単位ではなく、明示済みの次バックログとして扱う。

## 16. 次のバックログ候補

1. OU向け合法性検証をPokemon Showdown rulesetに近づける。
2. BSS/OUそれぞれで推奨サンプル数やcoarseTopKを調整できるformat別defaultsを導入する。
3. format一覧をSmogon indexから検出する管理者向け診断コマンドを追加する。
4. paste入力サイズ上限とAPI request body上限を追加する。
