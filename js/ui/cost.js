// 原価計算：材料マスタと作品ごとの 1点あたり原価
import { formatYen, materialUnitCost, productCost, productCostBreakdown } from '../core/calc.js';
import { newId } from '../core/storage.js';
import { h, field, checkPositive, formatNum, emptyNote, btn } from './dom.js';

let editingMaterialId = null;
const UNITS = ['個', '粒', 'ペア', 'cm', 'm', 'g', '枚', '本', 'セット'];

export function renderCost(ctx) {
  return h('div', { class: 'view' }, materialSection(ctx), productSection(ctx));
}

// ---------- 材料マスタ ----------
function materialSection(ctx) {
  const { state } = ctx;
  const editing = state.materials.find((m) => m.id === editingMaterialId) || null;
  if (!editing) editingMaterialId = null;

  const name = field('材料名', h('input', { type: 'text', autocomplete: 'off', placeholder: '例：天然石ビーズ', value: editing?.name ?? '' }));
  const price = field('購入価格（円）', h('input', { type: 'text', inputmode: 'decimal', placeholder: '1500', value: editing?.price ?? '' }));
  const qty = field('購入数量', h('input', { type: 'text', inputmode: 'decimal', placeholder: '60', value: editing?.quantity ?? '' }));
  const unit = field('単位', h('input', { type: 'text', list: 'unit-list', autocomplete: 'off', placeholder: '個', value: editing?.unit ?? '' }));

  const onSubmit = (e) => {
    e.preventDefault();
    const n = name.input.value.trim();
    const p = checkPositive(price.input.value, '購入価格');
    const q = checkPositive(qty.input.value, '購入数量');
    const u = unit.input.value.trim();
    name.setError(n ? '' : '材料名を入力してください');
    price.setError(p.error);
    qty.setError(q.error);
    unit.setError(u ? '' : '単位を入力してください（例：個、cm）');
    if (!n || p.error || q.error || !u) return;
    const data = { name: n, price: p.value, quantity: q.value, unit: u };
    if (editing) Object.assign(editing, data);
    else state.materials.push({ id: newId(), ...data });
    ctx.toast(editing ? '材料を更新しました' : '材料を追加しました');
    editingMaterialId = null;
    ctx.commit();
  };

  const form = h('form', { class: 'form sub-form', onsubmit: onSubmit, novalidate: true },
    h('h3', { text: editing ? '材料を編集' : '材料を追加' }),
    name.el,
    h('div', { class: 'grid-3' }, price.el, qty.el, unit.el),
    h('datalist', { id: 'unit-list' }, UNITS.map((u) => h('option', { value: u }))),
    h('div', { class: 'form-actions' },
      editing && btn('キャンセル', () => { editingMaterialId = null; ctx.render(); }, 'btn btn-ghost'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, editing ? '更新する' : '材料を追加')));

  const rows = state.materials.map((m) =>
    h('li', { class: 'row' },
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title', text: m.name }),
        h('div', { class: 'row-sub', text: `${formatYen(m.price)} ／ ${formatNum(m.quantity)}${m.unit}` })),
      h('div', { class: 'row-amount' },
        h('small', { text: `1${m.unit}あたり` }),
        h('span', { text: formatYen(materialUnitCost(m)) })),
      h('div', { class: 'row-actions' },
        btn('編集', () => { editingMaterialId = m.id; ctx.render(); }),
        btn('削除', () => deleteMaterial(ctx, m), 'btn btn-ghost btn-sm danger'))));

  return h('section', { class: 'card' },
    h('h2', { text: '材料マスタ' }),
    rows.length ? h('ul', { class: 'list' }, rows) : emptyNote('材料がまだありません。購入した材料を登録すると 1単位あたりの単価を計算します。'),
    form);
}

function deleteMaterial(ctx, m) {
  const users = ctx.state.products.filter((p) => p.components.some((c) => c.materialId === m.id));
  const msg = users.length
    ? `「${m.name}」は次の作品で使われています：\n${users.map((p) => `・${p.name}`).join('\n')}\n\n削除すると、これらの作品では「材料が見つかりません」と表示されます。削除しますか？`
    : `材料「${m.name}」を削除しますか？`;
  if (!confirm(msg)) return;
  ctx.state.materials = ctx.state.materials.filter((x) => x.id !== m.id);
  if (editingMaterialId === m.id) editingMaterialId = null;
  ctx.toast('材料を削除しました');
  ctx.commit();
}

