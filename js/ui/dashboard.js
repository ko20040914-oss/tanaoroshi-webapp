// ダッシュボード：集計カードとカテゴリ別経費
import { buildSummary, formatYen, EXPENSE_CATEGORIES } from '../core/calc.js';
import { h } from './dom.js';

export function renderDashboard(ctx) {
  const { state } = ctx;
  const s = buildSummary(state);
  const isEmpty =
    !state.inventory.length && !state.entries.length && !state.materials.length && !state.products.length;

  const card = (label, value, testid, cls = '') =>
    h('div', { class: `stat ${cls}` }, h('span', { class: 'stat-label', text: label }),
      h('strong', { class: 'stat-value', 'data-testid': testid, text: formatYen(value) }));

  const max = Math.max(0, ...EXPENSE_CATEGORIES.map((c) => s.byCategory[c] || 0));
  const bars = EXPENSE_CATEGORIES.map((c) => {
    const v = s.byCategory[c] || 0;
    const pct = max > 0 ? (v / max) * 100 : 0;
    return h('li', { class: 'bar-row' },
      h('div', { class: 'bar-head' }, h('span', { text: c }), h('span', { class: 'num', text: formatYen(v) })),
      h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: { width: `${pct}%` } })));
  });

  return h('div', { class: 'view' },
    isEmpty && h('section', { class: 'card hint' },
      h('p', { class: 'hint-title', text: 'まだデータがありません' }),
      h('p', { text: 'まずはサンプルデータで使い方を確認してみませんか？ 棚卸し・売上・経費・原価計算の例が入ります。' }),
      h('button', { type: 'button', class: 'btn btn-primary', 'data-testid': 'empty-load-sample', onclick: () => ctx.go('data') },
        'サンプルデータを試す')),
    h('section', { class: 'stats' },
      card('売上合計', s.sales, 'dash-sales'),
      card('経費合計', s.expenses, 'dash-expenses'),
      card('利益', s.profit, 'dash-profit', s.profit < 0 ? 'negative' : 'profit'),
      card('在庫金額', s.inventoryTotal, 'dash-inventory')),
    h('section', { class: 'card' },
      h('h2', { text: 'カテゴリ別経費' }),
      h('ul', { class: 'bars' }, bars)));
}
