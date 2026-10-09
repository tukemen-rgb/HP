#!/usr/bin/env node
/**
 * 検証スクリプト（tools/check.mjs）の自己テスト。
 *
 *   node tools/selftest.mjs
 *
 * サイトを一時ディレクトリに複製し、既知の欠陥を1つずつ仕込んで、
 * check.mjs がそれを検出することを確かめる。チェックを改修したときに、
 * 検出力が落ちていないかを機械で見るためのもの。
 * 終了コード: 検出できない欠陥が1つでもあれば 1。
 */
import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COPY = ["index.html", "about.html", "gameyard.html", "works.html", "news.html", "brand.html",
  "contact.html", "privacy.html", "404.html", "news", "assets", "tools", "robots.txt", "sitemap.xml",
  "site.webmanifest", "favicon.ico", "humans.txt", ".well-known", "feed.xml"];

/** 欠陥の一覧。apply で仕込み、expect が check.mjs の出力に含まれれば検出成功 */
const CASES = [
  {
    name: "アンカーの参照先が消えた",
    apply: (dir) => edit(dir, "about.html", (s) => s.replace('id="gameyard"', 'id="gameyard-x"')),
    expect: /アンカーの参照先がありません/,
  },
  {
    name: "使わないと決めた語が入った",
    apply: (dir) => edit(dir, "index.html", (s) => s.replace("</main>", "<p>革新を続けます</p></main>")),
    expect: /「革新」が含まれています/,
  },
  {
    name: "運営人数に触れる表現が入った",
    apply: (dir) => edit(dir, "about.html", (s) => s.replace("</main>", "<p>ひとりで運営しています</p></main>")),
    expect: /「ひとり」が含まれています/,
  },
  {
    name: "JSON-LD が壊れた",
    apply: (dir) => edit(dir, "index.html", (s) => s.replace('"@type": "Organization",', '"@type": "Organization",,')),
    expect: /JSON-LD が壊れています/,
  },
  {
    name: "img の alt が抜けた",
    apply: (dir) => edit(dir, "brand.html", (s) => s.replace(/<img ([^>]*?)alt="[^"]*" /, "<img $1")),
    expect: /img に alt がありません/,
  },
  {
    name: "参照先ファイルが消えた",
    apply: (dir) => edit(dir, "index.html", (s) => s.replace('href="assets/css/style.css"', 'href="assets/css/style-x.css"')),
    expect: /参照先が存在しません: assets\/css\/style-x\.css/,
  },
  {
    name: "タグの閉じ忘れ",
    apply: (dir) => edit(dir, "works.html", (s) => s.replace("</section>", "")),
    expect: /<section> の開閉が合いません/,
  },
  {
    name: "英語だけの要素から lang=\"en\" が落ちた",
    apply: (dir) => edit(dir, "gameyard.html", (s) => s.replace('<span class="en" lang="en">First Post</span>', '<span class="en">First Post</span>')),
    expect: /lang="en" がありません/,
  },
  {
    name: "webmanifest の icons が実在しない",
    apply: (dir) => edit(dir, "site.webmanifest", (s) => s.replace("icon-192.png", "icon-999.png")),
    expect: /icons の参照先がありません/,
  },
  {
    name: "雛形の【 】が公開ページに残った",
    apply: (dir) => edit(dir, "news.html", (s) => s.replace("</main>", "<p>【本文をここに】</p></main>")),
    expect: /雛形の【 】が残っています/,
  },
  {
    name: "sitemap から公開ページが落ちた",
    apply: (dir) => edit(dir, "sitemap.xml", (s) => s.replace(/<url>\s*<loc>[^<]*works\.html<\/loc>[\s\S]*?<\/url>\s*/, "")),
    expect: /works\.html が sitemap に載っていません/,
  },
];

function edit(dir, file, fn) {
  const p = join(dir, file);
  const before = readFileSync(p, "utf8");
  const after = fn(before);
  if (after === before) throw new Error(`${file} に仕込めませんでした（置換対象が見つからない）`);
  writeFileSync(p, after);
}

function runCheck(dir) {
  try {
    return execFileSync("node", [join(dir, "tools/check.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    return String(e.stdout || "") + String(e.stderr || "");
  }
}

let failed = 0;
const base = mkdtempSync(join(tmpdir(), "sidra-selftest-"));
try {
  const pristine = join(base, "pristine");
  cpSync(ROOT, pristine, {
    recursive: true,
    filter: (src) => {
      const rel = src.slice(ROOT.length + 1);
      if (!rel) return true;
      return COPY.some((c) => rel === c || rel.startsWith(c + "/"));
    },
  });

  // まず、仕込みなしで要修正 0 であること（前提が崩れていたらテストにならない）
  const clean = runCheck(pristine);
  if (!/要修正 0 /.test(clean)) {
    console.log("前提エラー: 仕込みなしの状態で要修正があります。先に npm run check を通してください。");
    console.log(clean.split("\n").filter((l) => /要修正|^\s{2}\S/.test(l)).slice(0, 8).join("\n"));
    process.exit(1);
  }

  console.log(`\n検証スクリプトの自己テスト — ${CASES.length} 件\n`);
  for (const c of CASES) {
    const dir = join(base, c.name.replace(/[^\w一-龠ぁ-んァ-ン]/g, "_"));
    cpSync(pristine, dir, { recursive: true });
    try {
      c.apply(dir);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${c.name} — 仕込みに失敗: ${e.message}`);
      continue;
    }
    const out = runCheck(dir);
    const ok = c.expect.test(out);
    if (!ok) failed++;
    console.log(`  ${ok ? "✓" : "✗"} ${c.name}${ok ? "" : "  ← 検出できません"}`);
  }
} finally {
  rmSync(base, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} 件が検出できていません。check.mjs を確認してください。\n` : "\nすべて検出できました。\n");
process.exit(failed ? 1 : 0);