// ---------- 作品 ----------
function productSection(ctx) {
  const { state } = ctx;
  const name = field('作品名', h('input', { type: 'text', autocomplete: 'off', placeholder: '例：天然石ブレスレット' }));
  const onSubmit = (e) => {
    e.preventDefault();
    const n = name.input.value.trim();
    name.setError(n ? '' : '作品名を入力してください');
    if (!n) return;
    state.products.push({ id: newId(), name: n, components: [] });
    ctx.toast('作品を追加しました。材料を追加してください');
    ctx.commit();
  };

  return h('section', { class: 'products' },
    h('h2', { class: 'section-title', text: '作品の原価' }),
    state.products.map((p) => productCard(ctx, p)),
    h('form', { class: 'card form', onsubmit: onSubmit, novalidate: true },
      h('h3', { text: '作品を追加' }),
      h('div', { class: 'inline-form' }, name.el,
        h('button', { type: 'submit', class: 'btn btn-primary' }, '追加'))));
}

function productCard(ctx, p) {
  const { state } = ctx;
  const breakdown = productCostBreakdown(p, state.materials);

  const lines = breakdown.map((b, idx) =>
    h('li', { class: `comp${b.missing ? ' missing' : ''}` },
      h('div', { class: 'comp-main' },
        b.missing
          ? h('span', { class: 'warn', text: '⚠ 材料が見つかりません（削除された可能性があります）' })
          : h('span', { class: 'comp-name', text: b.name }),
        !b.missing && h('span', { class: 'comp-sub', text: `${formatNum(b.amount)}${b.unit} × ${formatYen(b.unitCost)}` })),
      h('span', { class: 'comp-cost num', text: formatYen(b.cost) }),
      btn('×', () => {
        p.components.splice(idx, 1);
        ctx.commit();
      }, 'btn btn-ghost btn-icon', { 'aria-label': 'この材料を外す' })));

  // 材料の追加行
  const hasMaterials = state.materials.length > 0;
  const unitLabel = h('span', { class: 'unit-label' });
  const sel = h('select', { 'aria-label': '材料', disabled: !hasMaterials },
    hasMaterials
      ? state.materials.map((m) => h('option', { value: m.id, text: `${m.name}（${formatYen(materialUnitCost(m))}/${m.unit}）` }))
      : h('option', { value: '', text: '先に材料マスタを登録してください' }));
  const amountInput = h('input', { type: 'text', inputmode: 'decimal', placeholder: '使用量', 'aria-label': '使用量', disabled: !hasMaterials });
  const err = h('p', { class: 'field-error', role: 'alert', hidden: true });
  const syncUnit = () => {
    const m = state.materials.find((x) => x.id === sel.value);
    unitLabel.textContent = m ? m.unit : '';
  };
  sel.addEventListener('change', syncUnit);
  syncUnit();

  const addComp = (e) => {
    e.preventDefault();
    if (!hasMaterials) return;
    const a = checkPositive(amountInput.value, '使用量');
    err.textContent = a.error || '';
    err.hidden = !a.error;
    if (a.error) return;
    p.components.push({ materialId: sel.value, amount: a.value });
    ctx.commit();
  };

  const rename = () => {
    const n = prompt('新しい作品名', p.name);
    if (n == null || !n.trim()) return;
    p.name = n.trim();
    ctx.commit();
  };
  const remove = () => {
    if (!confirm(`作品「${p.name}」を削除しますか？`)) return;
    state.products = state.products.filter((x) => x.id !== p.id);
    ctx.toast('作品を削除しました');
    ctx.commit();
  };

  return h('article', { class: 'card product' },
    h('header', { class: 'product-head' },
      h('h3', { text: p.name }),
      h('div', { class: 'row-actions' }, btn('名前変更', rename), btn('削除', remove, 'btn btn-ghost btn-sm danger'))),
    lines.length ? h('ul', { class: 'comps' }, lines) : emptyNote('使う材料と使用量を追加してください。'),
    h('form', { class: 'comp-add', onsubmit: addComp, novalidate: true },
      sel,
      h('div', { class: 'comp-add-row' },
        h('div', { class: 'amount-wrap' }, amountInput, unitLabel),
        h('button', { type: 'submit', class: 'btn btn-secondary', disabled: !hasMaterials }, '材料を追加')),
      err),
    h('div', { class: 'product-cost' },
      h('span', { text: '1点あたり原価' }),
      h('strong', { 'data-testid': 'product-cost', 'data-product-name': p.name, text: formatYen(productCost(p, state.materials)) })));
}
