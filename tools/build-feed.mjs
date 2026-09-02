#!/usr/bin/env node
/**
 * お知らせの一覧（news.html）から feed.xml（Atom）を組み立てる。
 *
 *   node tools/build-feed.mjs
 *
 * - 記事に詳細ページ（a.news-item の href）があればそこへ、なければ news.html へリンク
 * - 日付は <time datetime> から。並びは news.html のまま（新しいものが上）
 * - サイトの URL は news.html の canonical から取る
 *
 * `npm run verify` の最初に走る。手で編集しない。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "news.html"), "utf8");

const canonical = src.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
if (!canonical) {
  console.error("news.html に canonical がありません");
  process.exit(1);
}
const site = canonical.replace(/news\.html$/, "");
const title = src.match(/<meta property="og:site_name" content="([^"]+)"/)?.[1] || "SIDRA STUDIO";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const text = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const items = [];
for (const m of src.matchAll(/<(a|div) class="news-item"([^>]*)>([\s\S]*?)<\/\1>/g)) {
  const [, , attrs, body] = m;
  const href = attrs.match(/href="([^"]+)"/)?.[1];
  const date = body.match(/datetime="(\d{4}-\d{2}-\d{2})"/)?.[1];
  const tag = text(body.match(/class="news-item__tag">([\s\S]*?)<\/span>/)?.[1] || "");
  const headline = text(body.match(/class="news-item__title">([\s\S]*?)<\/span>/)?.[1] || "");
  if (!date || !headline) continue;
  const link = href ? new URL(href, site).href : `${site}news.html`;
  items.push({ date, tag, headline, link });
}

const updated = items[0]?.date || new Date().toISOString().slice(0, 10);
const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<feed xmlns="http://www.w3.org/2005/Atom">\n` +
  `  <title>${esc(title)} お知らせ</title>\n` +
  `  <id>${site}feed.xml</id>\n` +
  `  <link rel="self" href="${site}feed.xml"/>\n` +
  `  <link rel="alternate" href="${site}news.html"/>\n` +
  `  <updated>${updated}T00:00:00Z</updated>\n` +
  `  <author><name>${esc(title)}</name></author>\n` +
  items
    .map(
      (it) =>
        `  <entry>\n` +
        `    <title>${esc(it.headline)}</title>\n` +
        `    <id>${it.link}#${it.date}</id>\n` +
        `    <link rel="alternate" href="${it.link}"/>\n` +
        `    <updated>${it.date}T00:00:00Z</updated>\n` +
        (it.tag ? `    <category term="${esc(it.tag)}"/>\n` : "") +
        `    <summary>${esc(it.headline)}</summary>\n` +
        `  </entry>\n`
    )
    .join("") +
  `</feed>\n`;

const out = join(ROOT, "feed.xml");
let before = "";
try { before = readFileSync(out, "utf8"); } catch {}
if (before === xml) {
  console.log(`feed.xml は最新です（${items.length} 件）`);
} else {
  writeFileSync(out, xml);
  console.log(`feed.xml を更新しました（${items.length} 件）`);
}
