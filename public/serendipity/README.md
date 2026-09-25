# Serendipity corporate website

独立した静的サイトです。Garraway F公式サイトとは文章・デザイン・ナビゲーションを分け、Serendipityの思想、仕事、人、知見を掲載しています。

## ページ

- `index.html`：TOP / ABOUT / WHAT WE DO / PROJECTS / JOURNAL / PEOPLE / CONTACT
- `projects/garraway-f/index.html`：Serendipityが担う仕事
- `journal/index.html`：6本の記事の一覧
- `journal/*/index.html`：各記事の本文

## 更新

各HTMLを編集します。共通デザインは `assets/style.css`、スマホメニューは `assets/main.js` です。プロジェクトや記事を増やす場合は、既存の詳細ページをコピーして、トップと一覧からリンクします。ルート・画像・フォントは相対URLなので、このフォルダ単位で別のリポジトリや独自ドメインへ移せます。

## 写真・掲載情報

- 活動写真：ユーザー指定のGarraway F Google Drive写真から選定。白黒表示はCSSで行い、人物・出来事の合成はしていません。
- 佐藤加奈氏の写真：公式サイトの `public/images/people/img_engineer_02-pc.webp` と同一バイナリ。
- 代表者名・肩書・事業領域：ユーザーの指示に基づき掲載。
- 文章：提示された構成をもとに作成。JOURNALは実在のインタビューや発言を捏造せず、運営の考え方として編集した初稿です。本人の発言を引用したものではありません。
- 問い合わせ：現行の公開窓口 `info@garrawayf.com` に、Serendipity宛の件名付きメールを作成します。サイトからの自動送信・個人情報の保存は行いません。専用窓口が決まれば `mailto:` と表示アドレスを同時に変更してください。
- 設立年月日・資本金・本店住所・実績数値は、今回確認できる確定情報がないため掲載していません。

## フォント

Cormorant Garamond と Noto Sans JP（SIL Open Font License）。ライセンスを `assets/` に同梱しています。日本語フォントは掲載文字をローカルで抽出したサブセットです。新たな文字はシステムフォントにフォールバックします。新記事を追加するときは必要に応じてサブセットも更新してください。

## 確認

PC表示、390pxのスマホ表示、スマホメニュー開閉、事業説明の開閉、プロジェクト・記事への移動、メールリンク、9ページの内部リンクと画像・フォント参照を確認。
