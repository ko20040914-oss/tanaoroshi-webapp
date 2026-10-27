import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CSV_HEADERS, entriesToCsv, parseCsv, csvToEntries } from '../js/core/csv.js';

const entry = (o) => ({
  id: o.id ?? 'id-' + Math.random(),
  date: '2026-03-01',
  description: '内容',
  amount: 100,
  type: 'expense',
  category: null,
  categoryManual: false,
  ...o,
});

const HEADER = '日付,内容,金額,区分,カテゴリ';

describe('entriesToCsv', () => {
  test('CSV_HEADERS は仕様どおり', () => {
    assert.deepEqual(CSV_HEADERS, ['日付', '内容', '金額', '区分', 'カテゴリ']);
  });

  test('1行目はヘッダー、BOM なし、改行は CRLF', () => {
    const csv = entriesToCsv([
      entry({ description: 'クリックポスト送料', amount: 185 }),
      entry({ description: 'ブレスレット販売', amount: 3000, type: 'sale' }),
    ]);
    assert.notEqual(csv.charCodeAt(0), 0xfeff);
    assert.equal(csv.split('\r\n')[0], HEADER);
    assert.ok(!/(^|[^\r])\n/.test(csv), 'CR を伴わない LF が無いこと');
    const lines = csv.split('\r\n').filter((l) => l !== '');
    assert.equal(lines.length, 3);
  });

  test('空配列でもヘッダーのみ出力', () => {
    const csv = entriesToCsv([]);
    assert.equal(csv.split('\r\n')[0], HEADER);
    assert.deepEqual(parseCsv(csv), [CSV_HEADERS]);
  });

  test('区分は 売上/経費、カテゴリは経費のみ（売上は空欄）', () => {
    const csv = entriesToCsv([
      entry({ description: 'クリックポスト送料', amount: 185 }),
      entry({ description: '文房具', amount: 50, category: '広告', categoryManual: true }),
      entry({ description: 'ピアス販売', amount: 1800, type: 'sale', date: '2026-04-02' }),
    ]);
    const rows = parseCsv(csv);
    assert.deepEqual(rows[1], ['2026-03-01', 'クリックポスト送料', '185', '経費', '送料']);
    assert.deepEqual(rows[2], ['2026-03-01', '文房具', '50', '経費', '広告']);
    assert.deepEqual(rows[3], ['2026-04-02', 'ピアス販売', '1800', '売上', '']);
  });

  test('カンマ・ダブルクォート・改行を含む値はクォートしてエスケープ', () => {
    const csv = entriesToCsv([
      entry({ description: 'ビーズ,パール' }),
      entry({ description: '"特価"ビーズ' }),
      entry({ description: '1行目\n2行目' }),
    ]);
    assert.ok(csv.includes('"ビーズ,パール"'));
    assert.ok(csv.includes('"""特価""ビーズ"'));
    assert.ok(csv.includes('"1行目'));
    const rows = parseCsv(csv);
    assert.equal(rows[1][1], 'ビーズ,パール');
    assert.equal(rows[2][1], '"特価"ビーズ');
    assert.match(rows[3][1], /^1行目\r?\n2行目$/);
  });

  test('特殊文字を含まない値はクォートしない', () => {
    const csv = entriesToCsv([entry({ description: 'シンプル' })]);
    assert.equal(csv.split('\r\n')[1], '2026-03-01,シンプル,100,経費,その他');
  });
});

describe('parseCsv', () => {
  test('LF 区切り', () => {
    assert.deepEqual(parseCsv('a,b,c\n1,2,3\n'), [['a', 'b', 'c'], ['1', '2', '3']]);
  });

  test('CRLF 区切り・末尾改行なし', () => {
    assert.deepEqual(parseCsv('a,b\r\n1,2'), [['a', 'b'], ['1', '2']]);
  });

  test('先頭 BOM を除去', () => {
    const rows = parseCsv('﻿日付,内容\r\n2026-01-01,x\r\n');
    assert.equal(rows[0][0], '日付');
    assert.deepEqual(rows, [['日付', '内容'], ['2026-01-01', 'x']]);
  });

  test('クォート内のカンマ・改行・エスケープされたクォート', () => {
    const text = 'a,b\r\n"x,y","say ""hi"""\r\n"line1\nline2",z\r\n';
    assert.deepEqual(parseCsv(text), [
      ['a', 'b'],
      ['x,y', 'say "hi"'],
      ['line1\nline2', 'z'],
    ]);
  });

  test('空フィールドを保持する', () => {
    assert.deepEqual(parseCsv('a,,c\n,,\n'), [['a', '', 'c'], ['', '', '']]);
  });

  test('空行は無視する', () => {
    assert.deepEqual(parseCsv('a,b\n\n1,2\r\n\r\n'), [['a', 'b'], ['1', '2']]);
  });
});

