# Garraway FのSNS運用・復旧手順

## 公式案内の公開

株式会社Serendipityは公開用の情報を [公式HPの更新手順](../README.md#お知らせイベントの更新) に従って編集し、GitHub Pagesの公開結果を確認します。公開可否は既存の運営フローに従います。トヨタ自動車株式会社が運営主体です。更新担当と代理の個人名、GitHub Actionsの通知受信者は運営側で確認します。

| 事象 | 確認先 | 対応 |
|---|---|---|
| 営業案内・イベントの掲載や変更 | 公式HPトップとイベントページ | 公開決定後にHPの掲載データを編集。日時、会場、申込先を確認 |
| HPの公開失敗 | 公式リポジトリの `Deploy Garraway F website` | ビルド、公開、公開後照合の各ステップを確認。入力エラーは修正し、障害時は直前の正常版からやり直す |
| SNSの表示やリンク先の異常 | 各公式アカウントの個別リンク | Instagram、Facebook、X、note、LINEの経路ごとに切り分け。リンク変更時は `app/site-links.ts` を編集 |

現行の公開GitHub Pagesと標準ランナーを使う範囲で、追加のサービス利用料は0円です。編集と週次照合の作業時間は必要です。最初の1か月は、公開が決まった情報の掲載漏れと日時・中止変更にかかった反映時間を記録します。

## Instagramの取得履歴

旧取得元の最後に確認できた正常取得・保存は **2026年10月27日14:33:25 JST**。最新の保存投稿は **同日14:08:08 JST** です。**11月14日7:08 JST** に始まった取得は、10月27日16:56:55 JSTに失効した認証で `OAuthException 190` を返しました。

- [最後の正常取得](https://github.com/MDL20241119/GarrawayFapp.github.io/actions/runs/40455962887)
- [11月14日の失敗](https://github.com/MDL20241119/GarrawayFapp.github.io/actions/runs/43516839039)
- [旧取得ワークフロー](https://github.com/MDL20241119/GarrawayFapp.github.io/actions/workflows/instagram-feed.yml)

公式HPから旧取得元のSNSデータ・画像・状態の取り込みを外しています。旧ワークフローを停止する場合は、権限のある既存担当が Actions の「Update Instagram Feed」メニューで Disable workflow を選びます。これで旧リポジトリへの新しいコミットを伴わずに停止できます。停止中は手動実行も止まります。最後に確認した定期実行の主体は `MDL20241119` です。実際の通知の受信者・受信設定は運用担当が確認します。再有効化した利用者が以降の定期実行通知の対象になる場合があります。 [GitHubの停止手順](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows) [通知の仕様](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)

## 自動取得の再開を決めた場合

1. 既存Metaアプリの管理者と代替担当を決め、Instagram Login、プロアカウント `garrawayf_lounge`、読み取り権限 `instagram_business_basic` をダッシュボードで照合します。現行コードは `graph.instagram.com` を使用しており、ダッシュボードの権限と実効APIバージョンは管理者による確認が必要です。
2. 失効時は管理者がMetaの公式画面で再認証し、取得環境のGitHub Actions Secretsへ直接登録します。長期トークンの有効期間は60日です。発行後24時間以上かつ失効前なら更新できます。発行日・有効期限を担当者の非公開の管理先に記録し、45日目を目安に更新し、更新後の値と期限を保存します。トークン、認証URL、個人情報をチャット、ログ、リポジトリに記録しません。 [Metaの認証仕様](https://developers.facebook.com/documentation/instagram-platform/overview) [長期トークンの更新](https://developers.facebook.com/documentation/instagram-platform/reference/refresh_access_token)
3. `/me` でユーザーIDとアカウント名を照合し、`/media` の投稿日時、パーマリンク、保存した画像とそのハッシュを照合します。公開HPへの表示は別の確認項目です。公式HPと切り離した取得を検証してから、補助表示を追加するかを判断します。
4. 補助表示を追加する場合は最終正常取得時刻と投稿時刻を区別します。失効や権限エラーは担当者へ回し、429・5xx・タイムアウトは上限付きで再試行します。画像欠落やデータなしの場合もアカウントへのリンクを使えます。元投稿が削除・非公開になった場合の削除手順と、認証失敗・取得途絶の通知先を運用開始前に確認します。 [Metaの利用条件](https://developers.facebook.com/terms/)

URLが分かっている公開投稿は、公式のoEmbedによる個別表示が可能です。自動で投稿一覧を取得する場合は認証済みの投稿一覧APIを使います。 [Meta oEmbed](https://developers.facebook.com/documentation/instagram-platform/oembed) [投稿一覧APIの手順](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/get-started)
