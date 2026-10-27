// E2E スモークテスト：静的サーバーを立てて Playwright（Chromium）で主要な流れを確認する
// 実行: npm run test:e2e   （SCREENSHOT_DIR を指定すると各タブのスクリーンショットを保存）
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Playwright の読み込み（プリインストール版を優先）
async function loadChromium() {
  try {
    const require = createRequire(import.meta.url);
    return require('playwright').chromium;
  } catch {
    const mod = await import('playwright');
    return (mod.default ?? mod).chromium;
  }
}

// 簡易静的ファイルサーバー（ポート 0 = 空きポート）
function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, path.normalize(p));
      if (!file.startsWith(ROOT + path.sep)) throw Object.assign(new Error('forbidden'), { code: 'EACCES' });
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
}

async function main() {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const chromium = await loadChromium();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ja-JP',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('dialog', (d) => d.accept());

  const shotDir = process.env.SCREENSHOT_DIR;
  if (shotDir) await mkdir(shotDir, { recursive: true });
  const text = (testid) => page.getByTestId(testid).first().textContent({ timeout: 5000 });
  const tab = async (name) => {
    await page.getByTestId(`tab-${name}`).click();
    await page.waitForTimeout(150);
  };
  const noHScroll = async (label) => {
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`横スクロールなし（${label}）`, w <= 390, `scrollWidth=${w}`);
  };
  const shot = async (name) => {
    if (!shotDir) return;
    await page.evaluate(() => document.getElementById('toast')?.classList.remove('show'));
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(shotDir, `${name}.png`), fullPage: true });
  };

  try {
    await page.goto(base);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId('dash-sales').waitFor();
    await noHScroll('空のダッシュボード');
    await shot('0-dashboard-empty');

    // サンプル読み込み
    await tab('data');
    await page.getByTestId('load-sample').click();
    await page.getByTestId('dash-sales').waitFor();

    // ダッシュボード
    check('売上合計 4,800円', (await text('dash-sales')) === '4,800円', await text('dash-sales'));
    check('経費合計 2,330円', (await text('dash-expenses')) === '2,330円', await text('dash-expenses'));
    check('利益 2,470円', (await text('dash-profit')) === '2,470円', await text('dash-profit'));
    check('在庫金額 11,500円', (await text('dash-inventory')) === '11,500円', await text('dash-inventory'));
    await noHScroll('ダッシュボード');
    await shot('1-dashboard');

    // 棚卸し
    await tab('inventory');
    check('棚卸し合計 11,500円', (await text('inventory-total')) === '11,500円', await text('inventory-total'));
    await noHScroll('棚卸し');
    await shot('2-inventory');

    // 原価計算
    await tab('cost');
    const cost = (name) => page.locator(`[data-testid="product-cost"][data-product-name="${name}"]`).textContent({ timeout: 5000 });
    check('ブレスレット原価 1,272.5円', (await cost('ブレスレット')) === '1,272.5円', await cost('ブレスレット'));
    check('ピアス原価 510円', (await cost('ピアス')) === '510円', await cost('ピアス'));
    await noHScroll('原価計算');
    await shot('4-cost');

    // 売上・経費：経費を追加（自動判定 → 送料）
    await tab('ledger');
    await shot('3-ledger');
    await noHScroll('売上・経費');
    const AMOUNT = 230;
    await page.getByTestId('ledger-type-expense').click();
    await page.getByTestId('ledger-description').fill('ゆうパケット発送');
    check('入力中の自動判定が「送料」', (await text('ledger-auto-category')) === '送料', await text('ledger-auto-category'));
    await page.getByTestId('ledger-amount').fill(String(AMOUNT));
    await page.getByTestId('ledger-submit').click();
    const row = page.getByTestId('entry-row').filter({ hasText: 'ゆうパケット発送' });
    check('追加した経費が一覧に表示', (await row.count()) === 1);
    const chipText = await row.getByTestId('entry-category').evaluate((s) => s.selectedOptions[0]?.textContent ?? '');
    check('一覧のカテゴリが送料（自動）', chipText.includes('送料'), chipText);
    const stored = await page.evaluate(() => {
      const st = JSON.parse(localStorage.getItem('tanaoroshi-app-v1') || '{}');
      return (st.entries || []).find((e) => e.description === 'ゆうパケット発送');
    });
    check('自動判定は category:null / categoryManual:false で保存', stored && stored.category === null && stored.categoryManual === false, JSON.stringify(stored));
    const expected = `${(2330 + AMOUNT).toLocaleString('ja-JP')}円`;
    check(`売上・経費の経費合計 ${expected}`, (await text('ledger-expenses')) === expected, await text('ledger-expenses'));
    await tab('dashboard');
    check(`ダッシュボード経費 ${expected}`, (await text('dash-expenses')) === expected, await text('dash-expenses'));

    // リロード後も保持
    await page.reload();
    await page.getByTestId('dash-expenses').waitFor();
    check('リロード後も経費合計を保持', (await text('dash-expenses')) === expected, await text('dash-expenses'));
    await tab('ledger');
    check('リロード後も追加した経費を保持', (await page.getByTestId('entry-row').filter({ hasText: 'ゆうパケット発送' }).count()) === 1);

    // データ画面
    await tab('data');
    await noHScroll('データ');
    await shot('5-data');

    // CSV 書き出し → 全削除 → 取り込みで元に戻る
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-csv').click()]);
    const csvPath = await download.path();
    const csv = await readFile(csvPath, 'utf8');
    check('CSV は BOM 付き＋日本語ヘッダー', csv.startsWith('﻿日付,内容,金額,区分,カテゴリ'), csv.slice(0, 30));
    await page.getByTestId('clear-all').click();
    await tab('dashboard');
    check('全削除で売上 0円', (await text('dash-sales')) === '0円', await text('dash-sales'));
    await tab('data');
    await page.locator('#csv-file').setInputFiles(csvPath);
    await page.getByTestId('import-result').waitFor();
    check('CSV 取り込み 9件', (await text('import-result')).includes('9件'), await text('import-result'));
    await tab('dashboard');
    check('取り込み後の売上 4,800円', (await text('dash-sales')) === '4,800円', await text('dash-sales'));
    check(`取り込み後の経費 ${expected}`, (await text('dash-expenses')) === expected, await text('dash-expenses'));
  } catch (e) {
    check('テスト実行中の例外なし', false, e.message.split('\n')[0]);
  } finally {
    check('コンソールエラー／ページエラーなし', consoleErrors.length === 0, consoleErrors.join(' | '));
    await browser.close();
    server.close();
  }

  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.ok ? `  (${r.detail})` : ''}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed${shotDir ? `  screenshots: ${shotDir}` : ''}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('FAIL  E2E の起動に失敗しました:', e);
  process.exit(1);
});
