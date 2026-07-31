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
 *   - 極端に小さい文字
 *   - 文字色と背景色のコントラスト比（WCAG AA: 4.5:1、大きな文字は 3:1）
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
/** 背景がグラデーション・画像で、コントラスト比を計算できなかった箇所の数 */
const unmeasured = new Map();

/**
 * コントラスト比（WCAG AA）を測る。ページの中で実行される関数なので、
 * 外の変数は使わずここだけで完結させている。
 * 背景がグラデーションのときは、いちばん条件の悪い色で判定する。
 * 画像が敷いてある場合だけは計算できないので unknown として数だけ返す。
 */
const MEASURE_CONTRAST = () => {
  const parse = (c) => {
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]];
  };
  const over = (fg, bg) => {
    // fg を bg の上に重ねた結果（fg は半透明のことがある）
    const a = fg[3];
    return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1);
  };
  const lum = ([r, g, b]) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };

  /**
   * 祖先をたどって、文字の下に見えている背景色を求める。
   * グラデーションは位置によって色が変わるので、途中の色をすべて候補として返し、
   * 呼び出し側でいちばん条件の悪いものを使う（最悪値での判定）。
   * 画像が敷いてある場合だけは計算できないので unknown を返す。
   */
  const backdrop = (el, from) => {
    let acc = null; // 手前から奥へ重ねていく
    let started = false;
    for (let n = el; n; n = n.parentElement) {
      if (from && !started) { if (n !== from) continue; started = true; }
      const s = getComputedStyle(n);
      const bi = s.backgroundImage;
      if (bi !== "none") {
        if (bi.includes("url(")) return { unknown: true };
        const stops = bi.match(/rgba?\([^)]+\)/g) || [];
        if (!stops.length) return { unknown: true };
        const under = backdrop(n.parentElement, n.parentElement);
        if (under.unknown) return { unknown: true };
        const out = [];
        for (const st of stops) {
          const c = parse(st);
          if (!c) continue;
          const front = acc ? over(acc, c) : c;
          for (const u of under.colors) out.push(over(front, u));
        }
        return out.length ? { colors: out } : { unknown: true };
      }
      const c = parse(s.backgroundColor);
      if (!c || c[3] === 0) continue;
      acc = acc ? over(acc, c) : c;
      if (acc[3] >= 0.999) return { colors: [acc] };
    }
    const base = [255, 255, 255, 1];
    return { colors: [acc ? over(acc, base) : base] };
  };

  const bad = [];
  let unknown = 0;
  for (const el of document.querySelectorAll("body *")) {
    // 自分が直接持っている文字だけを見る（子要素の文字は子の側で測る）
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join("");
    if (!own) continue;
    // ロゴタイプは WCAG 1.4.3 の対象外。加えてメニューを開いた状態では
    // 背景を塗っているのが祖先ではなく兄弟（ドロワー）なので、正しく測れない
    if (el.closest(".logo")) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || +s.opacity === 0) continue;
    if (!el.getClientRects().length) continue;

    const bg = backdrop(el);
    if (bg.unknown) { unknown++; continue; }
    const fgRaw = parse(s.color);
    if (!fgRaw) continue;

    const size = parseFloat(s.fontSize);
    const bold = +s.fontWeight >= 700;
    // 24px 以上、または 18.66px 以上の太字は「大きな文字」扱い
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    // 背景に幅がある（グラデーション）ときは、いちばん条件の悪いところで見る
    let r = Infinity;
    for (const b of bg.colors) r = Math.min(r, ratio(over(fgRaw, b), b));
    if (r + 0.005 < need) {
      bad.push(
        `${el.tagName.toLowerCase()}.${(el.className || "-").toString().split(" ")[0]} ` +
        `= ${r.toFixed(2)}:1（必要 ${need}:1・${Math.round(size)}px）「${own.slice(0, 14)}」`
      );
    }
  }
return { bad: [...new Set(bad)].slice(0, 8), unknown };
};

/** ページの現在の状態でコントラストを測り、見つかった不足を記録する */
async function checkContrast(p, page, where) {
  const { bad, unknown } = await p.evaluate(MEASURE_CONTRAST);
  for (const c of bad) note(page, `${where}でコントラスト不足: ${c}`);
  if (unknown) unmeasured.set(page, Math.max(unmeasured.get(page) || 0, unknown));
}

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

    await checkContrast(p, page, `幅 ${width}px`);

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
  // 開いた状態でしか見えない配色（ドロワー）もここで測る
  if (opened) await checkContrast(p, "index.html", "メニューを開いた状態");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  const closed = await p.evaluate(() => !document.querySelector(".nav").classList.contains("is-open"));
  if (!closed) note("index.html", "Escape でモバイルメニューが閉じません");
  await ctx.close();
}

/* 外部（Webフォントなど）が遅いときでも、本文の描画がそれを待たないか。
   Google Fonts の CSS を普通の <link rel="stylesheet"> で読むと、
   その応答が返るまでページが真っ白になる。実測で 13 秒待たされたことがある */
{
  const SLOW = 5000; // 外部の応答をこれだけ遅らせる
  const LIMIT = 1500; // 本文はこの時間までに出てほしい
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route("**://**", async (route) => {
    if (/^(file|data|blob):/.test(route.request().url())) return route.continue();
    await new Promise((r) => setTimeout(r, SLOW));
    return route.abort();
  });
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(join(ROOT, "index.html")).href, { waitUntil: "commit" });
  const fcp = await p.evaluate(
    (limit) =>
      new Promise((res) => {
        const done = (v) => res(v);
        new PerformanceObserver((list, obs) => {
          const e = list.getEntriesByName("first-contentful-paint")[0];
          if (e) { obs.disconnect(); done(Math.round(e.startTime)); }
        }).observe({ type: "paint", buffered: true });
        setTimeout(() => done(null), limit + 1500);
      }),
    LIMIT
  );
  if (fcp === null || fcp > LIMIT) {
    const how = fcp === null ? `${LIMIT + 1500}ms 経っても描画されません` : `描画まで ${fcp}ms かかります`;
    note("index.html", `外部の応答が遅いとき、${how}`
      + `（${LIMIT}ms 以内が目安。描画を止める外部リソースが増えていないか確認）`);
  }
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
if (unmeasured.size) {
  const total = [...unmeasured.values()].reduce((a, b) => a + b, 0);
  console.log(`背景がグラデーション・画像のため計算できなかった箇所: ${total}（目視で確認）`);
  for (const [file, n] of unmeasured) console.log(`  ${file}: ${n}`);
  console.log("");
}
if (WITH_SHOTS) console.log(`スクリーンショット: ${SHOT_DIR}\n`);

process.exit(problems.length ? 1 : 0);
