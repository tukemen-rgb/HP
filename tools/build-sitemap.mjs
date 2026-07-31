#!/usr/bin/env node
/**
 * sitemap.xml を HTML の実体から組み立て直す。
 *
 *   node tools/build-sitemap.mjs
 *
 * - noindex のページは載せない
 * - lastmod はそのファイルを最後に変更したコミットの日付（git がなければ更新日時）
 * - ドメインは各ページの canonical から取るので、ドメインを変えてもここは直さなくてよい
 *
 * `npm run verify` の最初に走るので、ページを足せば sitemap も追いつく。
 */
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 検索結果での重み。載っていないページは 0.5 */
const PRIORITY = {
  "index.html": "1.0",
  "about.html": "0.8",
  "works.html": "0.8",
  "contact.html": "0.7",
  "news.html": "0.6",
  "brand.html": "0.6",
  "privacy.html": "0.3",
};

const SKIP_DIRS = new Set(["node_modules", ".git", ".preview", "tools", "docs"]);
function collectPages(dir = ROOT) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
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

/** そのファイルを最後に変更したコミットの日付。git が使えなければ更新日時 */
function lastModified(page) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", page], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) return out;
  } catch {
    /* git がない、またはリポジトリではない */
  }
  return new Date(statSync(join(ROOT, page)).mtimeMs).toISOString().slice(0, 10);
}

const entries = [];
for (const page of collectPages().sort()) {
  const src = readFileSync(join(ROOT, page), "utf8");
  if (/<meta name="robots" content="[^"]*noindex/.test(src)) continue;

  const canonical = src.match(/<link rel="canonical" href="([^"]+)"/);
  if (!canonical) {
    console.error(`canonical がないので sitemap に載せられません: ${page}`);
    process.exitCode = 1;
    continue;
  }
  entries.push({
    page,
    loc: canonical[1],
    lastmod: lastModified(page),
    priority: PRIORITY[page] || "0.5",
  });
}

// トップを先頭に、あとは重みの大きい順
entries.sort((a, b) =>
  (b.page === "index.html") - (a.page === "index.html") ||
  Number(b.priority) - Number(a.priority) ||
  a.page.localeCompare(b.page)
);

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  entries
    .map(
      (e) =>
        `  <url>\n` +
        `    <loc>${e.loc}</loc>\n` +
        `    <lastmod>${e.lastmod}</lastmod>\n` +
        `    <priority>${e.priority}</priority>\n` +
        `  </url>\n`
    )
    .join("") +
  `</urlset>\n`;

const out = join(ROOT, "sitemap.xml");
const before = (() => {
  try { return readFileSync(out, "utf8"); } catch { return ""; }
})();

if (before === xml) {
  console.log(`sitemap.xml は最新です（${entries.length} ページ）`);
} else {
  writeFileSync(out, xml);
  console.log(`sitemap.xml を更新しました（${entries.length} ページ）`);
}
