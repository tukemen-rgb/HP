#!/usr/bin/env node
/**
 * 使われていない CSS クラスを列挙する。
 *
 *   node tools/audit-css.mjs
 *
 * style.css のセレクタに出てくるクラス名を集め、HTML（コメント除く）と
 * JS のどこにも出てこないものを表示する。消すかどうかは人が決める。
 * 終了コードは常に 0（情報表示のみ）。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(ROOT, "assets/css/style.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// セレクタ部分（{ の手前）からクラス名を集める。宣言の中（var(--x) 等）は見ない
const classes = new Set();
for (const m of css.matchAll(/([^{}]+)\{/g)) {
  const selector = m[1];
  if (/^\s*@/.test(selector) && !/^\s*@media|^\s*@supports/.test(selector)) continue;
  for (const c of selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) classes.add(c[1]);
}

// 参照側：HTML（コメントを除く）と JS
let corpus = "";
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || ["node_modules", "tools", "docs"].includes(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(html|js)$/.test(e.name)) {
      let s = readFileSync(full, "utf8");
      if (e.name.endsWith(".html")) s = s.replace(/<!--[\s\S]*?-->/g, "");
      corpus += "\n" + s;
    }
  }
}
walk(ROOT);

// JS が付け外しするクラスは HTML に出ないので明示
const RUNTIME = new Set(["js", "is-visible", "is-open", "is-scrolled", "is-nav-open"]);

const unused = [];
for (const c of [...classes].sort()) {
  if (RUNTIME.has(c)) continue;
  // class="a b c" の中、classList.add("x") の中、どちらも文字列として拾う
  const re = new RegExp(`(?<![\\w-])${c.replace(/[-]/g, "\\-")}(?![\\w-])`);
  if (!re.test(corpus)) unused.push(c);
}

console.log(`\nCSS のクラス ${classes.size} 個のうち、HTML / JS から参照がないもの: ${unused.length} 個\n`);
for (const c of unused) {
  // どこで定義されているか（最初の1箇所）を添える
  const line = css.slice(0, css.search(new RegExp(`\\.${c}(?![\\w-])`))).split("\n").length;
  console.log(`  .${c}  （style.css 付近 ${line} 行目）`);
}
console.log("");
