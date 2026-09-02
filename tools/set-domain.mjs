#!/usr/bin/env node
/**
 * サイト全体のドメインを差し替える。
 *
 *   node tools/set-domain.mjs sidra.studio          置き換えを実行
 *   node tools/set-domain.mjs sidra.studio --dry    変更内容だけ表示
 *
 * canonical / og:url / og:image / 構造化データ / robots.txt / sitemap.xml /
 * contact.js のメールアドレスまで、まとめて書き換えます。
 * 手で sed を打つと contact.js や news/ 以下を取りこぼすので、こちらを使ってください。
 *
 * 実行後は `npm run verify` を通すこと（sitemap は自動で作り直されます）。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** いま入っているドメイン。README の記載と揃えてある */
const CURRENT = "sidrastudio.com";

const next = process.argv[2];
const dry = process.argv.includes("--dry");

if (!next || next.startsWith("-")) {
  console.error("使い方: node tools/set-domain.mjs <新しいドメイン> [--dry]");
  console.error("  例:   node tools/set-domain.mjs sidra.studio");
  process.exit(2);
}
if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(next)) {
  console.error(`ドメインの形式が正しくありません: ${next}`);
  console.error("  http:// や末尾の / は付けず、ホスト名だけを渡してください");
  process.exit(2);
}
if (next === CURRENT) {
  console.log(`すでに ${CURRENT} です。変更はありません。`);
  process.exit(0);
}

const SKIP_DIRS = new Set(["node_modules", ".git", ".preview"]);
const TARGET_EXT = /\.(html|txt|xml|js|mjs|json|webmanifest|md)$/;

function collect(dir = ROOT) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // 隠しファイルは飛ばすが、.htaccess と .well-known（security.txt）は対象
    if (entry.name.startsWith(".") && entry.name !== ".htaccess" && entry.name !== ".well-known") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...collect(full));
    } else if (TARGET_EXT.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// 自分自身は書き換えない（CURRENT の定義が壊れるため）
const SELF = join(ROOT, "tools/set-domain.mjs");

let files = 0;
let hits = 0;
const changed = [];

for (const abs of collect()) {
  if (abs === SELF) continue;
  const src = readFileSync(abs, "utf8");
  const n = src.split(CURRENT).length - 1;
  if (!n) continue;
  files++;
  hits += n;
  changed.push(`${relative(ROOT, abs)}（${n} 箇所）`);
  if (!dry) writeFileSync(abs, src.split(CURRENT).join(next));
}

if (!files) {
  console.log(`${CURRENT} は見つかりませんでした。すでに差し替え済みかもしれません。`);
  process.exit(0);
}

console.log(`${dry ? "【確認のみ】" : ""}${CURRENT} → ${next}`);
for (const c of changed) console.log(`  ${c}`);
console.log(`\n${files} ファイル / ${hits} 箇所${dry ? "が対象です。" : "を書き換えました。"}`);

if (!dry) {
  console.log("\nこのあと:");
  console.log("  1. tools/set-domain.mjs の CURRENT を新しいドメインに直す");
  console.log("  2. README の「公開前に差し替えるところ」の記載を更新する");
  console.log("  3. npm run verify を通す");
  console.log("  4. メールアドレスが実際に受信できるか確認する");
}
