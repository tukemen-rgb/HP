#!/usr/bin/env node
/**
 * 公開前チェック（静的解析・依存なし）
 *
 *   node tools/check.mjs           人が読む形式で出力
 *   node tools/check.mjs --json    JSON で出力
 *
 * 終了コード: エラーが1件でもあれば 1、それ以外は 0。
 * 「blocker」は公開前に必ず潰すもの、「warn」は判断が要るもの。
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const findings = [];

// 同じ指摘が同じファイルで複数回出ても1件にまとめる（同じアンカーへのリンクが2つある等）
const add = (level, file, message, hint) => {
  if (findings.some((f) => f.level === level && f.file === file && f.message === message)) return;
  findings.push({ level, file, message, hint });
};

const raw = (name) => readFileSync(join(ROOT, name), "utf8");
/** コメントは表示にも構造にも関わらないので、外してから見る（雛形の使い方メモなど） */
const html = (name) => raw(name).replace(/<!--[\s\S]*?-->/g, "");

/** ルート直下と、その下のディレクトリ（node_modules 等は除く）から HTML を集める */
const SKIP_DIRS = new Set(["node_modules", ".git", ".preview", "tools"]);
function collectPages(dir = ROOT) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".well-known") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...collectPages(full));
    } else if (entry.name.endsWith(".html")) {
      out.push(relative(ROOT, full));
    }
  }
  return out;
}
const pages = collectPages().sort();

