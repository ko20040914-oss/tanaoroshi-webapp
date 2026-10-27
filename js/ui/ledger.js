// 売上・経費：登録フォーム（カテゴリ自動判定つき）と一覧
import { categorize, effectiveCategory, EXPENSE_CATEGORIES, formatYen, ledgerTotals } from '../core/calc.js';
import { newId } from '../core/storage.js';
import { h, field, checkPositive, todayStr, emptyNote, btn } from './dom.js';

let editingId = null;
let filter = 'all';
let lastType = 'sale';

const FILTERS = [['all', 'すべて'], ['sale', '売上'], ['expense', '経費']];

/** カテゴリ選択肢（先頭は自動判定） */
function categoryOptions(autoLabel) {
  return [h('option', { value: '', text: autoLabel }), ...EXPENSE_CATEGORIES.map((c) => h('option', { value: c, text: c }))];
}

export function renderLedger(ctx) {
  const { state } = ctx;
  const editing = state.entries.find((e) => e.id === editingId) || null;
  if (!editing) editingId = null;
  let type = editing ? editing.type : lastType;
  const totals = ledgerTotals(state.entries);

  // --- フォーム ---
  const segBtn = (value, label) =>
    h('button', { type: 'button', role: 'radio', class: 'seg-btn', dataset: { value }, 'data-testid': `ledger-type-${value}`, onclick: () => setType(value) }, label);
  const seg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': '区分' }, segBtn('sale', '売上'), segBtn('expense', '経費'));

  const date = field('日付', h('input', { type: 'date', value: editing?.date ?? todayStr(), required: true }));
  const desc = field('内容', h('input', { type: 'text', autocomplete: 'off', placeholder: '例：クリックポスト送料', 'data-testid': 'ledger-description', value: editing?.description ?? '' }));
  const amount = field('金額（円）', h('input', { type: 'text', inputmode: 'numeric', placeholder: '1200', 'data-testid': 'ledger-amount', value: editing?.amount ?? '' }));

  const autoText = h('strong', { 'data-testid': 'ledger-auto-category' });
  const autoNote = h('p', { class: 'auto-note' }, '自動判定：', autoText);
  const catSelect = h('select', { 'data-testid': 'ledger-category' },
    categoryOptions('自動判定'));
  catSelect.value = editing?.categoryManual && editing.category ? editing.category : '';
  const cat = field('カテゴリ', catSelect, { hint: autoNote });
  cat.el.classList.add('cat-field');

  // 内容の入力に合わせて自動判定カテゴリを表示
  const updateAuto = () => {
    const c = categorize(desc.input.value.trim());
    autoText.textContent = c;
    autoNote.classList.toggle('overridden', catSelect.value !== '');
    autoNote.title = catSelect.value !== '' ? '手動指定が優先されます' : '';
  };
  desc.input.addEventListener('input', updateAuto);
  catSelect.addEventListener('change', updateAuto);

  function setType(t) {
    type = t;
    for (const b of seg.children) b.setAttribute('aria-checked', String(b.dataset.value === t));
    cat.el.hidden = t !== 'expense';
  }
  setType(type);
  updateAuto();

  const onSubmit = (e) => {
    e.preventDefault();
    const d = date.input.value;
    const text = desc.input.value.trim();
    const a = checkPositive(amount.input.value, '金額');
    date.setError(/^\d{4}-\d{2}-\d{2}$/.test(d) ? '' : '日付を入力してください');
    desc.setError(text ? '' : '内容を入力してください');
    amount.setError(a.error);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !text || a.error) return;
    const manual = type === 'expense' && catSelect.value !== '';
    const data = {
      date: d, description: text, amount: a.value, type,
      category: manual ? catSelect.value : null,
      categoryManual: manual,
    };
    if (editing) Object.assign(editing, data);
    else state.entries.push({ id: newId(), ...data });
    lastType = type;
    ctx.toast(editing ? '更新しました' : `${type === 'sale' ? '売上' : '経費'}を追加しました`);
    editingId = null;
    ctx.commit();
  };

  const form = h('form', { class: 'card form', onsubmit: onSubmit, novalidate: true },
    h('h2', { text: editing ? '記録を編集' : '売上・経費を記録' }),
    seg,
    h('div', { class: 'grid-2' }, date.el, amount.el),
    desc.el,
    cat.el,
    h('div', { class: 'form-actions' },
      editing && btn('キャンセル', () => { editingId = null; ctx.render(); }, 'btn btn-ghost'),
      h('button', { type: 'submit', class: 'btn btn-primary', 'data-testid': 'ledger-submit' }, editing ? '更新する' : '記録する')));

  // --- 一覧（日付の新しい順、同日は後から追加した順） ---
  const rows = state.entries
    .map((e, i) => [e, i])
    .filter(([e]) => filter === 'all' || e.type === filter)
    .sort(([a, ia], [b, ib]) => String(b.date).localeCompare(String(a.date)) || ib - ia)
    .map(([e]) => entryRow(ctx, e));

  const filterTabs = h('div', { class: 'filter-tabs', role: 'tablist' },
    FILTERS.map(([v, label]) => h('button', {
      type: 'button', role: 'tab', class: 'filter-tab', 'aria-selected': String(filter === v),
      onclick: () => { filter = v; ctx.render(); },
    }, label)));

  return h('div', { class: 'view' },
    h('section', { class: 'mini-stats' },
      h('div', {}, h('span', { text: '売上' }), h('strong', { class: 'pos', 'data-testid': 'ledger-sales', text: formatYen(totals.sales) })),
      h('div', {}, h('span', { text: '経費' }), h('strong', { 'data-testid': 'ledger-expenses', text: formatYen(totals.expenses) })),
      h('div', {}, h('span', { text: '利益' }), h('strong', { class: totals.profit < 0 ? 'neg' : '', 'data-testid': 'ledger-profit', text: formatYen(totals.profit) }))),
    form,
    h('section', { class: 'card' },
      h('h2', { text: '記録一覧' }),
      filterTabs,
      rows.length ? h('ul', { class: 'list' }, rows) : emptyNote('該当する記録はありません。')));
}

