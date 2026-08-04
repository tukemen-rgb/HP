# SIDRA STUDIO — 企業サイト

ゲーム開発スタジオ **SIDRA STUDIO（シドラ・スタジオ）** の公式サイトです。
ビルド不要の静的サイト（HTML / CSS / 素の JavaScript）で、そのままどのホスティングにも置けます。

- パーパス：クリエイターが、より活躍できる環境づくり。
- 社名の由来：いろんなクリエイターがそれぞれ輝ける場所をつくりたい、という考えから。
- モチーフ：一番星（最初に灯った光）／星々（それぞれのクリエイター）／
  アンダーライン（星々が並ぶ場所＝スタジオ）
- ビジョン：つくり手が「ここでなら力を出しきれる」と言う場所になる。
  （外への展開よりも、まず一社を育てきる）
- バリュー：①考えるより、まず動かす ②大きな決断ほど、ゆっくり
  ③つくる時間を、何より守る
- 掲載場所：トップの Purpose / Vision / Values セクション、
  スタジオについて の代表メッセージ内

### 事業

| # | 事業 | 状態 |
|---|---|---|
| 01 | GAMEYARD の運営（クリエイター向けサービス） | 準備中 |
| 02 | ゲームの企画・開発（受託・共同開発を含む） | 第一作を制作中 |
| 03 | アプリケーションの開発 | — |

**理念は2階層です。**混ぜないでください。

- **会社（SIDRA STUDIO）** … Purpose / Vision / Values
  トップページと `about.html` の代表メッセージに掲載
- **サービス（GAMEYARD）** … Mission / Vision / Core Value
  トップページの GAMEYARD セクションと `about.html#gameyard` に掲載。
  トップは3つの宣言だけ、`about.html` に「目指す世界」と「育てたいもの」を置いています

会社側は「つくる人が力を出しきれる環境をつくる」、
サービス側は「創造する人が育ち、その人がまた次を育てる」。
同じ方向を向いていますが、主語が違います。

---

## ページ構成

| ファイル | ページ | 内容 |
|---|---|---|
| `index.html` | トップ | ヒーロー、パーパス／ビジョン、バリュー3項目、作品、お知らせ、お問い合わせ導線 |
| `about.html` | スタジオについて | 代表メッセージ、社名について、事業内容、スタジオ概要 |
| `works.html` | 作品 | 制作中タイトル、作品づくりの姿勢 |
| `news.html` | お知らせ | お知らせ一覧 |
| `brand.html` | ブランド素材 | ロゴ（ライト／ダーク）、アイコン、カラーパレット、使用ガイドライン |
| `contact.html` | お問い合わせ | 問い合わせフォーム、その他の連絡先 |
| `privacy.html` | プライバシーポリシー | 個人情報の取り扱い |
| `404.html` | 404 | ページが見つからない場合 |
| `news/_template.html` | お知らせ詳細の雛形 | 記事1本ぶんの型（noindex。コピーして使う） |

その他：`robots.txt` / `sitemap.xml`（自動生成）/ `.nojekyll`（GitHub Pages 用）

`sitemap.xml` は手で書きません。`npm run verify` の最初に
`tools/build-sitemap.mjs` が走り、HTML の実体から組み立て直します。

- `noindex` のページは載りません
- `lastmod` は、そのファイルを最後に変更したコミットの日付
- URL は各ページの `canonical` から取るので、ドメインを変えてもスクリプトは直さなくて大丈夫です
- 検索結果での重みは `tools/build-sitemap.mjs` の `PRIORITY` にまとめています

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

現在は `https://sidrastudio.com/` を仮のドメインとして記載しています。
決まったドメインへ一括置換してください。

```bash
# 例：sidra.studio に変更する場合
grep -rl 'sidrastudio.com' . --include='*.html' --include='*.txt' --include='*.xml' \
  | xargs sed -i 's|https://sidrastudio.com|https://sidra.studio|g'
```

対象：各ページの `canonical` / `og:url` / `og:image` / 構造化データ、`robots.txt`、`sitemap.xml`

> ドメイン・商標（J-PlatPat 第9類・第41類）の確認は未完了です。ブランド検討メモの「残タスク」もあわせてご確認ください。

### 2. メールアドレス

仮に `contact@sidrastudio.com` を記載しています。

- `contact.html`（連絡先・フォーム送信先）
- `privacy.html`（お問い合わせ窓口）
- `index.html`（構造化データ `email`）
- `assets/js/contact.js`（`MAIL_TO`）

### 3. スタジオ概要（`about.html`）

