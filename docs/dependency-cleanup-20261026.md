# Garraway F 依存整理・公開前検証（2026-10-26）

公開待ち。mainへの反映、GitHub Pagesの配信、実申請、メール送信、運用APIの呼び出しは実行していない。

## 基準と削除判断

- 対象：`GarrawayF/garrawayf.github.io`
- 基準：最新main `b7a1975382fd79fd7cbe91a78cbbf63a5d92e29d`。確認開始時、この環境に既存のGarraway Fチェックアウトはなく、取得した作業ツリーの未コミット・未追跡変更は0件。別の端末・Workにだけ存在する未共有変更は確認対象外。
- ソース、設定、package scripts、README、CI、未追跡ファイルを照合。次の8依存はマニフェスト以外に参照がなく、Vite・Cloudflare Workers・Drizzleの設定もない。
- 実行経路は`next dev`／`next build --webpack`による静的export → GitHub Pages。CIは公開用mainのpush・定期実行・手動実行で配信する。今回のドラフトPR更新は配信を起動しない。

削除：`vinext`、`vite`、`@cloudflare/vite-plugin`、`wrangler`、`@vitejs/plugin-react`、`@vitejs/plugin-rsc`、`react-server-dom-webpack`。追加で、同様に未使用かつ監査指摘の入口となっていた`drizzle-kit`も削除。`drizzle-orm`を含む実行用の直接依存は維持。

独立した`react-server-dom-webpack`は削除候補間のpeer参照に閉じており、Next本体の外部依存ではない。Nextが内部に持つRSC実装は維持する。

## 修正更新とlock

Node 22.13.0／npm 10.9.2（CIと同じ）でlockを更新。`npm audit fix --force`、新規override、lintの降格・監査除外は使用していない。

| 必要な間接依存 | 更新前 | 更新後 |
|---|---|---|
| @babel/core | 7.29.0 | 7.29.7 |
| brace-expansion | 1.1.14／5.0.6 | 1.1.21／5.0.12 |
| browserslist | 4.28.2 | 4.29.4 |
| js-yaml | 4.1.1 | 4.3.2 |

Babel関連16レコードとBrowserslist関連の依存閉包も既存の互換範囲内で更新。lockは292パッケージレコードを削除し、追加レコード0、バージョン更新25レコード。Nextと開発ツールで共有するブラウザー情報データ2件（`baseline-browser-mapping` 2.11.26→2.11.33、`caniuse-lite` 1.0.30001793→1.0.30001819）も更新するため、実行用lockに変更がないとは主張しない。さらに6レコードはバージョンを保ちoptional/devOptional分類のみ変わる。

Next 16.4.2、React／React DOM 19.2.6、Zod 4.6.6、既存`fast-uri` override 3.1.9を維持。既存PR #13の古いmanifest/lockはそのまま再利用せず、最新main上に整理を適用し直し、既存ドラフトへ統合した。

旧PRに記載されていたbracesの未修正指摘は、公式[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)が2026-10-23に取り下げられているため、今回の残件には含まれない。

## 検証結果

| 検証 | 結果 |
|---|---|
| 空のnode_modulesから`npm ci --no-fund` | 成功、538パッケージをインストール |
| `npm ls --all --json` | 成功、不整合なし |
| `npm audit --json` | 全依存0件（変更前19件：high13／moderate5／low1） |
| `npm audit --omit=dev --json` | 実行用依存0件 |
| `npm run lint` | エラー0。通常ソース25警告、CIの追加コンテンツ込み34警告。変更前のCI相当も34警告で増加なし |
| `tsc --noEmit` | 成功 |
| `npm run build` | Next webpack静的export成功、生成時の型検査も成功 |
| 既存Python unit tests | 39件成功 |
| 申請・再開・同意・認証・通信の既存モック回帰 | 成功。重複抑止、タイムアウト、同一キー再試行、遅延応答等を検証 |
| RAMEN TECH既存Nodeテスト | 3系統成功（269時刻表行、データ整合、保存データ移行、画面操作） |
| 九州特集・JS構文検査 | Python5件、JS7ファイル成功 |
| CIの静的出力スモーク | 成功。配信・実API確認の工程は実行していない |
| 公開資産の内容照合 | コピー対象215ファイルのSHA256が全件一致 |
| 変更前後のCSS | 3ファイルすべてSHA256一致 |
| PC・スマホ実ブラウザー | Chromium 141、1440×1000／390×844。9画面×2サイズの変更前後18組はviewport画像・本文・寸法が全件一致。JS実行エラー・ローカルHTTP失敗・表示画像切れ・横はみ出し0件 |

CIの別リポジトリからのコンテンツ取込みも隔離ビルドで再現した。連携元：`MDL20241119/GarrawayFapp.github.io@09206a6218012278077a79514a86675abe24441b`。CIと同じURL置換、旧画像の除去、ガイド展開、ライブガイド準備、九州ページ生成を適用。オンライン航空ダイヤ更新は行わず既存の日付入りスナップショットを使用した。

ブラウザーではホーム、イベント、問い合わせ、プライバシー、申請開始、申請再開、管理ログイン、申請者ガイド、管理ガイドの認証入口を確認した。スマホメニューからイベント一覧への遷移と、申請者ガイドPDFのローカル取得（HTTP200・PDF署名）も成功。時刻・画面条件を固定し、外部通信をすべて遮断した。管理画面が自動的に開始するinit要求もブラウザー側で遮断し、運用サーバーへ到達させていない。外部フォントとFacebook埋込みの配信状態、ログイン後の実データ画面、Safari・実機端末は今回の確認対象外。

## 維持範囲と公開条件

HP本文・イベントアプリ・API接続先・認証・CSP・CI・公開設定のソースは変更していない。変更はpackage.json、package-lock.json、本レポートに限定。業務ロジックの回帰はモックで確認し、実環境の申請・メール・カレンダー登録は実行していない。運用APIのエンドツーエンド試験は今回の実施範囲外。

ドラフトPRのまま結果を報告し、ユーザーが公開を指示するまではmainへマージしない。現在の監査0件は実施時点のnpm advisory databaseに対する結果であり、将来の指摘を保証するものではない。
