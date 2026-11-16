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

ホーム下部もフロア・SNS・アクセス・相談欄・フッターをPC／スマホで追加確認した。追加10組の本文・寸法・位置は一致し、9組は画像も完全一致。PCの相談欄だけ144万画素中7画素の差があり、文字の輪郭描画の揺れと推定した。下部比較では遅延描画のスクロール位置が変動するため、ブラウザー内だけでcontent-visibilityを表示状態にし、ローカル画像を先に読み込んだ。アプリのソース変更はない。初期画面18組の比較は通常の描画設定で実施している。

## 維持範囲と公開条件

HP本文・イベントアプリ・API接続先・認証・CSP・CI・公開設定のソースは変更していない。変更はpackage.json、package-lock.json、本レポートに限定。業務ロジックの回帰はモックで確認し、実環境の申請・メール・カレンダー登録は実行していない。運用APIのエンドツーエンド試験は今回の実施範囲外。

ドラフトPRのまま結果を報告し、ユーザーが公開を指示するまではmainへマージしない。現在の監査0件は実施時点のnpm advisory databaseに対する結果であり、将来の指摘を保証するものではない。

## 2026-10-27 再確認（今回の依頼）

同一作業の既存ドラフトPR #13を引き継ぎ、重複する依存変更は追加していない。取得時のmainは引き続き `b7a1975382fd79fd7cbe91a78cbbf63a5d92e29d`、検証した修正は `f7420bfb08c306378425c3b48d7152e3bbf8b3de`。初期チェックアウトの未コミット・未追跡変更は0件。最終差分は引き続きpackage.json、package-lock.json、本レポートのみ。

### 依存と実行経路の再照合

`dev`はNext、`build`/`build:github`はNext webpackによる静的export。公開先にNode・Vite・Workersの常駐サーバーはない。CIはmainのpush・定期・手動実行だけで、ドラフトPRの更新は公開を開始しない。

| 削除した開発用の直接依存 | 間接参照・削除の根拠 |
|---|---|
| vinext | ソース・ビルド設定・CIから参照されない |
| vite | 削除対象のCloudflare/Vite/Vinext系およびその配下だけがpeer参照。実際のNextビルド経路では使わない |
| @cloudflare/vite-plugin | 使用設定・importなし。wranglerを依存・peerで参照していた入口 |
| wrangler | @cloudflare/vite-plugin配下と直接指定に限られ、Workersの設定・デプロイ経路なし |
| @vitejs/plugin-react | vinextからのpeer参照に閉じ、Nextのwebpack設定から使われない |
| @vitejs/plugin-rsc | vinextからのpeer参照に閉じ、RSC plugin設定なし |
| react-server-dom-webpack | @vitejs/plugin-rscとvinextのpeer参照に閉じる。Next内部のRSC実装と区別し、Next自体は維持 |
| drizzle-kit | 設定・スクリプト・CI・ソースに参照がなく追加削除。drizzle-ormを削除する変更はしていない |

修正後lock内にはこの8パッケージのレコードが0件。必要な間接依存4系統は開発用のまま修正版へ更新し、既存の指定範囲内で依存閉包を整合している。公式の修正版・影響範囲も再確認した：[Babel](https://github.com/babel/babel/security/advisories/GHSA-4x5r-pxfx-6jf8)、[brace-expansion](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr)、[Browserslist](https://github.com/browserslist/browserslist/security/advisories/GHSA-c83g-rgw3-j3cx)、[js-yaml](https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh)。共有するブラウザー情報データ2件が実行用lockにも含まれる点は、上記の更新表・説明のとおり。

### 今回実行した検証

CIと同じNode 22.13.0／npm 10.9.2を使用。mainと修正側を別の作業ツリーでクリーンインストールし、同一の連携コンテンツ `09206a6218012278077a79514a86675abe24441b` をCIの手順で組み立てた。航空ダイヤのオンライン更新・配信・公開版への運用API試験は実行していない。

| 項目 | 今回の結果 |
|---|---|
| クリーンインストール | main・修正側とも成功。修正側538パッケージ |
| npm ls --all | 成功、依存不整合なし |
| 全依存の監査 | main 19件（Critical 0／High 13／Moderate 5／Low 1）→修正側0件 |
| 実行用依存の監査 | main・修正側とも0件 |
| lint | 両方エラー0・既存警告34件。検査設定・除外・警告レベルは変更なし |
| TypeScript noEmit・ビルド・CI静的スモーク | main・修正側とも成功 |
| 既存回帰 | Python39件、申請・再開・同意・認証・通信等のNodeモック回帰、RAMEN Node3系統・時刻表269行、九州Python5件、JS構文7件が成功 |
| 公開資産 | 215ファイルすべて生成結果とSHA256一致。Nextが生成したCSS3件も変更前後で一致 |
| PC・スマホ幅のブラウザー表示 | 9画面×2幅、18組の本文・最終寸法・PNGが一致。表示中の画像切れ・横はみ出しなし |
| ページ遷移 | PCのEVENTSリンク、スマホメニュー開閉・EVENTSへの遷移を確認 |
| PDF | 生成済みガイドのPDF署名・内容の一致を確認。今回のプレビューURLからの取得はexecutorとブラウザーのダウンロード待機でタイムアウトし、配信取得の再確認は未完了 |

今回の表示確認は、実ブラウザー内の同一オリジンiframeを1280×900／390×844に設定したレスポンシブ確認。実機・タッチ端末のエミュレーションとは区別する。スクロールバーのある画面の内側の幅はその分だけ小さい。管理ログインのスマホ幅だけ初回にスクロールバー有無による寸法差があったため、接続遮断後の案内表示とdocumentの読み込み完了を待ち、再比較してPNGも一致した。該当するHTML・CSS・JSは変更前後でバイト単位に同一。QA用コピーにだけ外部通信を拒否するCSPと比較用ファイルを加え、リポジトリや配信用生成物には混入させていない。

### 残件・公開境界

Critical／Highを含むnpm監査の残件は0件。既存lint警告34件は本作業の依存整理で増加していない。API契約は実際のURL・要求形式・認証境界・再試行等を既存モックで検証し、運用APIの接続、ログイン後の実データ、メール送信、実申請、カレンダー更新は実施していない。外部フォント・Facebook埋込みの実配信、Safari、実機も未確認。PDF取得の再確認には、ダウンロードが利用できる通常ブラウザーまたは公開承認後の実URLでの確認が必要。

HP内容・デザイン・アプリ実装・認証・公開範囲・DNS・既存データ・API設定・CIは変更していない。mainへのマージ・本番への再デプロイは未実施。ユーザーが今回の結果を確認して公開を承認するまでドラフトPRのまま維持する。
