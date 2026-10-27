// DOM 生成と入力チェックの共通ヘルパー
// 文字列は必ず textContent / setAttribute 経由で入れる（innerHTML は使わない）

/**
 * 要素を生成する。props: class, dataset, on<event>, text, value, その他は属性。
 * children: 文字列・数値・Node・配列（null/false は無視）
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'value') value = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  // select は option 追加後でないと value が反映されないため最後に設定
  if (value !== undefined) el.value = String(value);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

/** 全角数字・カンマ・円記号を許容して数値化（不正なら NaN） */
export function parseNumber(raw) {
  const s = String(raw ?? '')
    .trim()
    .replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，円¥￥\s]/g, '');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

/** 正の数チェック。{ value } か { error } を返す */
export function checkPositive(raw, label) {
  if (String(raw ?? '').trim() === '') return { error: `${label}を入力してください` };
  const n = parseNumber(raw);
  if (!Number.isFinite(n)) return { error: `${label}は数値で入力してください` };
  if (n <= 0) return { error: `${label}は0より大きい数値で入力してください` };
  return { value: n };
}

/** ローカル日付の YYYY-MM-DD */
export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 数量の表示（小数は最大2桁） */
export function formatNum(n) {
  return Number(n).toLocaleString('ja-JP', { maximumFractionDigits: 2 });
}

/**
 * ラベル付き入力欄。{ el, input, setError } を返す
 */
export function field(label, input, { hint } = {}) {
  const id = input.id || `f-${Math.random().toString(36).slice(2, 9)}`;
  input.id = id;
  const err = h('p', { class: 'field-error', role: 'alert', hidden: true });
  const el = h('div', { class: 'field' }, h('label', { for: id, text: label }), input, hint, err);
  return {
    el,
    input,
    setError(msg) {
      err.textContent = msg || '';
      err.hidden = !msg;
      input.toggleAttribute('aria-invalid', !!msg);
    },
  };
}

/** 空状態の表示 */
export function emptyNote(text, ...extra) {
  return h('div', { class: 'empty' }, h('p', { text }), ...extra);
}

/** 小さなボタン */
export function btn(text, onclick, cls = 'btn btn-ghost btn-sm', props = {}) {
  return h('button', { type: 'button', class: cls, onclick, ...props }, text);
}
