// サンプルデータ（SPEC の受け入れ条件を再現する）

export const SAMPLE_INVENTORY = [
  { id: 'inv-1', name: 'ピアス（完成品）', quantity: 10, unitPrice: 500 },
  { id: 'inv-2', name: 'ブレスレット（完成品）', quantity: 3, unitPrice: 1500 },
  { id: 'inv-3', name: '天然石ビーズ', quantity: 100, unitPrice: 20 },
];

const sale = (id, date, description, amount) => ({ id, date, description, amount, type: 'sale', category: null, categoryManual: false });
const expense = (id, date, description, amount) => ({ id, date, description, amount, type: 'expense', category: null, categoryManual: false });

export const SAMPLE_ENTRIES = [
  sale('ent-1', '2026-11-05', 'ブレスレット販売（minne）', 3000),
  sale('ent-2', '2026-12-02', 'ピアス販売（Creema）', 1800),
  expense('ent-3', '2026-11-01', '天然石ビーズ購入', 1200),
  expense('ent-4', '2026-11-06', 'クリックポスト送料', 185),
  expense('ent-5', '2026-11-30', 'minne販売手数料', 480),
  expense('ent-6', '2026-12-01', 'OPP袋（梱包用）', 180),
  expense('ent-7', '2026-12-10', 'Instagram広告', 100),
  expense('ent-8', '2026-12-15', '文房具（ノート）', 185),
];

export const SAMPLE_MATERIALS = [
  { id: 'mat-beads', name: '天然石ビーズ', price: 1500, quantity: 60, unit: '個' },
  { id: 'mat-pearl', name: '淡水パール', price: 1100, quantity: 10, unit: '粒' },
  { id: 'mat-tegus', name: 'ゴムテグス', price: 500, quantity: 1000, unit: 'cm' },
  { id: 'mat-hook', name: 'ピアス金具', price: 800, quantity: 20, unit: 'ペア' },
  { id: 'mat-charm', name: 'チャーム', price: 1000, quantity: 4, unit: '個' },
];

export const SAMPLE_PRODUCTS = [
  {
    id: 'prod-bracelet',
    name: 'ブレスレット',
    components: [
      { materialId: 'mat-beads', amount: 20 },
      { materialId: 'mat-charm', amount: 3 },
      { materialId: 'mat-tegus', amount: 45 },
    ],
  },
  {
    id: 'prod-pierce',
    name: 'ピアス',
    components: [
      { materialId: 'mat-pearl', amount: 2 },
      { materialId: 'mat-hook', amount: 1 },
      { materialId: 'mat-charm', amount: 1 },
    ],
  },
];

// ディープコピーを返す（元データを汚さない）
export function createSampleState() {
  return JSON.parse(JSON.stringify({
    inventory: SAMPLE_INVENTORY,
    entries: SAMPLE_ENTRIES,
    materials: SAMPLE_MATERIALS,
    products: SAMPLE_PRODUCTS,
  }));
}
