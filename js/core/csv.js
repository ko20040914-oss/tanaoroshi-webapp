// CSV 入出力（RFC 4180）

import { EXPENSE_CATEGORIES, effectiveCategory } from './calc.js';
import { newId } from './storage.js';

export const CSV_HEADERS = ['日付', '内容', '金額', '区分', 'カテゴリ'];

// 必要ならダブルクォートで囲む
function escapeCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function entriesToCsv(entries = []) {
  const rows = [CSV_HEADERS];
  for (const e of entries) {
    const isExpense = e.type === 'expense';
    rows.push([e.date, e.description, e.amount, isExpense ? '経費' : '売上', isExpense ? effectiveCategory(e) : '']);
  }
  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');
}

// 行番号付きでパース（内部用）。空行は除外
function parseRecords(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const records = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let startLine = 1;
  const endRow = () => {
    row.push(cell);
    if (!(row.length === 1 && row[0] === '')) records.push({ line: startLine, cells: row });
    row = [];
    cell = '';
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
      line++;
      startLine = line;
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) endRow();
  return records;
}

export function parseCsv(text) {
  return parseRecords(text).map((r) => r.cells);
}

// ヘッダー名 → フィールド名
const HEADER_MAP = {
  '日付': 'date', 'date': 'date',
  '内容': 'description', 'description': 'description',
  '金額': 'amount', 'amount': 'amount',
  '区分': 'type', 'type': 'type',
  'カテゴリ': 'category', 'category': 'category',
};

const TYPE_MAP = { '売上': 'sale', 'sale': 'sale', 'income': 'sale', '経費': 'expense', 'expense': 'expense' };

// 全角数字・記号を半角へ
const toHalfWidth = (s) => s.replace(/[０-９．，－／]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

function parseAmount(raw) {
  const s = toHalfWidth(raw).replace(/[¥￥円,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

function parseDate(raw) {
  const m = toHalfWidth(raw).match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function csvToEntries(text) {
  const entries = [];
  const errors = [];
  const records = parseRecords(text).filter((r) => r.cells.some((c) => c.trim() !== ''));
  if (records.length === 0) {
    errors.push({ line: 1, message: 'CSV が空です' });
    return { entries, errors };
  }

  // ヘッダーから列位置を特定
  const [header, ...rows] = records;
  const col = {};
  header.cells.forEach((name, i) => {
    const key = HEADER_MAP[name.trim().toLowerCase()] ?? HEADER_MAP[name.trim()];
    if (key && !(key in col)) col[key] = i;
  });
  const missing = ['date', 'description', 'amount', 'type'].filter((k) => !(k in col));
  if (missing.length) {
    errors.push({ line: header.line, message: `ヘッダーに必要な列がありません（${CSV_HEADERS.slice(0, 4).join(',')} が必要です）` });
    return { entries, errors };
  }

  for (const { line, cells } of rows) {
    const get = (k) => (k in col ? (cells[col[k]] ?? '').trim() : '');
    const date = parseDate(get('date'));
    if (!date) { errors.push({ line, message: `日付が不正です: 「${get('date')}」` }); continue; }
    const amount = parseAmount(get('amount'));
    if (amount === null) { errors.push({ line, message: `金額は正の数で入力してください: 「${get('amount')}」` }); continue; }
    const type = TYPE_MAP[get('type').toLowerCase()];
    if (!type) { errors.push({ line, message: `区分は「売上」または「経費」で入力してください: 「${get('type')}」` }); continue; }
    const cat = get('category');
    const manual = type === 'expense' && EXPENSE_CATEGORIES.includes(cat);
    entries.push({
      id: newId(),
      date,
      description: get('description'),
      amount,
      type,
      category: manual ? cat : null,
      categoryManual: manual,
    });
  }
  return { entries, errors };
}
