// 棚卸し：品目の登録と在庫金額の一覧
import { formatYen, inventoryAmount, inventoryTotal } from '../core/calc.js';
import { newId } from '../core/storage.js';
import { h, field, checkPositive, formatNum, emptyNote, btn } from './dom.js';

let editingId = null;

export function renderInventory(ctx) {
  const { state } = ctx;
  const editing = state.inventory.find((i) => i.id === editingId) || null;
  if (!editing) editingId = null;
  const total = formatYen(inventoryTotal(state.inventory));

  const name = field('品目名', h('input', { type: 'text', autocomplete: 'off', placeholder: '例：ピアス（完成品）', value: editing?.name ?? '' }));
  const qty = field('数量', h('input', { type: 'text', inputmode: 'decimal', placeholder: '10', value: editing?.quantity ?? '' }));
  const price = field('単価（円）', h('input', { type: 'text', inputmode: 'decimal', placeholder: '500', value: editing?.unitPrice ?? '' }));

  const onSubmit = (e) => {
    e.preventDefault();
    const n = name.input.value.trim();
    const q = checkPositive(qty.input.value, '数量');
    const p = checkPositive(price.input.value, '単価');
    name.setError(n ? '' : '品目名を入力してください');
    qty.setError(q.error);
    price.setError(p.error);
    if (!n || q.error || p.error) return;
    const data = { name: n, quantity: q.value, unitPrice: p.value };
    if (editing) Object.assign(editing, data);
    else state.inventory.push({ id: newId(), ...data });
    ctx.toast(editing ? '更新しました' : '追加しました');
    editingId = null;
    ctx.commit();
  };

  const form = h('form', { class: 'card form', onsubmit: onSubmit, novalidate: true },
    h('h2', { text: editing ? '品目を編集' : '品目を追加' }),
    name.el,
    h('div', { class: 'grid-2' }, qty.el, price.el),
    h('div', { class: 'form-actions' },
      editing && btn('キャンセル', () => { editingId = null; ctx.render(); }, 'btn btn-ghost'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, editing ? '更新する' : '追加する')));

  const items = state.inventory.map((item) =>
    h('li', { class: 'row' },
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title', text: item.name }),
        h('div', { class: 'row-sub', text: `${formatNum(item.quantity)} × ${formatYen(item.unitPrice)}` })),
      h('div', { class: 'row-amount', text: formatYen(inventoryAmount(item)) }),
      h('div', { class: 'row-actions' },
        btn('編集', () => { editingId = item.id; ctx.render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }),
        btn('削除', () => {
          if (!confirm(`「${item.name}」を削除しますか？`)) return;
          state.inventory = state.inventory.filter((i) => i.id !== item.id);
          ctx.toast('削除しました');
          ctx.commit();
        }, 'btn btn-ghost btn-sm danger'))));

  return h('div', { class: 'view' },
    h('section', { class: 'total-bar' },
      h('span', { text: '在庫金額 合計' }),
      h('strong', { 'data-testid': 'inventory-total', text: total })),
    form,
    h('section', { class: 'card' },
      h('h2', { text: `在庫一覧（${state.inventory.length}件）` }),
      items.length
        ? h('ul', { class: 'list' }, items)
        : emptyNote('品目がまだありません。上のフォームから追加してください。'),
      items.length > 0 && h('div', { class: 'list-total' }, h('span', { text: '合計' }), h('strong', { text: total }))));
}
