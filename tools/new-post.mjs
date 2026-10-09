#!/usr/bin/env node
/**
 * お知らせを1コマンドで追加する。
 *
 *   node tools/new-post.mjs 2026-09-10 "見出し" --slug first-title [--tag Studio] [--summary "要約"]
 *   npm run new:post -- 2026-09-10 "見出し" --slug first-title
 *
 * やること
 *   1. news/_template.html を news/<日付>-<slug>.html にコピーし、【 】を埋めて noindex を外す
 *   2. news.html と index.html の一覧の先頭に、詳細ページへリンクした1行を足す
 *   3. あとは npm run verify を通せば sitemap と feed も自動で追いつく
 *
 * 本文は雛形の段落のまま残るので、生成されたファイルを開いて書き換えてください。
 * 【 】が残っていると check.mjs が止めます。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const [date, headline] = positional;
const slug = opt("slug");
const tag = opt("tag", "Studio");
const summary = opt("summary", headline);

const usage = () => {
  console.error('使い方: node tools/new-post.mjs <YYYY-MM-DD> "<見出し>" --slug <英数字> [--tag Studio] [--summary "要約"]');
  process.exit(2);
};
if (!date || !headline || !slug) usage();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error(`日付の形式が違います: ${date}`); usage(); }
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) { console.error(`slug は小文字英数字とハイフンだけにしてください: ${slug}`); usage(); }
if (/[<>"]/.test(headline)) { console.error("見出しに < > \" は使えません"); process.exit(2); }

const file = `${date}-${slug}.html`;
const out = join(ROOT, "news", file);
if (existsSync(out)) { console.error(`すでにあります: news/${file}`); process.exit(1); }

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dotted = date.replace(/-/g, ".");

/* ---- 1. 詳細ページ ---- */
let tpl = readFileSync(join(ROOT, "news/_template.html"), "utf8");
tpl = tpl
  .replace(/(<!DOCTYPE html>\n)<!--[\s\S]*?-->\n/, "$1")                // 使い方コメント（DOCTYPE の直後）
  .replace(/<meta name="robots" content="noindex,nofollow">\n/, "")      // 検索に出す
  .replace(/【ファイル名】/g, `${date}-${slug}`)
  .replace(/【記事タイトル】/g, esc(headline))
  .replace(/【記事の要約を1〜2文で。[^】]*】/g, esc(summary))
  .replace(/【記事の要約】/g, esc(summary))
  .replace(/【2026-08-01】/g, date)
  .replace(/【2026\.08\.01】/g, dotted)
  .replace(/【Studio】/g, esc(tag));
const leftovers = tpl.match(/【[^】]*】/g) || [];
writeFileSync(out, tpl);

/* ---- 2. 一覧に1行 ---- */
const row =
  `        <li>\n` +
  `          <a class="news-item" href="news/${file}">\n` +
  `            <time class="news-item__date" datetime="${date}">${dotted}</time>\n` +
  `            <span class="news-item__tag" lang="en">${esc(tag)}</span>\n` +
  `            <span class="news-item__title">${esc(headline)}</span>\n` +
  `          </a>\n` +
  `        </li>\n`;

for (const page of ["news.html", "index.html"]) {
  const p = join(ROOT, page);
  let s = readFileSync(p, "utf8");
  const m = s.match(/<ul class="news-list[^"]*">\n/);
  if (!m) { console.error(`${page} に .news-list が見つかりません`); process.exit(1); }
  s = s.replace(m[0], m[0] + row);
  writeFileSync(p, s);
}

console.log(`作成: news/${file}`);
console.log(`追加: news.html / index.html の一覧の先頭`);
if (leftovers.length) {
  console.log(`\n本文に雛形の【 】が ${leftovers.length} 箇所残っています。開いて書き換えてください。`);
  console.log(`  ${leftovers.slice(0, 3).map((l) => l.slice(0, 24)).join(" / ")}${leftovers.length > 3 ? " …" : ""}`);
}
console.log(`\n書き終えたら: npm run verify`);
