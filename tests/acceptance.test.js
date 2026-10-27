import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inventoryTotal,
  ledgerTotals,
  productCost,
  formatYen,
  effectiveCategory,
  expensesByCategory,
  buildSummary,
  EXPENSE_CATEGORIES,
} from '../js/core/calc.js';
import { entriesToCsv, csvToEntries } from '../js/core/csv.js';
import {
  SAMPLE_INVENTORY,
  SAMPLE_ENTRIES,
  SAMPLE_MATERIALS,
  SAMPLE_PRODUCTS,
  createSampleState,
} from '../js/core/sample.js';

const EXPECTED_EXPENSES = [
  ['天然石ビーズ購入', 1200, '材料費'],
  ['クリックポスト送料', 185, '送料'],
  ['minne販売手数料', 480, '販売手数料・利用料'],
  ['OPP袋（梱包用）', 180, '梱包資材'],
  ['Instagram広告', 100, '広告'],
  ['文房具（ノート）', 185, 'その他'],
];

function findProduct(products, keyword) {
  const p = products.find((x) => x.name.includes(keyword));
  assert.ok(p, `作品「${keyword}」がサンプルに存在すること`);
  return p;
}

test('SAMPLE_* がすべて配列としてエクスポートされている', () => {
  for (const arr of [SAMPLE_INVENTORY, SAMPLE_ENTRIES, SAMPLE_MATERIALS, SAMPLE_PRODUCTS]) {
    assert.ok(Array.isArray(arr));
    assert.ok(arr.length > 0);
  }
});

test('棚卸し在庫金額合計は 11,500円', () => {
  const state = createSampleState();
  assert.equal(inventoryTotal(state.inventory), 11500);
  assert.equal(inventoryTotal(SAMPLE_INVENTORY), 11500);
  assert.equal(buildSummary(state).inventoryTotal, 11500);
});

test('売上 4,800円 / 経費 2,330円 / 利益 2,470円', () => {
  const state = createSampleState();
  assert.deepEqual(ledgerTotals(state.entries), { sales: 4800, expenses: 2330, profit: 2470 });
  const summary = buildSummary(state);
  assert.equal(summary.sales, 4800);
  assert.equal(summary.expenses, 2330);
  assert.equal(summary.profit, 2470);
});

test('原価: ブレスレット 1,272.5円 / ピアス 510円', () => {
  const state = createSampleState();
  assert.equal(productCost(findProduct(state.products, 'ブレスレット'), state.materials), 1272.5);
  assert.equal(productCost(findProduct(state.products, 'ピアス'), state.materials), 510);
});

test('formatYen の表示形式', () => {
  assert.equal(formatYen(11500), '11,500円');
  assert.equal(formatYen(1272.5), '1,272.5円');
  assert.equal(formatYen(510), '510円');
});

test('サンプル経費 6件がそれぞれ期待カテゴリに自動判定される', () => {
  const state = createSampleState();
  const expenses = state.entries.filter((e) => e.type === 'expense');
  assert.equal(expenses.length, 6);
  for (const [desc, amount, category] of EXPECTED_EXPENSES) {
    const e = expenses.find((x) => x.description === desc);
    assert.ok(e, `経費「${desc}」が存在すること`);
    assert.equal(e.amount, amount, desc);
    assert.equal(e.category, null, `${desc} は category: null`);
    assert.equal(effectiveCategory(e), category, desc);
  }
});

test('サンプルの売上は effectiveCategory が null', () => {
  const sales = createSampleState().entries.filter((e) => e.type === 'sale');
  assert.equal(sales.length, 2);
  for (const s of sales) assert.equal(effectiveCategory(s), null);
});

test('expensesByCategory はカテゴリごとの金額で合計 2,330円', () => {
  const state = createSampleState();
  const byCat = expensesByCategory(state.entries);
  const expected = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0]));
  for (const [, amount, category] of EXPECTED_EXPENSES) expected[category] += amount;
  assert.deepEqual(byCat, expected);
  const sum = Object.values(byCat).reduce((a, b) => a + b, 0);
  assert.equal(sum, 2330);
  assert.deepEqual(buildSummary(state).byCategory, expected);
});

test('サンプル明細の CSV 往復で合計とカテゴリが保たれる', () => {
  const state = createSampleState();
  const csv = entriesToCsv(state.entries);
  const { entries, errors } = csvToEntries(csv);
  assert.deepEqual(errors, []);
  assert.equal(entries.length, state.entries.length);
  assert.deepEqual(ledgerTotals(entries), { sales: 4800, expenses: 2330, profit: 2470 });
  assert.deepEqual(expensesByCategory(entries), expensesByCategory(state.entries));
  for (const [desc, , category] of EXPECTED_EXPENSES) {
    const e = entries.find((x) => x.description === desc);
    assert.ok(e, desc);
    assert.equal(effectiveCategory(e), category, desc);
  }
});

test('createSampleState() はディープコピーを返す', () => {
  const a = createSampleState();
  const snapshot = JSON.parse(JSON.stringify(createSampleState()));
  a.inventory[0].quantity = 9999;
  a.inventory.push({ id: 'x', name: 'x', quantity: 1, unitPrice: 1 });
  a.entries[0].amount = 1;
  a.materials[0].price = 1;
  a.products[0].components[0].amount = 999;
  a.products[0].components.push({ materialId: 'zzz', amount: 1 });
  const b = createSampleState();
  assert.notEqual(a, b);
  assert.deepEqual(JSON.parse(JSON.stringify(b)), snapshot);
  assert.equal(inventoryTotal(SAMPLE_INVENTORY), 11500);
});