/* ---------- 1. 内部リンクと参照ファイルの存在 ---------- */
for (const page of pages) {
  const src = html(page);
  const refs = [...src.matchAll(/(?:href|src)="([^"#:]+?)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(ref)) continue;
    const base = ref.startsWith("/") ? ROOT : dirname(join(ROOT, page));
    const path = ref.startsWith("/") ? ref.slice(1) : ref;
    if (path === "" || path === "/") continue;
    if (!existsSync(resolve(base, path))) {
      add("blocker", page, `参照先が存在しません: ${ref}`, "パスの綴りか、ファイルの置き場所を確認");
    }
  }
}

/* ---------- 1-b. ページ内アンカーの実在 ----------
   about.html#gameyard のような参照は、id を消しても 404 にならず静かに壊れる */
const idsOf = new Map();
const idsIn = (page) => {
  if (!idsOf.has(page)) {
    idsOf.set(page, new Set([...html(page).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idsOf.get(page);
};
for (const page of pages) {
  const src = html(page);
  for (const m of src.matchAll(/href="([^"#:]*)#([^"]+)"/g)) {
    const [, file, id] = m;
    if (id === "") continue;
    let target;
    if (!file) target = page;
    else {
      const abs = resolve(file.startsWith("/") ? ROOT : dirname(join(ROOT, page)), file.replace(/^\//, ""));
      target = relative(ROOT, abs);
      if (!pages.includes(target)) continue; // 存在しないファイルは 1. で指摘済み
    }
    if (!idsIn(target).has(id)) {
      add("blocker", page, `アンカーの参照先がありません: ${file || ""}#${id}`, `${target} に id="${id}" があるか確認`);
    }
  }
}

/* ---------- 2. タグの開閉 ---------- */
const TAGS = ["div", "section", "span", "a", "ul", "ol", "li", "svg", "main",
              "header", "footer", "article", "form", "table", "p"];
for (const page of pages) {
  const src = html(page);
  for (const tag of TAGS) {
    const open = (src.match(new RegExp(`<${tag}[\\s>]`, "g")) || []).length;
    const close = (src.match(new RegExp(`</${tag}>`, "g")) || []).length;
    if (open !== close) {
      add("blocker", page, `<${tag}> の開閉が合いません（開 ${open} / 閉 ${close}）`, "閉じ忘れか、余分な閉じタグ");
    }
  }
}

/* ---------- 3. 必須の meta ---------- */
const REQUIRED = [
  [/<title>[^<]+<\/title>/, "title"],
  [/<meta name="description" content="[^"]{20,}"/, "meta description（20字以上）"],
  [/<meta name="viewport"/, "viewport"],
  [/<html lang="ja">/, 'html lang="ja"'],
];
const OG_REQUIRED = [
  [/<link rel="canonical"/, "canonical"],
  [/<meta property="og:title"/, "og:title"],
  [/<meta property="og:image"/, "og:image"],
];
for (const page of pages) {
  const src = html(page);
  for (const [re, label] of REQUIRED) {
    if (!re.test(src)) add("blocker", page, `${label} がありません`);
  }
  if (page === "404.html") continue; // 404 は noindex なので OGP 不要
  for (const [re, label] of OG_REQUIRED) {
    if (!re.test(src)) add("warn", page, `${label} がありません`);
  }
  const h1 = (src.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) add("warn", page, `h1 が ${h1} 個あります（1個が望ましい）`);
}

/* ---------- 4. 画像の代替テキスト ---------- */
for (const page of pages) {
  for (const tag of html(page).match(/<img[^>]*>/g) || []) {
    if (!/\salt=/.test(tag)) {
      add("blocker", page, `img に alt がありません: ${tag.slice(0, 70)}…`, "装飾なら alt=\"\" を明示");
    }
  }
}

/* ---------- 5. 公開前に差し替えるプレースホルダ ---------- */
const PLACEHOLDERS = [
  ["sidrastudio.com", "仮ドメイン", "取得したドメインへ一括置換（README 参照）"],
  ["contact@sidrastudio.com", "仮メールアドレス", "受信できるアドレスへ差し替え"],
  ['<td>—</td>', "スタジオ概要の未記入欄", "代表者名などを記入、または行ごと削除"],
  ["formspree.io/f/xxxxxxxx", "フォーム送信先の例示", "実際のエンドポイントに差し替えるか、空のまま（メール起動）"],
  ["2026-07-30", "お知らせの仮の日付", "実際の日付に直すか、記事ごと差し替え"],
];
for (const page of [...pages, "assets/js/contact.js", "robots.txt", "sitemap.xml",
                    "humans.txt", ".well-known/security.txt", "feed.xml"]) {
  if (!existsSync(join(ROOT, page))) continue;
  const src = readFileSync(join(ROOT, page), "utf8");
  for (const [needle, label, hint] of PLACEHOLDERS) {
    const n = src.split(needle).length - 1;
    if (n > 0) add("todo", page, `${label} が ${n} 箇所残っています`, hint);
  }
}

/* ---------- 5-b. フッターの年号 ----------
   © の年が固定なので、年が変わったら気づけるようにする */
{
  const thisYear = new Date().getFullYear();
  for (const page of pages) {
    const m = html(page).match(/&copy;\s*(\d{4})/);
    if (m && +m[1] < thisYear) {
      add("warn", page, `フッターの年号が ${m[1]} のままです（今年は ${thisYear}）`, "全ページの &copy; を更新");
    }
  }
}

/* ---------- 5-b2. 英語だけの表示要素に lang="en" があるか ----------
   .en の英字キャプションや eyebrow は、lang がないと読み上げ環境で日本語として発音される */
{
  const EN_CLASSES = ["en", "eyebrow", "hero__eyebrow", "work__status", "work__visual-label", "footer__to-top", "news-item__tag"];
  const cls = EN_CLASSES.map((c) => c.replace(/[-]/g, "\\-")).join("|");
  const re = new RegExp(`<(\\w+)([^>]*\\bclass="[^"]*\\b(?:${cls})\\b[^"]*"[^>]*)>([^<]*)</\\1>`, "g");
  for (const page of pages) {
    const src = html(page);
    for (const m of src.matchAll(re)) {
      const [, , attrs, inner] = m;
      const text = inner.trim();
      if (!text || /lang=/.test(attrs)) continue;
      if ([...text].every((ch) => ch.charCodeAt(0) < 128)) {
        add("warn", page, `英語だけの表示要素に lang="en" がありません: 「${text.slice(0, 20)}」`, "class に en / eyebrow などを持つ要素は lang=\"en\" を付ける");
      }
    }
  }
}

/* ---------- 5-c. site.webmanifest の整合 ---------- */
if (existsSync(join(ROOT, "site.webmanifest"))) {
  let manifest = null;
  try {
    manifest = JSON.parse(raw("site.webmanifest"));
  } catch (e) {
    add("blocker", "site.webmanifest", `JSON が壊れています: ${e.message}`);
  }
  if (manifest) {
    for (const icon of manifest.icons || []) {
      const rel = String(icon.src || "").replace(/^\//, "");
      if (!existsSync(join(ROOT, rel))) add("blocker", "site.webmanifest", `icons の参照先がありません: ${icon.src}`);
    }
    if (manifest.start_url !== "/") add("warn", "site.webmanifest", `start_url が "/" ではありません（${manifest.start_url}）`);
    const themes = new Set();
    for (const page of pages) {
      const m = html(page).match(/<meta name="theme-color" content="([^"]+)"/);
      if (m) themes.add(m[1].toLowerCase());
    }
    const mt = String(manifest.theme_color || "").toLowerCase();
    if (mt && themes.size && !themes.has(mt)) {
      add("warn", "site.webmanifest", `theme_color（${manifest.theme_color}）がページの theme-color（${[...themes].join(", ")}）と違います`);
    }
  }
}

/* ---------- 6. 使わないと決めた語 ---------- */
const BANNED = [
  ["革新", "使用しないと決めた語"],
  ["こだわり", "使用しないと決めた語"],
  ["ひとり", "運営人数に触れない方針"],
  ["一人", "運営人数に触れない方針"],
  ["小さなスタジオ", "運営人数に触れない方針"],
  ["サラキア", "旧ブランドの記述"],
  ["SALACIA", "旧社名"],
  ["いるか座", "旧ブランドのモチーフ"],
  ["ソリューション", "業界の定型句"],
];
// 「感動を届ける」は定型句として禁止していたが、GAMEYARD の Core Value
// （ユーザーに対して、今までにない感動を届ける）そのものなので外した。
for (const page of pages) {
  const src = raw(page); // コメントの中も対象にする
  for (const [word, why] of BANNED) {
    if (src.includes(word)) add("blocker", page, `「${word}」が含まれています（${why}）`);
  }
}

/* ---------- 7. sitemap と実ページの対応 ---------- */
if (existsSync(join(ROOT, "sitemap.xml"))) {
  const sm = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  const listed = [...sm.matchAll(/<loc>[^<]*?\/([^<\/]*)<\/loc>/g)].map((m) => m[1] || "index.html");
  const publicPages = pages.filter((p) => {
    const src = html(p);
    return !/<meta name="robots" content="noindex/.test(src);
  });
  for (const p of publicPages) {
    const key = p === "index.html" ? "index.html" : p;
    if (!listed.includes(key)) {
      add("warn", "sitemap.xml", `${p} が sitemap に載っていません`);
    }
  }
}

/* ---------- 8. 構造化データ（JSON-LD）---------- */
for (const page of pages) {
  const src = html(page);
  const blocks = [...src.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const [, body] of blocks) {
    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      add("blocker", page, `JSON-LD が壊れています: ${e.message}`, "カンマ抜けか、値の中の引用符");
      continue;
    }
    if (!data["@context"] || !data["@type"]) {
      add("warn", page, "JSON-LD に @context / @type がありません");
    }
  }
  // パンくずを出しているページには BreadcrumbList を持たせる
  if (/class="breadcrumb"/.test(src) && !/"@type":\s*"BreadcrumbList"/.test(src)) {
    add("warn", page, "パンくずはあるのに BreadcrumbList の構造化データがありません");
  }
}

/* ---------- 9. 生成物の鮮度 ----------
   更新日時（mtime）だけで比べると、クローン直後に誤検知する。
   git は取り出した順に時刻を付けるので、元データのほうが数ミリ秒新しくなりうる。
   まず git の最終変更コミットで比べ、git が使えないときだけ mtime に落とす。 */
function gitTime(abs) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%ct", "--", abs], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out ? +out : null;
  } catch {
    return null;
  }
}

/** 生成物が元データより古いか。判断がつかないときは「古くない」と見なす */
function isStale(source, built) {
  const [gs, gb] = [gitTime(source), gitTime(built)];
  if (gs !== null && gb !== null) return gs > gb;
  // git で分からない場合は mtime。クローン直後の誤差を避けるため2秒の余裕を見る
  return statSync(source).mtimeMs > statSync(built).mtimeMs + 2000;
}

const ogSource = join(ROOT, "tools/og-image.html");
if (existsSync(ogSource)) {
  const built = ["assets/img/og-image.jpg"];
  const ogDir = join(ROOT, "assets/img/og");
  if (existsSync(ogDir)) {
    for (const f of readdirSync(ogDir)) built.push(`assets/img/og/${f}`);
  }
  for (const rel of built) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) {
      add("warn", rel, "生成されていません", "npm run build:og で生成");
    } else if (isStale(ogSource, abs)) {
      add("warn", rel, "元データより古いままです", "npm run build:og で再生成");
    }
  }
}

/* ---------- 出力 ---------- */
const order = { blocker: 0, warn: 1, todo: 2 };
findings.sort((a, b) => order[a.level] - order[b.level] || a.file.localeCompare(b.file));
const count = (lv) => findings.filter((f) => f.level === lv).length;

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    pages: pages.length,
    summary: { blocker: count("blocker"), warn: count("warn"), todo: count("todo") },
    findings,
  }, null, 2));
} else {
  const LABEL = { blocker: "要修正", warn: "確認", todo: "公開前に差し替え" };
  console.log(`\n公開前チェック — ${pages.length} ページ\n`);
  if (!findings.length) {
    console.log("  指摘なし。\n");
  } else {
    let current = "";
    for (const f of findings) {
      if (f.level !== current) {
        current = f.level;
        console.log(`[${LABEL[f.level]}]`);
      }
      console.log(`  ${f.file}: ${f.message}`);
      if (f.hint) console.log(`      → ${f.hint}`);
    }
    console.log("");
  }
  console.log(`要修正 ${count("blocker")} / 確認 ${count("warn")} / 差し替え待ち ${count("todo")}\n`);
}

process.exit(count("blocker") > 0 ? 1 : 0);
