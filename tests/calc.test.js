import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPENSE_CATEGORIES,
  CATEGORY_KEYWORDS,
  categorize,
  effectiveCategory,
  roundMoney,
  inventoryAmount,
  inventoryTotal,
  ledgerTotals,
  expensesByCategory,
  materialUnitCost,
  productCostBreakdown,
  productCost,
  buildSummary,
  formatYen,
} from '../js/core/calc.js';

const PRIORITY = ['販売手数料・利用料', '送料', '梱包資材', '広告', '材料費'];

const expense = (description, amount, category = null, extra = {}) => ({
  id: description, date: '2026-01-01', description, amount, type: 'expense',
  category, categoryManual: category !== null, ...extra,
});
const sale = (description, amount) => ({
  id: description, date: '2026-01-01', description, amount, type: 'sale',
  category: null, categoryManual: false,
});

describe('定数', () => {
  test('EXPENSE_CATEGORIES は仕様どおりの 6 カテゴリ（順序含む）', () => {
    assert.deepEqual(EXPENSE_CATEGORIES, ['材料費', '送料', '販売手数料・利用料', '梱包資材', '広告', 'その他']);
  });

  test('CATEGORY_KEYWORDS は その他 以外の全カテゴリにキーワード配列を持つ', () => {
    assert.equal(CATEGORY_KEYWORDS['その他'], undefined);
    for (const c of PRIORITY) {
      assert.ok(Array.isArray(CATEGORY_KEYWORDS[c]), c);
      assert.ok(CATEGORY_KEYWORDS[c].length > 0, c);
    }
  });
});

describe('categorize', () => {
  test('代表的な内容を各カテゴリに判定する', () => {
    const cases = [
      ['天然石ビーズ購入', '材料費'],
      ['クリックポスト送料', '送料'],
      ['ゆうパケット 送料', '送料'],
      ['minne販売手数料', '販売手数料・利用料'],
      ['Creema 手数料', '販売手数料・利用料'],
      ['OPP袋（梱包用）', '梱包資材'],
      ['梱包用ダンボール', '梱包資材'],
      ['Instagram広告', '広告'],
      ['ネット広告費', '広告'],
      ['文房具（ノート）', 'その他'],
    ];
    for (const [desc, cat] of cases) assert.equal(categorize(desc), cat, desc);
  });

  test('CATEGORY_KEYWORDS の各キーワードは、より優先度の高いキーワードを含まない限り自カテゴリになる', () => {
    for (const [i, cat] of PRIORITY.entries()) {
      for (const kw of CATEGORY_KEYWORDS[cat]) {
        const higher = PRIORITY.slice(0, i).find((h) =>
          CATEGORY_KEYWORDS[h].some((k) => kw.toLowerCase().includes(k.toLowerCase())));
        const expected = higher ?? cat;
        assert.equal(categorize(kw), expected, `キーワード「${kw}」`);
        assert.equal(categorize(`購入：${kw}（追加）`), expected, `前後に文字がある「${kw}」`);
      }
    }
  });

  test('英字は大文字小文字を無視する', () => {
    assert.equal(categorize('opp袋'), '梱包資材');
    assert.equal(categorize('Opp袋'), '梱包資材');
    assert.equal(categorize('OPP袋'), '梱包資材');
    for (const cat of PRIORITY) {
      for (const kw of CATEGORY_KEYWORDS[cat]) {
        if (!/[a-z]/i.test(kw)) continue;
        assert.equal(categorize(kw.toUpperCase()), categorize(kw), `${kw} の大文字`);
        assert.equal(categorize(kw.toLowerCase()), categorize(kw), `${kw} の小文字`);
      }
    }
  });

  test('判定順: 販売手数料・利用料 → 送料 → 梱包資材 → 広告 → 材料費', () => {
    assert.equal(categorize('ゆうパケット送料の手数料'), '販売手数料・利用料');
    // 各ペアについて、上位カテゴリのキーワードが優先される
    for (let i = 0; i < PRIORITY.length; i++) {
      for (let j = i + 1; j < PRIORITY.length; j++) {
        const hi = CATEGORY_KEYWORDS[PRIORITY[i]][0];
        const lo = CATEGORY_KEYWORDS[PRIORITY[j]][0];
        assert.equal(categorize(`${lo}と${hi}`), PRIORITY[i], `${lo} vs ${hi}`);
        assert.equal(categorize(`${hi}と${lo}`), PRIORITY[i], `${hi} vs ${lo}`);
      }
    }
  });

  test('該当なし・空文字は その他', () => {
    assert.equal(categorize('文房具'), 'その他');
    assert.equal(categorize('xyz'), 'その他');
    assert.equal(categorize(''), 'その他');
  });
});

describe('effectiveCategory', () => {
  test('category が null なら自動判定', () => {
    assert.equal(effectiveCategory(expense('クリックポスト送料', 185)), '送料');
  });

  test('手動カテゴリが有効なら自動判定より優先', () => {
    assert.equal(effectiveCategory(expense('クリックポスト送料', 185, '広告')), '広告');
    assert.equal(effectiveCategory(expense('文房具', 100, '材料費')), '材料費');
  });

  test('無効なカテゴリは自動判定にフォールバック', () => {
    assert.equal(effectiveCategory(expense('クリックポスト送料', 185, '謎カテゴリ')), '送料');
    assert.equal(effectiveCategory(expense('文房具', 100, '')), 'その他');
  });

  test('売上は null', () => {
    assert.equal(effectiveCategory(sale('ブレスレット販売', 3000)), null);
    assert.equal(effectiveCategory({ ...sale('送料込み販売', 1000), category: '送料', categoryManual: true }), null);
  });
});