function entryRow(ctx, e) {
  const isSale = e.type === 'sale';
  let tag;
  if (isSale) {
    tag = h('span', { class: 'chip chip-sale', text: '売上' });
  } else {
    // カテゴリチップ（その場で変更可。自動判定に戻すこともできる）
    const sel = h('select', {
      class: 'chip-select', 'aria-label': 'カテゴリを変更', 'data-testid': 'entry-category',
      onchange: () => {
        const v = sel.value;
        e.category = v || null;
        e.categoryManual = !!v;
        ctx.toast(v ? `カテゴリを「${v}」に変更しました` : '自動判定に戻しました');
        ctx.commit();
      },
    }, categoryOptions(`${categorize(e.description)}（自動）`));
    sel.value = e.categoryManual && EXPENSE_CATEGORIES.includes(e.category) ? e.category : '';
    tag = h('span', { class: `chip chip-expense${e.categoryManual ? ' manual' : ''}`, title: effectiveCategory(e) }, sel);
  }
  return h('li', { class: 'row', 'data-testid': 'entry-row', dataset: { type: e.type } },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title', text: e.description }),
      h('div', { class: 'row-sub' }, h('span', { text: String(e.date).replaceAll('-', '/') }), tag)),
    h('div', { class: `row-amount ${isSale ? 'pos' : 'expense'}`, text: `${isSale ? '+' : '−'}${formatYen(e.amount)}` }),
    h('div', { class: 'row-actions' },
      btn('編集', () => { editingId = e.id; ctx.render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }),
      btn('削除', () => {
        if (!confirm(`「${e.description}」を削除しますか？`)) return;
        ctx.state.entries = ctx.state.entries.filter((x) => x.id !== e.id);
        ctx.toast('削除しました');
        ctx.commit();
      }, 'btn btn-ghost btn-sm danger')));
}
