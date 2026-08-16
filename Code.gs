/**
 * AI, Faith & the Future — survey backend.
 *
 * SETUP (see README.md for the full walkthrough):
 * 1. Create a Google Sheet.
 * 2. Extensions -> Apps Script, delete the placeholder code, paste this file in.
 * 3. Deploy -> New deployment -> type "Web app".
 *      Execute as: Me
 *      Who has access: Anyone
 * 4. Copy the resulting /exec URL into js/sheet-config.js as SCRIPT_URL.
 *
 * Data lives in a sheet tab called "responses" (created automatically on
 * first submission) with columns: sessionId | slideId | answers | ts
 * "answers" is stored as a JSON string and parsed back out on read.
 *
 * Each (sessionId, slideId) pair is a single row — resubmitting a survey
 * (e.g. someone changes their answer) overwrites that row instead of
 * creating a duplicate.
 */

const SHEET_NAME = 'responses';
const HEADERS = ['sessionId', 'slideId', 'answers', 'ts'];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function doGet(e) {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const [sessionId, slideId, answersJson, ts] = data[i];
    if (!sessionId) continue;
    let answers = {};
    try { answers = JSON.parse(answersJson); } catch (err) { /* leave empty */ }
    rows.push({ sessionId, slideId, answers, ts });
  }
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);

  if (payload && payload.action === 'clearSession') {
    const sheet = getSheet_();
    const lastRow = sheet.getLastRow();
    const clearedCount = Math.max(0, lastRow - 1);

    if (clearedCount > 0) {
      sheet.getRange(2, 1, clearedCount, HEADERS.length).clear();
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true, cleared: clearedCount }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();

  let rowIndex = -1; // 1-indexed sheet row, if an existing entry is found
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.sessionId && data[i][1] === payload.slideId) {
      rowIndex = i + 1;
      break;
    }
  }

  const rowValues = [
    payload.sessionId,
    payload.slideId,
    JSON.stringify(payload.answers || {}),
    payload.ts || Date.now()
  ];

  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
