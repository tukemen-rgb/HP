#!/usr/bin/env node
/**
 * SVG からラスター形式のアイコンを生成する。
 *
 *   node tools/build-icons.mjs
 *
 * 生成物:
 *   assets/img/apple-touch-icon.png   180×180  iOS のホーム画面用
 *   assets/img/icon-192.png           192×192  Android / PWA
 *   assets/img/icon-512.png           512×512  Android / PWA
 *   favicon.ico                       16+32    SVG 未対応ブラウザ用
 *
 * iOS Safari は apple-touch-icon に SVG を受け付けないため、PNG が必要。
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IMG = join(ROOT, "assets/img");

/* この環境ではブラウザ本体が /opt/pw-browsers に用意されていて、
   それに合う playwright はグローバル側にある。npm install で入った
   ローカルの playwright は版が違いブラウザが見つからないので、先にグローバルを試す。
   グローバルがない環境（普通の開発機）ではローカルに落ちる。 */
let chromium;
try {
  ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs"));
} catch {
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("playwright が見つかりません。`npm i -D playwright` のあと `npx playwright install chromium` を実行してください。");
    process.exit(2);
  }
}

/** SVG をそのサイズの PNG バッファにする */
async function render(browser, svgPath, size) {
  const svg = readFileSync(svgPath, "utf8");
  const ctx = await browser.newContext({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden}
     svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForTimeout(120);
  const buf = await page.screenshot({ omitBackground: false });
  await ctx.close();
  return buf;
}

/** PNG を並べて ICO を組み立てる（PNG 埋め込み形式。Vista 以降と主要ブラウザが対応） */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width（256 は 0 で表す）
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // パレット数
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // カラープレーン
    e.writeUInt16LE(32, 6); // ビット深度
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

if (!existsSync(IMG)) mkdirSync(IMG, { recursive: true });

const browser = await chromium.launch();
const appSvg = join(IMG, "icon-app.svg");
const faviconSvg = join(IMG, "favicon.svg");

const targets = [
  ["apple-touch-icon.png", appSvg, 180],
  ["icon-192.png", appSvg, 192],
  ["icon-512.png", appSvg, 512],
];

for (const [name, src, size] of targets) {
  const buf = await render(browser, src, size);
  writeFileSync(join(IMG, name), buf);
  console.log(`assets/img/${name} (${size}×${size})`);
}

const ico = buildIco([
  { size: 16, data: await render(browser, faviconSvg, 16) },
  { size: 32, data: await render(browser, faviconSvg, 32) },
  { size: 48, data: await render(browser, faviconSvg, 48) },
]);
writeFileSync(join(ROOT, "favicon.ico"), ico);
console.log("favicon.ico (16 / 32 / 48)");

await browser.close();
