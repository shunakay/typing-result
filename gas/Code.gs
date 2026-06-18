/**
 * Google Apps Script – タイピング成績管理 Web API
 *
 * デプロイ設定:
 *   実行ユーザー : 自分
 *   アクセス権   : 全員（誰でもアクセス可）
 *
 * スプレッドシートのシート名: typing_records
 * ヘッダー行（1行目）:
 *   A:日付 B:入力方式 C:制限時間(分) D:得点 E:入力文字数
 *   F:正タイプ数 G:誤タイプ数 H:正タイプ率(%) I:誤タイプ率(%) J:メモ
 */

const SHEET_NAME = 'typing_records';

/* =====================================================
   ヘルパー
   ===================================================== */

/** CORS ヘッダー付きの JSON レスポンスを返す */
function jsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/** アクティブなスプレッドシートのシートを取得 */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('シート "' + SHEET_NAME + '" が見つかりません');
  return sheet;
}

/** 行データ（配列）をレコードオブジェクトに変換 */
function rowToRecord(row, rowIndex) {
  return {
    rowIndex:     rowIndex,
    date:         row[0] ? Utilities.formatDate(new Date(row[0]), 'Asia/Tokyo', 'yyyy-MM-dd') : '',
    inputType:    row[1] || '',
    timeMinutes:  Number(row[2]) || null,
    score:        Number(row[3]) || null,
    charCount:    Number(row[4]) || null,
    correctCount: Number(row[5]) || null,
    missCount:    Number(row[6]) || null,
    correctRate:  Number(row[7]) || null,
    missRate:     Number(row[8]) || null,
    memo:         row[9] || '',
  };
}

/** レコードオブジェクトを行配列に変換 */
function recordToRow(record) {
  return [
    record.date         || '',
    record.inputType    || '',
    record.timeMinutes  !== null && record.timeMinutes  !== undefined ? Number(record.timeMinutes)  : '',
    record.score        !== null && record.score        !== undefined ? Number(record.score)        : '',
    record.charCount    !== null && record.charCount    !== undefined ? Number(record.charCount)    : '',
    record.correctCount !== null && record.correctCount !== undefined ? Number(record.correctCount) : '',
    record.missCount    !== null && record.missCount    !== undefined ? Number(record.missCount)    : '',
    record.correctRate  !== null && record.correctRate  !== undefined ? Number(record.correctRate)  : '',
    record.missRate     !== null && record.missRate     !== undefined ? Number(record.missRate)     : '',
    record.memo         || '',
  ];
}

/* =====================================================
   doGet – 全レコード取得（認証不要）
   ===================================================== */

/**
 * GET ?action=list
 * レスポンス: { ok: true, data: [ { rowIndex, date, score, ... }, ... ] }
 */
function doGet(e) {
  try {
    const action = e.parameter.action || 'list';

    if (action !== 'list') {
      return jsonResponse({ ok: false, error: '不明な action: ' + action });
    }

    const sheet = getSheet();
    const lastRow = sheet.getLastRow();

    // データが1行目（ヘッダー）しかない場合は空配列を返す
    if (lastRow < 2) {
      return jsonResponse({ ok: true, data: [] });
    }

    const range  = sheet.getRange(2, 1, lastRow - 1, 10);
    const values = range.getValues();

    const data = values
      .map((row, i) => rowToRecord(row, i + 2))
      .filter(r => r.date); // 日付が空の行は除外

    return jsonResponse({ ok: true, data: data });

  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

/* =====================================================
   doPost – 書き込み操作（URL を知っている人のみ実行可）
   =====================================================
   リクエストボディ（JSON）:
     create: { "action": "create", "record": { date, score, ... } }
     update: { "action": "update", "rowIndex": 5, "record": { ... } }
     delete: { "action": "delete", "rowIndex": 5 }
   =================================================== */

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'create') {
      return _create(body.record);
    } else if (action === 'update') {
      return _update(Number(body.rowIndex), body.record);
    } else if (action === 'delete') {
      return _delete(Number(body.rowIndex));
    } else {
      return jsonResponse({ ok: false, error: '不明な action: ' + action });
    }

  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

/** レコードを末尾に追加 */
function _create(record) {
  const sheet = getSheet();
  const row   = recordToRow(record);
  sheet.appendRow(row);
  const newRowIndex = sheet.getLastRow();
  return jsonResponse({ ok: true, rowIndex: newRowIndex });
}

/** 指定行のレコードを更新 */
function _update(rowIndex, record) {
  if (!rowIndex || rowIndex < 2) {
    return jsonResponse({ ok: false, error: '無効な rowIndex: ' + rowIndex });
  }
  const sheet = getSheet();
  const row   = recordToRow(record);
  sheet.getRange(rowIndex, 1, 1, 10).setValues([row]);
  return jsonResponse({ ok: true, rowIndex: rowIndex });
}

/** 指定行のレコードを削除 */
function _delete(rowIndex) {
  if (!rowIndex || rowIndex < 2) {
    return jsonResponse({ ok: false, error: '無効な rowIndex: ' + rowIndex });
  }
  const sheet = getSheet();
  sheet.deleteRow(rowIndex);
  return jsonResponse({ ok: true });
}
