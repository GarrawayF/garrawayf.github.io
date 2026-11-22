# X-meetup品川 ディスカッションアプリ

このフォルダーに画面のソースを、../board/assets/ にスライド・QR画像を置いています。画像はそのまま配信とビルドの両方に使います。

Node.js 22.13以降でこのフォルダーを開き、初回に `npm ci`、画面を変更したら `npm run build` を実行してください。隣の `../board/index.html` と `../board/assets/app.js`、`app.css` が更新されます。単体で配布する場合は `npm run build:html` で `../board/discussion.html` を生成します。

公開ページの `?room=demo` は練習用です。画面・画像はGitHub Pagesで配信し、投稿やコメントの保存・同期には既存のWorkerを使います。
