# Garraway FのSNS運用・復旧手順

トヨタ自動車株式会社が運営主体です。株式会社Serendipityのサイト更新担当は、公開が決まった営業案内・イベントを [公式HPの更新手順](../README.md#お知らせイベントの更新) に従って掲載します。運営側でMetaアプリと公式Instagramの管理担当・代理、GitHub PagesとActionsの担当・代理、失敗通知の受信者を確定します。

## Instagramの公開経路

| 段階 | 確認先 | 対応 |
|---|---|---|
| 取得・保存 | [Update Instagram Feed](https://github.com/MDL20241119/GarrawayFapp.github.io/actions/workflows/instagram-feed.yml) と [取得状態](https://github.com/MDL20241119/GarrawayFapp.github.io/blob/main/data/instagram-sync-status.json) | Meta公式APIで `@garrawayf_lounge` とアカウントIDを照合し、通常投稿と画像を検証。一式を同じコミットに保存 |
| 公開 | [Deploy Garraway F website](https://github.com/GarrawayF/garrawayf.github.io/actions/workflows/deploy-pages.yml) と [公開状態](https://garrawayf.github.io/instagram-feed/status.json) | 取得元の同じコミットからJSONと画像を読み、トップの投稿とともにビルド。デプロイ後に公開HTML・JSON・画像のバイト列を照合 |
| 監視 | [Monitor Instagram sync](https://github.com/GarrawayF/garrawayf.github.io/actions/workflows/monitor-instagram-sync.yml) | 定期起動、取得成功、公開反映を独立判定。GitHub全体の停止は別の場所から確認 |

サイト担当は週次で開催予定と掲載内容を照合します。Instagramは別枠で最大4件を掲載します。動画はサムネイル、カルーセルは先頭の画像または動画サムネイルを表示し、残りは元投稿で見られます。公式アカウントが投稿者として通常投稿一覧に返る共同投稿が対象です。共同投稿への招待で掲載されるだけの投稿、タグ付け、Storiesはこの経路の対象外です。停止中は公式アカウントへのリンクから新しい投稿を案内します。

`checked_at` は取得確認、`last_fetch_succeeded_at` は最後に認証と投稿・画像の検証が成功した時刻、`content_updated_at` は内容が変更された時刻、`latest_post_at` は元投稿日時です。公開状態の `published_at` は配信済み成果物の準備時刻です。実際の公開時刻とソースSHAはPagesの実行記録を参照します。障害時は最後の検証済み投稿に短い案内を表示し、取得成功から72時間で投稿欄を外します。最後の取得から12時間以上経過した場合も保存済み表示に切り替えます。

GitHubの定期実行は遅延することがあります。公開処理は取得元の正常スナップショットを次のPages実行で使用します。管理者は必要に応じてPagesを手動実行できます。過去の正常取得は2026年10月27日14:33 JSTで、2026年11月15日17:25 JSTにも同じ失効で失敗しました。 [旧取得の確認](https://github.com/MDL20241119/GarrawayFapp.github.io/actions/runs/43694404234)

## 再認証と期限管理

1. Metaアプリの既存管理者が [Meta App Dashboard](https://developers.facebook.com/apps/) の既存アプリを開きます。Instagram → **API setup with Instagram business login** で、承認済みの `@garrawayf_lounge` がBusiness／Creatorとして登録され、読み取りの `instagram_business_basic` があることを確認します。対象アカウントの **Generate token** で再認証します。Metaがより広い権限や別方式を求める場合は運営主体に内容を確認します。 [Metaの設定手順](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/get-started)
2. 発行した値は [取得元のActions Secrets](https://github.com/MDL20241119/GarrawayFapp.github.io/settings/secrets/actions) の既存 `INSTAGRAM_ACCESS_TOKEN` に直接保存します。`INSTAGRAM_USER_ID` はMetaの `/me` が返すプロアカウントの `user_id` と照合します。最初の自動更新を設定する場合は、Actions Variable `INSTAGRAM_TOKEN_BOOTSTRAPPED_AT` を今回の生成日時のUnix秒に更新します。値や認証URLは担当者の非公開の管理先で扱います。
3. 取得元の **Update Instagram Feed → Run workflow → main** を実行します。認証エラーを記録した後の定期実行は同じ資格情報でのAPI呼び出しを控えます。新しいトークンの検証を手動起動で開始してください。取得成功後、投稿のID・日時・本文・画像・元リンクを公式Instagramの既存投稿と突き合わせ、Pages実行後に公開HTML・画像とPC／スマホを確認します。現在のMetaメディア資料には `caption` に方式別の制約が記載されています。本文のある実投稿で照合できることが受入条件です。 [Metaのメディア仕様](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media)
4. 更新は長期トークンが発行・前回更新から24時間以上経過し、失効前に行います。担当者が既存のGitHub CLI権限を使う場合、取得元の最新 `main` で `python scripts/instagram_credentials.py --force --use-gh-auth` を実行し、保護入力欄に現在の値と照合済みIDを入力します。Metaが返した `expires_in` から期限を計算し、返却されたトークンと期限を1つのActions Secretへ保存します。次回の別実行で `credential.refreshed_at`・`expires_at` が一致し、取得も成功したことを確認します。担当者は確定した期限の15日前に更新します。 [Metaの長期トークン仕様](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login)
5. 自動書き戻しを採用する場合は、運営主体の承認後に、取得元リポジトリだけを対象とする GitHub `Secrets: write` の資格情報を `INSTAGRAM_SECRET_WRITER_TOKEN` に設定します。この権限の対象は取得元の全Actions Secretsです。設定後は、Metaの更新、Secretへの保存、別実行での読込を確認します。書き戻し手段が未設定の場合は担当者が手順4を実施します。 [GitHub Secretsの権限](https://docs.github.com/en/rest/actions/secrets#create-or-update-a-repository-secret)

## 故障時の対応

- **認証・権限**。コード190や期限超過はMeta担当が再認証し、Secret更新後に手動実行します。その後の定期実行を少なくとも1回確認します。権限不足は対象アカウントと読み取り権限を確認します。主担当が不在なら既存の権限を持つ代理が操作します。
- **一時障害**。429・5xx・通信断は上限付きで再試行します。空・不足・不正な一覧や画像エラーが続く場合は取得元ログと元投稿を確認します。削除・非公開化の確認には認証済みの正常な一覧を使います。
- **削除・非公開化**。認証済みの正常な次回一覧で対象が外れると、次回公開から本文と画像が外れます。急ぎの場合は `content/instagram-hidden-posts.json` に対象IDを文字列で追加し、公式HPを再公開します。削除依頼がある場合は旧配信とGit履歴、CDN反映を運営管理者が確認します。
- **公開不一致・ロールバック**。取得元の状態が成功しても、公開状態やHTMLが異なる場合はPagesを確認します。コード起因の場合は該当コミットをrevertして再公開します。保存済み画像とJSONは同じ版を使います。

## 各SNSの現行運用

| SNS | 公式アカウント | 公開経路・運用 |
|---|---|---|
| Instagram | [Garraway F](https://www.instagram.com/garrawayf_lounge/)・[GarrawayF図書館](https://www.instagram.com/garrawayf_toshokan/) | ラウンジのみAPIの対象。公式oEmbedは管理者がURLを把握している個別投稿に利用可能。URLの手動掲載は緊急時の代替 |
| Facebook | [Garraway F](https://www.facebook.com/garrawayf/) | リンク。自動取得はPages用のAPIと認証を個別確認 |
| X | [Garraway F](https://x.com/garraway_f) | リンク。自動取得はX APIの認証・契約を個別確認 |
| note | [Garraway F](https://note.com/garraway_f) | リンク。[公式RSS](https://note.com/garraway_f/rss) から公開記事一覧を取得可能 |
| LINE | [Garraway F](https://line.me/R/ti/p/%40014fhkuy) | 公式アカウントや会員登録のリンク。Messaging APIは公式アカウントの配信・受信に使用 |

現行の公開GitHub Pagesと標準ランナーで運用します。SNSのリンク先が変わった場合は `app/site-links.ts` を編集します。
