# Garraway F 公式ウェブサイト

プレオープン試験公開用のソースです。

- 公開URL: https://garrawayf.github.io/
- 運営主体: トヨタ自動車株式会社
- 運営受託者・サイト更新: 株式会社Serendipity
- 公開元: `main` ブランチをGitHub Actionsで静的ビルドし、GitHub Pagesへ配信

## ローカル確認

```bash
npm ci
npm audit --omit=dev --audit-level=high
npm run lint
npm run build
```

## 更新と復旧

1. ソースを変更し、上記の確認を実行します。
2. `main` への反映で、公開ワークフローが自動実行されます。
3. Actionsの `Deploy Garraway F website` が成功し、公開URLを確認します。
4. 問題時は原因となったコミットをrevertし、直前の正常版を再公開します。

Instagram表示は、旧運用リポジトリで生成した公式アカウントの恒久投稿データのみを参照します。タグ付け投稿とStoriesは掲載しません。表示用画像は最大1080pxに最適化し、内容ハッシュでキャッシュを更新します。アクセストークン等の値はリポジトリへ保存しません。

## 本公開時の確認

- 「プレオープン｜試験公開中」を削除
- `noindex, nofollow` を解除
- トヨタ自動車株式会社の承認記録と掲載内容を最終確認
- 独自ドメイン、メール、DNSを切り替え