登記前は法人格を名乗れないため（会社法第7条）、名称は「SIDRA STUDIO」のままにしています。
設立日の欄も設けていません。登記完了後に、以下を追加・更新してください。

- 名称 → 法人格つきの商号（例：`合同会社SIDRA STUDIO`）
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

本文のある記事にする場合は、`news/_template.html` を
`news/2026-09-01-xxxx.html` のような名前でコピーし、ファイル冒頭のコメントの手順に従って
【 】の箇所を書き換えます。あわせて一覧側の `div.news-item` を
`a.news-item`（`href="news/ファイル名.html"`）に変えると、リンクとホバー表示が有効になります。

一覧だけで完結する短いお知らせは、詳細ページを作らず `div.news-item` のままで構いません。

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

### セキュリティヘッダー

`docs/hosting/` に `_headers`（Cloudflare Pages / Netlify）、`netlify.toml`、
`.htaccess`（Apache）のひな形があります。**公開先が決まってから**
該当するものをリポジトリ直下にコピーしてください。置いた時点で効きます。

`Strict-Transport-Security` は一度送るとブラウザが期間中おぼえて取り消せないので、
HTTPS が問題なく動くのを確認してからコメントを外します。
詳細は `docs/hosting/README.md` にまとめています。

---

## デザインの前提

| 用途 | 色 |
|---|---|
| 深い夜空 | `#0B3B57` |
| 夜明けの空 | `#1C7FA0` |
| 明けの光 | `#35B0C9` |
| 星の光（金） | `#F0C86A`（濃色時 `#E0A93F`） |
| 星あかり | `#EAF6FA` |

明るい背景に**文字**を置くときだけ、少し濃い版を使います。
ブランドの色をそのまま文字にすると、白地でのコントラスト比が
夜明けの空 4.38:1、星の光 2.12:1 で、WCAG AA（4.5:1）に届かないためです。
面（背景・枠線・下線・ロゴ）はブランドの値のままです。

| 用途 | 色 | 白地でのコントラスト比 |
|---|---|---|
| 文字用の夜明けの空 `--sea-ink` | `#1A7896` | 5.03:1 |
| 文字用の星の光 `--gold-ink` | `#8F6409` | 5.26:1 |

- フォント：欧文 **Jost**、和文 **Zen Kaku Gothic New**（Google Fonts）
- 色・余白などの値は `assets/css/style.css` 冒頭の CSS カスタムプロパティにまとめています
- ロゴはフォントと SVG で組んでいるため、拡大しても劣化しません
  （`assets/img/logo-onlight.svg` / `logo-ondark.svg` は外部提供用の書き出し）
- 動きは `prefers-reduced-motion` に対応（設定が有効な環境ではアニメーションを止めます）

### 表示速度

Webフォント（Google Fonts）は描画を止めない形で読み込んでいます。

```html
<link rel="preload" as="style" href="…">
<link rel="stylesheet" href="…" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="…"></noscript>
```

普通の `<link rel="stylesheet">` にすると、Google Fonts の応答が返るまで
ページが真っ白のままになります（届かない環境での実測で 13 秒）。
上の形なら本文は 0.2 秒ほどで出て、フォントは届いた時点で差し替わります。

`npm run visual` の最後で、外部の応答を 5 秒遅らせた状態でも
本文が 1.5 秒以内に描画されるかを確認しています。
描画を止める外部リソースを足すと、ここで引っかかります。

### アクセシビリティ

`npm run visual` が、全ページ・320 / 768 / 1440px の3つの幅と、
モバイルメニューを開いた状態で、文字と背景のコントラスト比を実際に測ります。
WCAG AA（通常の文字 4.5:1、24px以上または太字18.66px以上は 3:1）を下回ると指摘が出ます。

半透明の色は下の色に重ねてから、グラデーションの上の文字は
いちばん条件の悪い位置で判定しています。
測れないのは背景に画像を敷いた場合だけで、そのときは件数を出すので目視で確認します。
ロゴタイプは WCAG 1.4.3 の対象外なので測っていません。

### OG画像の再生成

`tools/og-image.html` を 1200×630 で撮影したものが OG画像です。

```bash
npm run build:og
```

- `assets/img/og-image.jpg` … 共通版（トップ・404・お知らせ詳細）
- `assets/img/og/<ページ名>.jpg` … ページ別（ロゴの上にページ名が入るだけの違い）

ページ名は `tools/build-og.mjs` の `PAGES` に並んでいます。
文言や色を変えたいときは `tools/og-image.html` を直してから再生成してください。

---

## ライセンス

サイト内の文章・ロゴ・画像等の著作権は SIDRA STUDIO に帰属します。
