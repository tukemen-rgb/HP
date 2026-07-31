# ホスティング設定のひな形

公開先が決まってから、この中のファイルをリポジトリ直下にコピーして使います。
**置いただけで効いてしまう設定なので、公開先を決めるまでは直下に置かないでください。**

| 公開先 | 使うファイル | 置き場所 |
|---|---|---|
| Cloudflare Pages | `_headers` | リポジトリ直下 |
| Netlify | `_headers` または `netlify.toml` | リポジトリ直下（どちらか一方） |
| Apache（レンタルサーバー） | `.htaccess` | 公開ディレクトリ直下 |
| GitHub Pages | — | ヘッダーを設定できないため、この項目は対象外 |

中身はどれも同じことをしています。設定できるヘッダーの書き方が違うだけです。

---

## 何を設定しているか

| ヘッダー | 目的 |
|---|---|
| `Content-Security-Policy` | 読み込んでよい先を、実際に使っているものだけに限る |
| `Strict-Transport-Security` | 以後はこのサイトへ必ず HTTPS で接続させる |
| `X-Content-Type-Options: nosniff` | 拡張子と中身が食い違うファイルを勝手に解釈させない |
| `Referrer-Policy` | 他サイトへ移動するとき、URL のパス部分まで渡さない |
| `Permissions-Policy` | カメラ・マイク・位置情報を使わないことを明示する |
| `Cache-Control` | 中身が変わらないファイルだけ長く保持させる |

`X-Frame-Options` は入れていません。CSP の `frame-ancestors` が同じ働きをして、
そちらが優先されるためです。

---

## 公開前に確認すること

### 1. Strict-Transport-Security

一度送るとブラウザが期間中おぼえてしまい、取り消せません。
**独自ドメインで HTTPS が問題なく動くのを確認してから**有効にしてください。
`includeSubDomains` はサブドメインもすべて HTTPS 必須になるので、
サブドメインを使う予定があるならそちらの用意ができてからにします。

### 2. Content-Security-Policy

いまのサイトの作りに合わせてあります。以下を変えるときは、あわせて直します。

- **Webフォントの配信元を変える**（自前配信にするなど）
  → `style-src` の `https://fonts.googleapis.com` と
    `font-src` の `https://fonts.gstatic.com` を差し替える
- **お問い合わせフォームの送信先を設定する**（`assets/js/contact.js` の `ENDPOINT`）
  → `connect-src` にその送信先を足す。コメントアウトしてある行があります
- **アクセス解析などのタグを足す**
  → `script-src` と `connect-src` にその配信元を足す

`style-src` に `'unsafe-inline'` が入っているのは、
ブランド素材ページの色見本などで `style="background:#0B3B57"` を使っているためです。
`script-src` は `'self'` のままにしてあります（HTML 側に JavaScript を直接書いていないため）。

### 3. 効いているかの確認

公開後、ブラウザの開発者ツールのコンソールに CSP の警告が出ていないか、
実際に全ページを開いて確かめてください。とくに以下を見ます。

- お問い合わせフォームの送信
- ブランド素材ページのロゴのダウンロード
- 欧文が Jost、和文が Zen Kaku Gothic New で表示されているか
  （フォントだけ当たっていない場合は `style-src` / `font-src` を疑う）