describe('csvToEntries', () => {
  test('日本語ヘッダーで読み込める', () => {
    const { entries, errors } = csvToEntries(
      '日付,内容,金額,区分,カテゴリ\r\n2026-01-05,クリックポスト送料,185,経費,\r\n2026-01-06,ピアス販売,1800,売上,\r\n');
    assert.deepEqual(errors, []);
    assert.equal(entries.length, 2);
    const [e, s] = entries;
    assert.equal(e.date, '2026-01-05');
    assert.equal(e.description, 'クリックポスト送料');
    assert.equal(e.amount, 185);
    assert.equal(e.type, 'expense');
    assert.equal(e.category, null);
    assert.equal(e.categoryManual, false);
    assert.equal(s.type, 'sale');
    assert.equal(s.amount, 1800);
  });

  test('英語ヘッダー（date,description,amount,type,category）で読み込める', () => {
    const { entries, errors } = csvToEntries(
      'date,description,amount,type,category\n2026-02-01,minne fee,480,expense,販売手数料・利用料\n2026-02-02,Sale,3000,sale,\n2026-02-03,Other income,500,income,\n');
    assert.deepEqual(errors, []);
    assert.equal(entries.length, 3);
    assert.equal(entries[0].type, 'expense');
    assert.equal(entries[0].category, '販売手数料・利用料');
    assert.equal(entries[0].categoryManual, true);
    assert.equal(entries[1].type, 'sale');
    assert.equal(entries[2].type, 'sale');
  });

  test('列順が入れ替わっていても列名で特定する', () => {
    const { entries, errors } = csvToEntries('区分,金額,カテゴリ,内容,日付\n経費,1200,材料費,ビーズ,2026-03-10\n');
    assert.deepEqual(errors, []);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].date, '2026-03-10');
    assert.equal(entries[0].description, 'ビーズ');
    assert.equal(entries[0].amount, 1200);
    assert.equal(entries[0].type, 'expense');
    assert.equal(entries[0].category, '材料費');
    assert.equal(entries[0].categoryManual, true);
  });

  test('金額 "¥1,200" "1,200円" を許容する', () => {
    const { entries, errors } = csvToEntries(
      `${HEADER}\n2026-01-01,a,"¥1,200",経費,\n2026-01-02,b,"1,200円",売上,\n2026-01-03,c,¥300,経費,\n`);
    assert.deepEqual(errors, []);
    assert.deepEqual(entries.map((e) => e.amount), [1200, 1200, 300]);
  });

  test('日付 YYYY/M/D を YYYY-MM-DD に正規化する', () => {
    const { entries, errors } = csvToEntries(`${HEADER}\n2026/1/5,a,100,経費,\n2026/12/31,b,100,経費,\n`);
    assert.deepEqual(errors, []);
    assert.equal(entries[0].date, '2026-01-05');
    assert.equal(entries[1].date, '2026-12-31');
  });

  test('有効でないカテゴリ・空カテゴリは null / categoryManual false', () => {
    const { entries, errors } = csvToEntries(`${HEADER}\n2026-01-01,a,100,経費,\n2026-01-02,b,100,経費,謎\n`);
    assert.deepEqual(errors, []);
    for (const e of entries) {
      assert.equal(e.category, null);
      assert.equal(e.categoryManual, false);
    }
  });

  test('不正な行はエラー（行番号付き）にしつつ正常な行は取り込む', () => {
    const text = [
      HEADER,                                 // 1
      '2026-01-01,正常1,100,経費,',            // 2
      '2026-01-02,負の金額,-100,経費,',        // 3
      '2026-01-03,数値でない,abc,経費,',       // 4
      '2026-13-45,不正な日付,100,経費,',       // 5
      '2026-01-05,不明な区分,100,寄付,',       // 6
      '2026-01-06,正常2,200,売上,',            // 7
      'あした,日付が文字,100,経費,',           // 8
      '2026-01-08,ゼロ円,0,経費,',             // 9
    ].join('\r\n') + '\r\n';
    const { entries, errors } = csvToEntries(text);
    assert.deepEqual(entries.map((e) => e.description), ['正常1', '正常2']);
    assert.deepEqual(errors.map((e) => e.line), [3, 4, 5, 6, 8, 9]);
    for (const err of errors) {
      assert.equal(typeof err.message, 'string');
      assert.ok(err.message.length > 0);
    }
  });

  test('id は新規採番され一意', () => {
    const rows = Array.from({ length: 50 }, (_, i) => `2026-01-01,item${i},${i + 1},経費,`);
    const { entries, errors } = csvToEntries([HEADER, ...rows].join('\n'));
    assert.deepEqual(errors, []);
    assert.equal(entries.length, 50);
    const ids = entries.map((e) => e.id);
    for (const id of ids) assert.equal(typeof id, 'string');
    assert.equal(new Set(ids).size, 50);
  });

  test('BOM 付きの CSV も読み込める', () => {
    const { entries, errors } = csvToEntries(`﻿${HEADER}\r\n2026-01-01,a,100,経費,\r\n`);
    assert.deepEqual(errors, []);
    assert.equal(entries.length, 1);
  });

  test('entriesToCsv → csvToEntries の往復で値が保たれる', () => {
    const src = [
      entry({ description: 'カンマ,入り', amount: 1272.5 }),
      entry({ description: '手動', amount: 50, category: '広告', categoryManual: true }),
      entry({ description: '"引用"', amount: 3000, type: 'sale', date: '2026-12-31' }),
    ];
    const { entries, errors } = csvToEntries(entriesToCsv(src));
    assert.deepEqual(errors, []);
    assert.equal(entries.length, 3);
    for (let i = 0; i < 3; i++) {
      assert.equal(entries[i].description, src[i].description);
      assert.equal(entries[i].amount, src[i].amount);
      assert.equal(entries[i].type, src[i].type);
      assert.equal(entries[i].date, src[i].date);
      assert.notEqual(entries[i].id, src[i].id);
    }
    assert.equal(entries[1].category, '広告');
    assert.equal(entries[1].categoryManual, true);
  });
});
