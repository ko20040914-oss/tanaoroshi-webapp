import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, emptyState, newId, createStore } from '../js/core/storage.js';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
}

const throwingStorage = {
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('quota'); },
  removeItem() { throw new Error('denied'); },
};

const sampleState = () => ({
  inventory: [{ id: 'i1', name: 'ピアス', quantity: 10, unitPrice: 500 }],
  entries: [{ id: 'e1', date: '2026-01-01', description: '送料', amount: 185, type: 'expense', category: null, categoryManual: false }],
  materials: [{ id: 'm1', name: 'ビーズ', price: 1500, quantity: 60, unit: '個' }],
  products: [{ id: 'p1', name: 'ブレスレット', components: [{ materialId: 'm1', amount: 20 }] }],
});

describe('storage', () => {
  test('STORAGE_KEY は tanaoroshi-app-v1', () => {
    assert.equal(STORAGE_KEY, 'tanaoroshi-app-v1');
  });

  test('emptyState は 4 つの空配列で毎回新しいオブジェクト', () => {
    assert.deepEqual(emptyState(), { inventory: [], entries: [], materials: [], products: [] });
    const a = emptyState();
    a.inventory.push(1);
    assert.deepEqual(emptyState().inventory, []);
  });

  test('未保存なら load は emptyState', () => {
    assert.deepEqual(createStore(fakeStorage()).load(), emptyState());
  });

  test('save → load で往復できる（STORAGE_KEY に JSON で保存）', () => {
    const storage = fakeStorage();
    const store = createStore(storage);
    store.save(sampleState());
    assert.ok(storage.data.has(STORAGE_KEY));
    assert.deepEqual(JSON.parse(storage.data.get(STORAGE_KEY)), sampleState());
    assert.deepEqual(store.load(), sampleState());
    assert.deepEqual(createStore(storage).load(), sampleState());
  });

  test('JSON が壊れていれば emptyState', () => {
    const store = createStore(fakeStorage({ [STORAGE_KEY]: '{not json' }));
    assert.deepEqual(store.load(), emptyState());
  });

  test('JSON がオブジェクトでなければ emptyState', () => {
    for (const raw of ['null', '42', '"str"', '[]']) {
      assert.deepEqual(createStore(fakeStorage({ [STORAGE_KEY]: raw })).load(), emptyState(), raw);
    }
  });

  test('欠けている・配列でないフィールドは空配列に補正、正しいフィールドは保持', () => {
    const s = sampleState();
    const raw = JSON.stringify({ inventory: 'oops', entries: s.entries, materials: { a: 1 } });
    const loaded = createStore(fakeStorage({ [STORAGE_KEY]: raw })).load();
    assert.deepEqual(loaded.inventory, []);
    assert.deepEqual(loaded.entries, s.entries);
    assert.deepEqual(loaded.materials, []);
    assert.deepEqual(loaded.products, []);
  });

  test('clear() で保存データが消える', () => {
    const storage = fakeStorage();
    const store = createStore(storage);
    store.save(sampleState());
    store.clear();
    assert.equal(storage.data.has(STORAGE_KEY), false);
    assert.deepEqual(store.load(), emptyState());
  });

  test('例外を投げる storage でも load/save/clear はクラッシュしない', () => {
    const store = createStore(throwingStorage);
    assert.deepEqual(store.load(), emptyState());
    assert.doesNotThrow(() => store.save(sampleState()));
    assert.doesNotThrow(() => store.clear());
  });

  test('newId は文字列で 1000 回呼んでも一意', () => {
    const ids = Array.from({ length: 1000 }, () => newId());
    for (const id of ids) {
      assert.equal(typeof id, 'string');
      assert.ok(id.length > 0);
    }
    assert.equal(new Set(ids).size, 1000);
  });
});
