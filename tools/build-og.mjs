#!/usr/bin/env node
/**
 * OG画像（1200×630）を tools/og-image.html から生成する。
 *
 *   node tools/build-og.mjs
 *
 * 出力: assets/img/og-image.png
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  try {
    ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs"));
  } catch {
    console.error("playwright が見つかりません。`npm i -D playwright` のあと `npx playwright install chromium` を実行してください。");
    process.exit(2);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(join(ROOT, "tools/og-image.html")).href, { waitUntil: "networkidle" }).catch(() => {});
// Webフォントの読み込みを待つ（オフラインならフォールバックのまま進む）
await page.evaluate(() => document.fonts?.ready).catch(() => {});
await page.waitForTimeout(800);
const out = join(ROOT, "assets/img/og-image.png");
await page.screenshot({ path: out });
await browser.close();

console.log(`OG画像を生成しました: assets/img/og-image.png`);
