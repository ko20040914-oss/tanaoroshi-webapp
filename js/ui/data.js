// データ：CSV 入出力・サンプル読み込み・全削除
import { entriesToCsv, csvToEntries } from '../core/csv.js';
import { createSampleState } from '../core/sample.js';
import { emptyState } from '../core/storage.js';
import { h, todayStr } from './dom.js';

let importMode = 'append';
let importResult = null; // { count, mode, errors, fileName }

export function renderData(ctx) {
  const { state } = ctx;

  // CSV 書き出し（Excel 用に UTF-8 BOM を付与）
  const exportCsv = () => {
    if (!state.entries.length) {
      ctx.toast('書き出す売上・経費がありません');
      return;
    }
    const blob = new Blob(['﻿', entriesToCsv(state.entries)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `uriage-keihi-${todayStr().replaceAll('-', '')}.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    ctx.toast(`${state.entries.length}件を書き出しました`);
  };

  // CSV 取り込み
  const fileInput = h('input', { type: 'file', accept: '.csv,text/csv', class: 'file-input', id: 'csv-file' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    let result;
    try {
      result = csvToEntries(await file.text());
    } catch {
      importResult = { count: 0, mode: importMode, errors: [{ line: '-', message: 'ファイルを読み込めませんでした' }], fileName: file.name };
      ctx.render();
      return;
    }
    const { entries, errors } = result;
    if (importMode === 'replace' && entries.length &&
        !confirm(`現在の売上・経費（${state.entries.length}件）を、取り込んだ${entries.length}件で置き換えます。よろしいですか？`)) {
      fileInput.value = '';
      return;
    }
    if (entries.length) {
      state.entries = importMode === 'replace' ? entries : [...state.entries, ...entries];
    }
    importResult = { count: entries.length, mode: importMode, errors, fileName: file.name };
    ctx.toast(`${entries.length}件取り込みました`);
    ctx.commit();
  });

  const modeRadio = (value, label) =>
    h('label', { class: 'radio' },
      h('input', { type: 'radio', name: 'import-mode', value, checked: importMode === value, onchange: () => { importMode = value; } }),
      h('span', { text: label }));

  const resultBox = importResult && h('div', { class: `import-result${importResult.errors.length ? ' has-errors' : ''}`, 'data-testid': 'import-result' },
    h('p', { text: `${importResult.fileName}：${importResult.count}件を${importResult.mode === 'replace' ? '置き換えで' : '追加で'}取り込みました` }),
    importResult.errors.length > 0 && h('div', {},
      h('p', { class: 'warn', text: `取り込めなかった行（${importResult.errors.length}件）` }),
      h('ul', { class: 'error-list' }, importResult.errors.map((e) => h('li', { text: `${e.line}行目：${e.message}` })))));

  const loadSample = () => {
    if (!confirm('現在のデータをすべてサンプルデータに置き換えます。よろしいですか？')) return;
    importResult = null;
    ctx.state = createSampleState();
    ctx.toast('サンプルデータを読み込みました');
    ctx.commit();
    ctx.go('dashboard');
  };

  const clearAll = () => {
    if (!confirm('すべてのデータ（棚卸し・売上・経費・材料・作品）を削除します。元に戻せません。よろしいですか？')) return;
    importResult = null;
    ctx.state = emptyState();
    ctx.toast('すべてのデータを削除しました');
    ctx.commit();
  };

  return h('div', { class: 'view' },
    h('section', { class: 'card' },
      h('h2', { text: 'CSV書き出し' }),
      h('p', { class: 'muted', text: '売上・経費を CSV で保存します。Excel や会計ソフトで開けます。' }),
      h('button', { type: 'button', class: 'btn btn-primary btn-block', onclick: exportCsv, 'data-testid': 'export-csv' }, `CSVを書き出す（${state.entries.length}件）`)),
    h('section', { class: 'card' },
      h('h2', { text: 'CSV取り込み' }),
      h('p', { class: 'muted', text: '列：日付, 内容, 金額, 区分（売上/経費）, カテゴリ（空欄なら自動判定）' }),
      h('fieldset', { class: 'radios' }, h('legend', { text: '取り込み方法' }),
        modeRadio('append', '今のデータに追加'), modeRadio('replace', '売上・経費を置き換え')),
      h('label', { for: 'csv-file', class: 'btn btn-secondary btn-block' }, 'CSVファイルを選ぶ'),
      fileInput,
      resultBox),
    h('section', { class: 'card' },
      h('h2', { text: 'サンプルデータ' }),
      h('p', { class: 'muted', text: '使い方を試すための例を読み込みます（今のデータは置き換えられます）。' }),
      h('button', { type: 'button', class: 'btn btn-secondary btn-block', 'data-testid': 'load-sample', onclick: loadSample }, 'サンプルデータを読み込む')),
    h('section', { class: 'card danger-zone' },
      h('h2', { text: '全データ削除' }),
      h('button', { type: 'button', class: 'btn btn-danger btn-block', 'data-testid': 'clear-all', onclick: clearAll }, 'すべてのデータを削除')),
    h('p', { class: 'note' },
      'データはこのブラウザ（この端末）の中だけに保存され、サーバーには送信されません。ブラウザのデータを消去すると消えてしまうため、売上・経費はときどき CSV で書き出しておくと安心です。'));
}
