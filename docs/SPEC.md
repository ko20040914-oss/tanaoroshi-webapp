# モジュール仕様（API 契約）

ビルド不要の静的サイト。ES Modules（`"type": "module"`）。外部ライブラリ不使用。
コアモジュール（`js/core/*`）は DOM に依存しない純粋関数とし、Node（`node --test`）から直接 import できること。

## データモデル

```js
// 棚卸し品目
InventoryItem = { id: string, name: string, quantity: number, unitPrice: number }

// 売上・経費
Entry = {
  id: string,
  date: 'YYYY-MM-DD',
  description: string,
  amount: number,               // 正の数（円）
  type: 'sale' | 'expense',
  category: string | null,      // 経費のみ。null のときは description から自動判定
  categoryManual: boolean,      // true = 手動で上書きされたカテゴリ
}

// 材料マスタ
Material = { id: string, name: string, price: number, quantity: number, unit: string }
// 例: { name: '天然石ビーズ', price: 1500, quantity: 60, unit: '個' } → 1単位 25円

// 作品（原価計算）
Product = { id: string, name: string, components: [{ materialId: string, amount: number }] }

// アプリ全体の状態（localStorage に JSON で保存）
State = { inventory: InventoryItem[], entries: Entry[], materials: Material[], products: Product[] }
```

## js/core/calc.js

| export | 説明 |
| --- | --- |
| `EXPENSE_CATEGORIES` | `['材料費','送料','販売手数料・利用料','梱包資材','広告','その他']` |
| `CATEGORY_KEYWORDS` | `{ [category]: string[] }` 判定用キーワード（その他を除く） |
| `categorize(description)` | キーワードから経費カテゴリを返す。英字は大文字小文字無視。該当なしは `'その他'`。判定順: 販売手数料・利用料 → 送料 → 梱包資材 → 広告 → 材料費 |
| `effectiveCategory(entry)` | 経費なら `entry.category`（EXPENSE_CATEGORIES に含まれる場合）または `categorize(entry.description)`。売上は `null` |
| `roundMoney(n)` | 小数第2位で四捨五入（浮動小数誤差対策） |
| `inventoryAmount(item)` | `quantity × unitPrice`（roundMoney 済み） |
| `inventoryTotal(items)` | 在庫金額合計 |
| `ledgerTotals(entries)` | `{ sales, expenses, profit }` |
| `expensesByCategory(entries)` | 全カテゴリをキーに持つ `{ [category]: number }`（0 も含む） |
| `materialUnitCost(material)` | `price / quantity`（quantity ≤ 0 なら 0） |
| `productCostBreakdown(product, materials)` | `[{ materialId, name, unit, amount, unitCost, cost, missing }]`。材料が見つからなければ `missing: true, cost: 0` |
| `productCost(product, materials)` | 1点あたり原価（roundMoney 済み） |
| `buildSummary(state)` | `{ sales, expenses, profit, byCategory, inventoryTotal }` |
| `formatYen(n)` | `'1,272.5円'` 形式（ja-JP、小数は最大2桁） |

## js/core/csv.js

| export | 説明 |
| --- | --- |
| `CSV_HEADERS` | `['日付','内容','金額','区分','カテゴリ']` |
| `entriesToCsv(entries)` | ヘッダー付き CSV 文字列（改行 CRLF、BOM なし）。区分は `売上`/`経費`、カテゴリは経費のみ effectiveCategory、売上は空欄。`, " 改行` を含む値はダブルクォートで囲み `"` は `""` にエスケープ |
| `parseCsv(text)` | RFC 4180 準拠で `string[][]` を返す。先頭 BOM 除去、CRLF/LF 両対応、空行は無視 |
| `csvToEntries(text)` | `{ entries: Entry[], errors: [{ line, message }] }`。1行目はヘッダー（日本語ヘッダー、または `date,description,amount,type,category`）で列を名前で特定。区分は `売上/sale/income` → sale、`経費/expense` → expense。金額は `¥1,200` `1,200円` 等を許容し、正の数以外はエラー。日付は `YYYY/M/D` を `YYYY-MM-DD` に正規化、不正はエラー。カテゴリ列に有効なカテゴリがあれば `categoryManual: true`、無ければ `category: null, categoryManual: false`。id は新規採番。`line` は CSV の行番号（ヘッダー=1） |

## js/core/storage.js

| export | 説明 |
| --- | --- |
| `STORAGE_KEY` | `'tanaoroshi-app-v1'` |
| `emptyState()` | `{ inventory: [], entries: [], materials: [], products: [] }` |
| `newId()` | 一意な ID（`crypto.randomUUID` があれば使用、無ければ時刻＋乱数） |
| `createStore(storage = globalThis.localStorage)` | `{ load(), save(state), clear() }`。`load` は未保存・JSON 破損・配列でないフィールドがあっても emptyState をベースに安全に返す |

## js/core/sample.js

`SAMPLE_INVENTORY`, `SAMPLE_ENTRIES`, `SAMPLE_MATERIALS`, `SAMPLE_PRODUCTS`, `createSampleState()`（ディープコピーを返す）。

受け入れ条件（サンプルで必ず再現）:

- 棚卸し在庫金額合計 **11,500円**
  - ピアス（完成品） 10 × 500 / ブレスレット（完成品） 3 × 1,500 / 天然石ビーズ 100 × 20
- 売上合計 **4,800円**、経費合計 **2,330円**、利益 **2,470円**
  - 売上: ブレスレット販売（minne） 3,000 / ピアス販売（Creema） 1,800
  - 経費（すべて category: null の自動判定）:
    天然石ビーズ購入 1,200 → 材料費 / クリックポスト送料 185 → 送料 /
    minne販売手数料 480 → 販売手数料・利用料 / OPP袋（梱包用） 180 → 梱包資材 /
    Instagram広告 100 → 広告 / 文房具（ノート） 185 → その他
- 原価: ブレスレット 1点 **1,272.5円**、ピアス **510円**
  - 材料: 天然石ビーズ 1,500円/60個、淡水パール 1,100円/10粒、ゴムテグス 500円/1000cm、ピアス金具 800円/20ペア、チャーム 1,000円/4個
  - ブレスレット: ビーズ 20個 + チャーム 3個 + テグス 45cm = 500 + 750 + 22.5
  - ピアス: パール 2粒 + ピアス金具 1ペア + チャーム 1個 = 220 + 40 + 250
