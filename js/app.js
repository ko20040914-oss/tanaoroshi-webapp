// アプリ本体：状態管理・タブ切り替え・描画
import { createStore } from './core/storage.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderInventory } from './ui/inventory.js';
import { renderLedger } from './ui/ledger.js';
import { renderCost } from './ui/cost.js';
import { renderData } from './ui/data.js';

const VIEWS = {
  dashboard: { title: 'ダッシュボード', render: renderDashboard },
  inventory: { title: '棚卸し', render: renderInventory },
  ledger: { title: '売上・経費', render: renderLedger },
  cost: { title: '原価計算', render: renderCost },
  data: { title: 'データ', render: renderData },
};

const store = createStore();
const main = document.getElementById('main');
const titleEl = document.getElementById('view-title');
const toastEl = document.getElementById('toast');
let current = 'dashboard';
let toastTimer = 0;

// 各画面に渡すコンテキスト
const ctx = {
  state: store.load(),
  /** 状態を保存して再描画（変更のたびに呼ぶ） */
  commit() {
    try {
      store.save(ctx.state);
    } catch {
      ctx.toast('保存に失敗しました（ブラウザの空き容量を確認してください）');
    }
    render();
  },
  /** 状態を丸ごと差し替える */
  replace(next) {
    ctx.state = next;
    ctx.commit();
  },
  render,
  go(tab) {
    if (!VIEWS[tab]) tab = 'dashboard';
    if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
    current = tab;
    render();
    window.scrollTo(0, 0);
  },
  toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  },
};

function render() {
  const view = VIEWS[current];
  titleEl.textContent = view.title;
  document.title = `${view.title}｜ハンドメイド棚卸し帳`;
  main.replaceChildren(view.render(ctx));
  for (const b of document.querySelectorAll('.tab')) {
    const active = b.dataset.tab === current;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
}

for (const b of document.querySelectorAll('.tab')) {
  b.addEventListener('click', () => ctx.go(b.dataset.tab));
}
window.addEventListener('hashchange', () => ctx.go(location.hash.slice(1)));

ctx.go(location.hash.slice(1) || 'dashboard');
