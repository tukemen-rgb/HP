# SALACIA STUDIO — 企業サイト

ゲーム開発スタジオ **SALACIA STUDIO（サラキア・スタジオ）** の公式サイトです。
ビルド不要の静的サイト（HTML / CSS / 素の JavaScript）で、そのままどのホスティングにも置けます。

- タグライン：はじめて海を見た日の気持ちを、まだ知らない物語に。
- コピーの軸：海がくれる三つの感情 — ①息をのむ美しさ ②その先へのわくわく ③あとに残る余韻。
  この順序をトップの Concept、Works の姿勢、代表メッセージで共通して使っています。
- モチーフ：穏やかに輝く海（波＝①）／導きのイルカ（②）／いるか座（③・海から星へ）／陽光の金

---

## ページ構成

| ファイル | ページ | 内容 |
|---|---|---|
| `index.html` | トップ | ヒーロー、コンセプト3項目、スタジオ紹介、作品、お知らせ、お問い合わせ導線 |
| `about.html` | スタジオについて | 代表メッセージ、ブランドストーリー（サラキア神話）、事業内容、スタジオ概要 |
| `works.html` | 作品 | 制作中タイトル、作品づくりの姿勢 |
| `news.html` | お知らせ | お知らせ一覧 |
| `brand.html` | ブランド素材 | ロゴ（ライト／ダーク）、アイコン、カラーパレット、使用ガイドライン |
| `contact.html` | お問い合わせ | 問い合わせフォーム、その他の連絡先 |
| `privacy.html` | プライバシーポリシー | 個人情報の取り扱い |
| `404.html` | 404 | ページが見つからない場合 |

その他：`robots.txt` / `sitemap.xml` / `.nojekyll`（GitHub Pages 用）

```
assets/
  css/style.css        すべてのページ共通のスタイル
  js/main.js           モバイルメニュー、ヘッダー、スクロール表示
  js/contact.js        お問い合わせフォームの送信処理
  img/                 ロゴ・アイコン・OG画像
tools/
  og-image.html        OG画像（1200×630）の元データ
```

---

## ローカルで確認する

ファイルを直接ブラウザで開いても表示できますが、簡易サーバー経由が確実です。

```bash
npx serve .        # または python3 -m http.server 8000
```

---

## 公開前に差し替えるところ

以下は仮の値が入っています。公開前にご確認ください。

### 1. ドメイン

現在は `https://salaciastudio.com/` を仮のドメインとして記載しています。
決まったドメインへ一括置換してください。

```bash
# 例：salacia.studio に変更する場合
grep -rl 'salaciastudio.com' . --include='*.html' --include='*.txt' --include='*.xml' \
  | xargs sed -i 's|https://salaciastudio.com|https://salacia.studio|g'
```

対象：各ページの `canonical` / `og:url` / `og:image` / 構造化データ、`robots.txt`、`sitemap.xml`

> ドメイン・商標（J-PlatPat 第9類・第41類）の確認は未完了です。ブランド検討メモの「残タスク」もあわせてご確認ください。

### 2. メールアドレス

仮に `contact@salaciastudio.com` を記載しています。

- `contact.html`（連絡先・フォーム送信先）
- `privacy.html`（お問い合わせ窓口）
- `index.html`（構造化データ `email`）
- `assets/js/contact.js`（`MAIL_TO`）

### 3. スタジオ概要（`about.html`）

登記前は法人格を名乗れないため（会社法第7条）、名称は「SALACIA STUDIO」のままにしています。
設立日の欄も設けていません。登記完了後に、以下を追加・更新してください。

- 名称 → 法人格つきの商号（例：`合同会社SALACIA STUDIO`）
- 代表者名（ハンドルネーム）
- 必要であれば「設立」の行を追加

プライバシーポリシー末尾の事業者名も、あわせて法人名に更新します。

### 4. お問い合わせフォームの送信先

初期状態では、送信ボタンを押すと**入力内容を本文に差し込んでメールソフトが起動**します
（サーバー不要で受け取れるようにしたフォールバックです）。

フォーム送信サービス（Formspree、Basin など）を使う場合は、
`assets/js/contact.js` の 1 行を書き換えるだけで切り替わります。

```js
var ENDPOINT = "https://formspree.io/f/xxxxxxxx"; // ここに発行された URL を入れる
```

### 5. お知らせの追加

`news.html` と `index.html` の `.news-list` に `<li>` を追加します（新しいものを上へ）。

```html
<li>
  <div class="news-item">
    <time class="news-item__date" datetime="2026-09-01">2026.09.01</time>
    <span class="news-item__tag">Title</span>
    <span class="news-item__title">お知らせの見出し。</span>
  </div>
</li>
```

個別の詳細ページを作る場合は、`div.news-item` を `a.news-item`（`href` 付き）に変えるとホバー表示が有効になります。

### 6. 作品の追加

`works.html` の `.work` ブロックを複製し、`work__title` / `card__text` / `work__meta` を書き換えてください。
スクリーンショットを載せる場合は、`.work__visual` の中身を `<img>` に置き換えます。

---

## 公開（デプロイ）

静的ファイルのみなので、どこでも配信できます。

**GitHub Pages**
リポジトリの Settings → Pages → Source で対象ブランチと `/ (root)` を選択します。
`.nojekyll` を置いているため、`assets/` 以下もそのまま配信されます。
独自ドメインを使う場合は Settings → Pages でドメインを設定してください（`CNAME` ファイルが自動生成されます）。

**Cloudflare Pages / Netlify / Vercel**
ビルドコマンドなし、公開ディレクトリをリポジトリ直下（`/`）に設定します。

**レンタルサーバー**
リポジトリの中身をそのまま FTP でアップロードします。

---

## デザインの前提

| 用途 | 色 |
|---|---|
| 深い海 | `#0B3B57` |
| 海 | `#1C7FA0` |
| 陽に輝く海 | `#35B0C9` |
| 陽光・星（金） | `#F0C86A`（濃色時 `#E0A93F`） |
| 波の泡 | `#EAF6FA` |

- フォント：欧文 **Jost**、和文 **Zen Kaku Gothic New**（Google Fonts）
- 色・余白などの値は `assets/css/style.css` 冒頭の CSS カスタムプロパティにまとめています
- ロゴはフォントと SVG で組んでいるため、拡大しても劣化しません
  （`assets/img/logo-onlight.svg` / `logo-ondark.svg` は外部提供用の書き出し）
- 動きは `prefers-reduced-motion` に対応（設定が有効な環境ではアニメーションを止めます）

### OG画像の再生成

`tools/og-image.html` を 1200×630 で撮影したものが `assets/img/og-image.png` です。

```bash
npx playwright screenshot --viewport-size=1200,630 tools/og-image.html assets/img/og-image.png
```

---

## ライセンス

サイト内の文章・ロゴ・画像等の著作権は SALACIA STUDIO に帰属します。
