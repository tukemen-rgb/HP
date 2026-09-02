#!/usr/bin/env node
/**
 * OG画像（1200×630）を tools/og-image.html から生成する。
 *
 *   node tools/build-og.mjs
 *
 * 出力:
 *   assets/img/og-image.jpg    共通版（トップ、404、雛形など）
 *   assets/img/og/<page>.jpg   ページ別（ロゴの上にページ名が入る）
 *
 * 形式は JPEG。同じ絵を PNG で出すと1枚 320KB になり、7枚で 2.3MB になる。
 * 濃い青のグラデーションが主なので JPEG の劣化は見えず、1枚 45KB で済む。
 *
 * 他社を見ると、この規模のスタジオは共通の1枚で通すのが普通で
 * （グッドラックスリー、任天堂はサイト全体で1枚）、ページ別に分けているのは
 * タイトルのキービジュアルがある場合（Q-Games）だった。
 * ここでは共通版のデザインを土台に、ページ名だけを小さく足す形にしている。
 * SNS に流れたときブランドの見え方が変わらないことを優先した。
 */
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** ページ別に作るもの。トップは共通版をそのまま使う */
const PAGES = [
  { file: "about", label: "About", ja: "スタジオについて" },
  { file: "gameyard", label: "GAMEYARD", ja: "つくることが、孤独な作業でなくなるように。" },
  { file: "works", label: "Works", ja: "作品" },
  { file: "news", label: "News", ja: "お知らせ" },
  { file: "brand", label: "Brand", ja: "ブランド素材" },
  { file: "contact", label: "Contact", ja: "お問い合わせ" },
  { file: "privacy", label: "Privacy", ja: "プライバシーポリシー" },
];

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

const SRC = pathToFileURL(join(ROOT, "tools/og-image.html")).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

async function shoot(url, out) {
  await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
  // Webフォントの読み込みを待つ（オフラインならフォールバックのまま進む）
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: out, type: "jpeg", quality: 88 });
  console.log(`  ${out.replace(ROOT + "/", "")}`);
}

console.log("OG画像を生成します");
await shoot(SRC, join(ROOT, "assets/img/og-image.jpg"));

mkdirSync(join(ROOT, "assets/img/og"), { recursive: true });
for (const { file, label, ja } of PAGES) {
  const url = `${SRC}?label=${encodeURIComponent(label)}&ja=${encodeURIComponent(ja)}`;
  await shoot(url, join(ROOT, `assets/img/og/${file}.jpg`));
}

await browser.close();
console.log(`完了（${PAGES.length + 1} 枚）`);
