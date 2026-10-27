// localStorage への保存・読み込み（例外は握りつぶして安全側に倒す）

export const STORAGE_KEY = 'tanaoroshi-app-v1';

const FIELDS = ['inventory', 'entries', 'materials', 'products'];

export function emptyState() {
  return { inventory: [], entries: [], materials: [], products: [] };
}

// 一意な ID を生成
export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createStore(storage = globalThis.localStorage) {
  return {
    // 未保存・JSON 破損・不正フィールドでも emptyState ベースで返す
    load() {
      const state = emptyState();
      let data = null;
      try {
        const raw = storage?.getItem(STORAGE_KEY);
        if (raw) data = JSON.parse(raw);
      } catch {
        data = null;
      }
      if (data && typeof data === 'object') {
        for (const key of FIELDS) {
          if (Array.isArray(data[key])) state[key] = data[key];
        }
      }
      return state;
    },
    // 成功したら true（プライベートモードや容量超過では false）
    save(state) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        storage.removeItem(STORAGE_KEY);
        return true;
      } catch {
        return false;
      }
    },
  };
}
