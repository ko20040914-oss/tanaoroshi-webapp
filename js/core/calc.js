// 集計・原価計算などの純粋関数（DOM 非依存）

export const EXPENSE_CATEGORIES = ['材料費', '送料', '販売手数料・利用料', '梱包資材', '広告', 'その他'];

// 判定用キーワード（英字は小文字で保持し、大文字小文字を無視して照合）
export const CATEGORY_KEYWORDS = {
  '販売手数料・利用料': ['手数料', '利用料', '決済', '出店料', '月額', 'minne', 'creema', 'base', 'stores', 'メルカリ', 'pinkoi', 'paypal', 'stripe'],
  '送料': ['送料', '発送', '配送', '郵送', 'クリックポスト', 'ゆうパケット', 'ゆうパック', 'ネコポス', 'レターパック', '宅急便', '宅配', '切手', 'スマートレター'],
  '梱包資材': ['梱包', 'opp', '袋', '箱', '緩衝材', 'プチプチ', 'ラッピング', '包装', '封筒', 'テープ', 'リボン'],
  '広告': ['広告', '宣伝', 'instagram', 'インスタ', 'プロモーション', 'チラシ', '名刺', 'ショップカード'],
  '材料費': ['材料', 'ビーズ', 'パーツ', '金具', '生地', '布', '糸', 'レジン', 'チャーム', 'パール', '天然石', 'テグス', 'ワイヤー', 'チェーン', 'フェルト', '毛糸', '刺繍', 'ボタン', '皮革', 'レザー', '粘土', '樹脂'],
};

// 判定順（SPEC 準拠）
const MATCH_ORDER = ['販売手数料・利用料', '送料', '梱包資材', '広告', '材料費'];

// 内容からカテゴリを自動判定
export function categorize(description) {
  const text = String(description ?? '').toLowerCase();
  if (!text) return 'その他';
  for (const cat of MATCH_ORDER) {
    if (CATEGORY_KEYWORDS[cat].some((kw) => text.includes(kw.toLowerCase()))) return cat;
  }
  return 'その他';
}

// 実際に使うカテゴリ（売上は null）
export function effectiveCategory(entry) {
  if (!entry || entry.type !== 'expense') return null;
  return EXPENSE_CATEGORIES.includes(entry.category) ? entry.category : categorize(entry.description);
}

// 小数第2位で四捨五入
export function roundMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Math.sign(v) * Number.EPSILON) * 100) / 100;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function inventoryAmount(item) {
  return roundMoney(num(item?.quantity) * num(item?.unitPrice));
}

export function inventoryTotal(items = []) {
  return roundMoney(items.reduce((sum, it) => sum + inventoryAmount(it), 0));
}

export function ledgerTotals(entries = []) {
  let sales = 0;
  let expenses = 0;
  for (const e of entries) {
    if (e?.type === 'sale') sales += num(e.amount);
    else if (e?.type === 'expense') expenses += num(e.amount);
  }
  sales = roundMoney(sales);
  expenses = roundMoney(expenses);
  return { sales, expenses, profit: roundMoney(sales - expenses) };
}

// 全カテゴリを 0 で初期化してから加算
export function expensesByCategory(entries = []) {
  const result = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0]));
  for (const e of entries) {
    if (e?.type !== 'expense') continue;
    const cat = effectiveCategory(e);
    result[cat] = roundMoney(result[cat] + num(e.amount));
  }
  return result;
}

export function materialUnitCost(material) {
  const q = num(material?.quantity);
  return q > 0 ? num(material?.price) / q : 0;
}

// 作品の材料ごとの原価内訳
export function productCostBreakdown(product, materials = []) {
  return (product?.components ?? []).map((c) => {
    const m = materials.find((x) => x.id === c.materialId);
    const amount = num(c.amount);
    if (!m) {
      return { materialId: c.materialId, name: '', unit: '', amount, unitCost: 0, cost: 0, missing: true };
    }
    const unitCost = materialUnitCost(m);
    return { materialId: c.materialId, name: m.name, unit: m.unit, amount, unitCost, cost: roundMoney(unitCost * amount), missing: false };
  });
}

// 1点あたり原価
export function productCost(product, materials = []) {
  const total = productCostBreakdown(product, materials).reduce((s, r) => s + (r.missing ? 0 : r.unitCost * r.amount), 0);
  return roundMoney(total);
}

export function buildSummary(state) {
  const entries = state?.entries ?? [];
  return {
    ...ledgerTotals(entries),
    byCategory: expensesByCategory(entries),
    inventoryTotal: inventoryTotal(state?.inventory ?? []),
  };
}

const yenFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 });

// 例: 1272.5 → '1,272.5円'
export function formatYen(n) {
  return `${yenFormatter.format(num(n))}円`;
}