describe('roundMoney', () => {
  test('浮動小数誤差を吸収する', () => {
    assert.equal(roundMoney(0.1 + 0.2), 0.3);
    assert.equal(roundMoney(22.500000000000004), 22.5);
    assert.equal(roundMoney(1272.4999999999998), 1272.5);
  });

  test('整数はそのまま', () => {
    assert.equal(roundMoney(0), 0);
    assert.equal(roundMoney(11500), 11500);
  });
});

describe('在庫金額', () => {
  test('inventoryAmount は 数量 × 単価', () => {
    assert.equal(inventoryAmount({ id: '1', name: 'a', quantity: 10, unitPrice: 500 }), 5000);
    assert.equal(inventoryAmount({ id: '2', name: 'b', quantity: 3, unitPrice: 0.1 }), 0.3);
  });

  test('inventoryTotal は合計、空配列は 0', () => {
    assert.equal(inventoryTotal([]), 0);
    assert.equal(inventoryTotal([
      { id: '1', name: 'a', quantity: 10, unitPrice: 500 },
      { id: '2', name: 'b', quantity: 3, unitPrice: 1500 },
    ]), 9500);
  });
});

describe('ledgerTotals / expensesByCategory', () => {
  test('空配列はすべて 0', () => {
    assert.deepEqual(ledgerTotals([]), { sales: 0, expenses: 0, profit: 0 });
    const byCat = expensesByCategory([]);
    assert.deepEqual(Object.keys(byCat).sort(), [...EXPENSE_CATEGORIES].sort());
    for (const v of Object.values(byCat)) assert.equal(v, 0);
  });

  test('売上・経費・利益を集計する（赤字もそのまま）', () => {
    const entries = [sale('販売', 1000), expense('送料', 300), expense('材料ビーズ', 1200)];
    assert.deepEqual(ledgerTotals(entries), { sales: 1000, expenses: 1500, profit: -500 });
  });

  test('expensesByCategory は 6 キーすべてを持ち、売上を含めず手動カテゴリを反映', () => {
    const entries = [
      sale('販売', 5000),
      expense('クリックポスト送料', 185),
      expense('クリックポスト送料', 100, '広告'),
      expense('文房具', 50),
    ];
    const byCat = expensesByCategory(entries);
    assert.deepEqual(Object.keys(byCat).sort(), [...EXPENSE_CATEGORIES].sort());
    assert.equal(byCat['送料'], 185);
    assert.equal(byCat['広告'], 100);
    assert.equal(byCat['その他'], 50);
    assert.equal(byCat['材料費'], 0);
  });
});

describe('原価計算', () => {
  const materials = [
    { id: 'm1', name: '天然石ビーズ', price: 1500, quantity: 60, unit: '個' },
    { id: 'm2', name: 'ゴムテグス', price: 500, quantity: 1000, unit: 'cm' },
    { id: 'm3', name: '在庫ゼロ', price: 300, quantity: 0, unit: '個' },
  ];

  test('materialUnitCost は price / quantity、quantity ≤ 0 は 0', () => {
    assert.equal(materialUnitCost(materials[0]), 25);
    assert.equal(materialUnitCost(materials[1]), 0.5);
    assert.equal(materialUnitCost(materials[2]), 0);
    assert.equal(materialUnitCost({ ...materials[2], quantity: -5 }), 0);
  });

  test('productCost は小数の使用量にも対応', () => {
    const p = { id: 'p', name: 'テスト', components: [{ materialId: 'm2', amount: 45 }, { materialId: 'm1', amount: 0.5 }] };
    assert.equal(productCost(p, materials), 35); // 22.5 + 12.5
    const p2 = { id: 'p2', name: 'テスト2', components: [{ materialId: 'm2', amount: 45 }] };
    assert.equal(productCost(p2, materials), 22.5);
  });

  test('部品なしの作品は原価 0', () => {
    assert.equal(productCost({ id: 'p', name: '空', components: [] }, materials), 0);
  });

  test('productCostBreakdown は見つからない材料を missing として cost 0 にする', () => {
    const p = { id: 'p', name: 'テスト', components: [{ materialId: 'm1', amount: 20 }, { materialId: 'nope', amount: 3 }] };
    const rows = productCostBreakdown(p, materials);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].materialId, 'm1');
    assert.equal(rows[0].name, '天然石ビーズ');
    assert.equal(rows[0].unit, '個');
    assert.equal(rows[0].amount, 20);
    assert.equal(rows[0].unitCost, 25);
    assert.equal(rows[0].cost, 500);
    assert.equal(rows[0].missing, false);
    assert.equal(rows[1].materialId, 'nope');
    assert.equal(rows[1].missing, true);
    assert.equal(rows[1].cost, 0);
    assert.equal(productCost(p, materials), 500);
  });
});

describe('buildSummary / formatYen', () => {
  test('buildSummary は空の状態で 0 を返す', () => {
    const s = buildSummary({ inventory: [], entries: [], materials: [], products: [] });
    assert.equal(s.sales, 0);
    assert.equal(s.expenses, 0);
    assert.equal(s.profit, 0);
    assert.equal(s.inventoryTotal, 0);
    assert.deepEqual(Object.keys(s.byCategory).sort(), [...EXPENSE_CATEGORIES].sort());
  });

  test('formatYen は桁区切り＋円、小数は最大 2 桁', () => {
    assert.equal(formatYen(0), '0円');
    assert.equal(formatYen(1234567), '1,234,567円');
    assert.equal(formatYen(22.5), '22.5円');
    assert.equal(formatYen(0.1 + 0.2), '0.3円');
    assert.equal(formatYen(1.25), '1.25円');
  });
});
