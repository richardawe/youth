/**
 * TWO WALLS — LIVE : backend
 *
 * SETUP (full walkthrough in ../README.md):
 *   1. Create a Google Sheet.
 *   2. Extensions -> Apps Script. Delete the placeholder, paste this file in.
 *   3. Deploy -> New deployment -> type "Web app".
 *        Execute as:     Me
 *        Who has access: Anyone
 *   4. Copy the /exec URL into two-walls/js/config.js as SCRIPT_URL.
 *
 * Same shape as the AI-talk backend at the repo root — one flat tab,
 * upsert rather than append — with two additions this session needs:
 *
 *   - a roomCode column, so you can run the session twice in one morning
 *     (or two groups at once) without the counts bleeding together;
 *   - a reserved control row per room (sessionId "__control") holding the
 *     stage the projector is on, so phones only ever show what the leader
 *     has actually opened.
 *
 * Each (roomCode, sessionId, key) is a single row, so a student who
 * changes their answer overwrites their own row instead of voting twice.
 */

const SHEET_NAME = 'responses';
const HEADERS = ['roomCode', 'sessionId', 'key', 'value', 'alias', 'color', 'sigil', 'ts'];

const COL = {
  room: 0, session: 1, key: 2, value: 3, alias: 4, color: 5, sigil: 6, ts: 7,
};

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET /exec?room=ABCD  ->  every row for that room.
 * Omit room to get everything (useful when poking at it by hand).
 *
 * "value" is stored as a JSON string and parsed back out here, so a
 * corner id comes back as "c1" and the control record comes back as a
 * real object.
 */
function doGet(e) {
  const wanted = (e && e.parameter && e.parameter.room ? String(e.parameter.room) : '').toUpperCase();
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[COL.session]) continue;
    if (wanted && String(r[COL.room]).toUpperCase() !== wanted) continue;

    let value = r[COL.value];
    try { value = JSON.parse(value); } catch (err) { /* leave it as the raw string */ }

    rows.push({
      roomCode: r[COL.room],
      sessionId: r[COL.session],
      key: r[COL.key],
      value: value,
      alias: r[COL.alias],
      color: r[COL.color],
      sigil: r[COL.sigil],
      ts: Number(r[COL.ts]) || 0,
    });
  }

  return json_(rows);
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);

  if (payload && payload.action === 'clearRoom') {
    return json_(clearRoom_(payload.roomCode));
  }

  // A lock keeps two phones submitting in the same instant from both
  // deciding they need to append, which would leave a duplicate row.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const data = sheet.getDataRange().getValues();
    const room = String(payload.roomCode || '').toUpperCase();

    const rowValues = [
      room,
      payload.sessionId,
      payload.key,
      JSON.stringify(payload.value === undefined ? null : payload.value),
      payload.alias || '',
      payload.color || '',
      payload.sigil || '',
      payload.ts || Date.now(),
    ];

    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][COL.room]).toUpperCase() === room &&
          data[i][COL.session] === payload.sessionId &&
          data[i][COL.key] === payload.key) {
        rowIndex = i + 1;   // sheet rows are 1-indexed
        break;
      }
    }

    if (rowIndex > -1) {
      sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delete every row for one room. Walks backwards so deleting a row
 * doesn't shift the rows we haven't looked at yet.
 */
function clearRoom_(roomCode) {
  const room = String(roomCode || '').toUpperCase();
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  let cleared = 0;

  for (let i = data.length - 1; i >= 1; i--) {
    if (!room || String(data[i][COL.room]).toUpperCase() === room) {
      sheet.deleteRow(i + 1);
      cleared++;
    }
  }

  return { ok: true, cleared: cleared };
}
