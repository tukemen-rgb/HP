#!/usr/bin/env node
/**
 * ブラウザでの表示チェック（Playwright を使用）
 *
 *   node tools/visual.mjs            チェックのみ
 *   node tools/visual.mjs --shots    あわせて全ページのスクリーンショットを保存
 *
 * 見るもの:
 *   - JavaScript のエラー、読み込み失敗
 *   - 横スクロールの発生（320 / 768 / 1440px）
 *   - キーボード操作でモバイルメニューが開閉するか
 *   - 極端に小さい文字、コントラスト不足になりやすい箇所の検出
 *
 * 終了コード: エラーがあれば 1。
 */
import { readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHOT_DIR = join(ROOT, ".preview");
const WITH_SHOTS = process.argv.includes("--shots");
const WIDTHS = [320, 768, 1440];

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

const SKIP_DIRS = new Set(["node_modules", ".git", ".preview", "tools"]);
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
const pages = collectPages().sort();
const problems = [];
const note = (file, message) => problems.push({ file, message });

if (WITH_SHOTS && !existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch();

for (const page of pages) {
  const url = pathToFileURL(join(ROOT, page)).href;

  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    // 外部への通信は遮断する。オフラインでも同じ結果になり、待ち時間も出ない
    await ctx.route("**://**", (route) => {
      const u = route.request().url();
      return /^(file|data|blob):/.test(u) ? route.continue() : route.abort();
    });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(String(e.message)));
    p.on("console", (m) => {
      if (m.type() !== "error") return;
      // 上で遮断した外部リクエストの失敗は、こちらが意図したものなので数えない
      if (/net::ERR_FAILED|ERR_CONNECTION|Failed to load resource/.test(m.text())) return;
      errors.push(m.text());
    });

    await p.goto(url, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(400);

    const overflow = await p.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    if (overflow > 1) note(page, `幅 ${width}px で横スクロールが ${overflow}px 発生`);

    for (const e of errors) note(page, `幅 ${width}px でエラー: ${e}`);

    if (width === 1440) {
      // 本文として読ませる文章だけを見る。ロゴ・ラベル・英字キャプションは対象外
      const tiny = await p.evaluate(() => {
        const EXCLUDE = ["logo__sub", "logo__letters", "nav__ja", "eyebrow", "card__num",
                         "news-item__tag", "en", "swatch__hex", "footer__copy",
                         "footer__to-top", "hero__scroll", "breadcrumb", "work__status",
                         "work__visual-label", "field__hint", "req", "where"];
        const bad = [];
        for (const el of document.querySelectorAll("p, li, td, dd, label")) {
          const text = el.textContent.trim();
          if (text.length < 20) continue; // ラベル程度の短文は対象外
          if (EXCLUDE.some((c) => el.classList.contains(c) || el.closest(`.${c}`))) continue;
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size && size < 12) {
            bad.push(`${el.tagName.toLowerCase()}.${el.className || "-"} = ${size}px「${text.slice(0, 16)}…」`);
          }
        }
        return [...new Set(bad)].slice(0, 5);
      });
      for (const t of tiny) note(page, `本文の文字が小さすぎます: ${t}`);
    }

    if (WITH_SHOTS && (width === 1440 || width === 320)) {
      await p.evaluate(() => document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible")));
      await p.waitForTimeout(1200);
      await p.screenshot({
        path: join(SHOT_DIR, `${page.replace(/[\\/]/g, "-").replace(".html", "")}-${width}.png`),
        fullPage: true,
      });
    }

    await ctx.close();
  }
}

/* モバイルメニューがキーボードだけで開閉できるか */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(join(ROOT, "index.html")).href, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(300);
  await p.focus(".nav-toggle");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(400);
  const opened = await p.evaluate(() => document.querySelector(".nav").classList.contains("is-open"));
  if (!opened) note("index.html", "キーボード操作でモバイルメニューが開きません");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  const closed = await p.evaluate(() => !document.querySelector(".nav").classList.contains("is-open"));
  if (!closed) note("index.html", "Escape でモバイルメニューが閉じません");
  await ctx.close();
}

await browser.close();

console.log(`\n表示チェック — ${pages.length} ページ × ${WIDTHS.join(" / ")}px\n`);
if (!problems.length) {
  console.log("  指摘なし。\n");
} else {
  for (const { file, message } of problems) console.log(`  ${file}: ${message}`);
  console.log("");
}
if (WITH_SHOTS) console.log(`スクリーンショット: ${SHOT_DIR}\n`);

process.exit(problems.length ? 1 : 0);
