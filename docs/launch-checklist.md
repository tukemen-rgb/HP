# 公開前チェックリスト

サイトの中身は完成しています。ここに残っているのは、**人にしかできない手続き**と、
その結果をサイトへ反映する作業です。

自動で判定できる項目は `npm run check` が見ています。手動の項目だけ、ここで管理します。

```bash
npm run check      # 静的チェック（リンク、meta、禁止語、差し替え残り）
npm run visual     # ブラウザでの表示チェック（横スクロール、JSエラー、キーボード操作）
npm run verify     # 上の2つをまとめて実行
npm run shots      # 全ページのスクリーンショットを .preview/ に保存
npm run build:og   # OG画像を再生成
npm run serve      # http://localhost:4173 でローカル確認
```

---

## 1. ドメイン

- [ ] 空き確認（`sidrastudio.com` / `sidra.studio` / `sidra.games` など）
- [ ] 取得
- [ ] DNS をホスティング先に向ける
- [ ] サイト内の仮ドメインを一括置換

```bash
grep -rl 'sidrastudio.com' . --include='*.html' --include='*.txt' --include='*.xml' --include='*.js' \
  | xargs sed -i 's|sidrastudio\.com|取得したドメイン|g'
npm run check   # 「仮ドメイン」の指摘が消えることを確認
```

対象：各ページの `canonical` / `og:url` / `og:image` / 構造化データ、`robots.txt`、`sitemap.xml`、`assets/js/contact.js`

## 2. メールアドレス

- [ ] `contact@ドメイン` を受信できる状態にする
- [ ] サイト内の仮アドレスを差し替え（上の置換で同時に変わります）
- [ ] 実際に届くか、自分宛てにテスト送信

## 3. 商標

- [ ] [J-PlatPat](https://www.j-platpat.inpit.go.jp/) で「SIDRA」「シドラ」を検索
  - 第9類（ゲームソフト）
  - 第41類（ゲーム・娯楽の提供）
- [ ] 海外展開を見込むなら [USPTO](https://www.uspto.gov/trademarks/search) も確認

> SIDRA はスペイン語で「シードル（りんご酒）」の意味があります。
> 飲料の区分に既存商標がある可能性が高いので、第9類・第41類での確認が要ります。

## 4. お問い合わせフォーム

- [ ] 送信方法を決める
  - そのまま：送信ボタンでメールソフトが起動（サーバー不要）
  - フォームサービス：`assets/js/contact.js` の `ENDPOINT` に URL を設定
- [ ] 実際に送信して、届くことを確認

## 5. SNS

- [ ] アカウント作成（X / Discord / YouTube など）
- [ ] URL を `contact.html` の連絡先とフッターに追加
- [ ] プロフィール画像に `assets/img/icon-square.svg` を使用

## 6. ホスティング

- [ ] 公開先を決める（GitHub Pages / Cloudflare Pages / Netlify / レンタルサーバー）
- [ ] デプロイ設定（ビルド不要、公開ディレクトリはリポジトリ直下）
- [ ] HTTPS の有効化
- [ ] 独自ドメインの割り当て

## 7. 公開直前の最終確認

- [ ] `npm run verify` が通る
- [ ] 実機（スマートフォン）で表示を確認
- [ ] OGP のプレビュー確認（[X Card Validator](https://cards-dev.twitter.com/validator) など）
- [ ] `sitemap.xml` の `lastmod` を公開日に更新

---

## 登記が終わったあとに反映すること

法人登記の前は、会社法第7条により法人格を名乗れません。
現在は「SIDRA STUDIO」表記のみで、設立日の欄も設けていません。

- [ ] スタジオ概要の「名称」を法人格つきの商号へ（例：`合同会社SIDRA STUDIO`）
- [ ] 「代表者」欄にハンドルネームを記入
- [ ] 必要であれば「設立」の行を追加
- [ ] `privacy.html` 末尾の事業者名を法人名に更新
- [ ] 見出しを「スタジオ概要」から「会社概要」に戻すかどうか判断

---

## 自動チェックが見ている項目

`npm run check`

- 内部リンクと参照ファイルの存在
- HTML タグの開閉
- `title` / `meta description` / `viewport` / `lang` の有無
- `canonical` / `og:title` / `og:image` の有無
- `img` の `alt`
- `h1` の個数
- 仮ドメイン・仮メールアドレス・未記入欄の残り
- 使わないと決めた語（革新／こだわり／運営人数に触れる表現／旧ブランド語）
- `sitemap.xml` と実ページの対応
- OG画像が元データより古くなっていないか

`npm run visual`

- JavaScript のエラー
- 横スクロールの発生（320 / 768 / 1440px）
- キーボードによるモバイルメニューの開閉
- 極端に小さい文字
