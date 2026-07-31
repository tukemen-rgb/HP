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
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const findings = [];

const add = (level, file, message, hint) =>
  findings.push({ level, file, message, hint });

const html = (name) => readFileSync(join(ROOT, name), "utf8");
const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

/* ---------- 1. 内部リンクと参照ファイルの存在 ---------- */
for (const page of pages) {
  const src = html(page);
  const refs = [...src.matchAll(/(?:href|src)="([^"#:]+?)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(ref)) continue;
    const path = ref.startsWith("/") ? ref.slice(1) : ref;
    if (path === "" || path === "/") continue;
    if (!existsSync(join(ROOT, path))) {
      add("blocker", page, `参照先が存在しません: ${ref}`, "パスの綴りか、ファイルの置き場所を確認");
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
];
for (const page of [...pages, "assets/js/contact.js", "robots.txt", "sitemap.xml"]) {
  if (!existsSync(join(ROOT, page))) continue;
  const src = readFileSync(join(ROOT, page), "utf8");
  for (const [needle, label, hint] of PLACEHOLDERS) {
    const n = src.split(needle).length - 1;
    if (n > 0) add("todo", page, `${label} が ${n} 箇所残っています`, hint);
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
  ["感動を届け", "業界の定型句"],
];
for (const page of pages) {
  const src = html(page);
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

/* ---------- 8. 生成物の鮮度 ---------- */
const ogImage = join(ROOT, "assets/img/og-image.png");
const ogSource = join(ROOT, "tools/og-image.html");
if (existsSync(ogImage) && existsSync(ogSource)) {
  if (statSync(ogSource).mtimeMs > statSync(ogImage).mtimeMs) {
    add("warn", "assets/img/og-image.png", "元データより古いままです", "npm run build:og で再生成");
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
