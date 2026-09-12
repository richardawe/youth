// ============================================================
// TRANSPORT
//
// A direct evolution of this repo's own data-store.js: same
// localStorage session id, same text/plain POST (which is what keeps
// Apps Script from needing to answer a CORS preflight), same poll
// loop. What's new is a room code, and a control record the projector
// publishes so phones only ever show the stage the leader has opened.
//
// If SCRIPT_URL isn't set — or the church wifi dies halfway through —
// everything falls back to OFFLINE MODE, which keeps state in
// localStorage. Offline still syncs across tabs on one machine (handy
// for rehearsing), but it cannot reach other phones. The leader's
// hand-tally is the answer there, and the leader view says so plainly.
// ============================================================

import { SCRIPT_URL, ROOM_CODE, POLL_INTERVAL_MS, isBackendConfigured } from './config.js';

const CONTROL_SESSION = '__control';
const CONTROL_KEY = 'control';

// ---------- room code ----------
function mintRoomCode() {
  // No vowels, no 0/O/1/I — these get read aloud across a noisy room.
  const chars = 'BCDFGHJKLMNPQRSTVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * The projector owns the room code. It's kept in sessionStorage so a
 * refresh mid-session doesn't strand every phone in the room on a dead
 * code — but a brand new tab gets a brand new room.
 */
export function getRoomCode({ create = false } = {}) {
  if (ROOM_CODE) return ROOM_CODE.toUpperCase();

  const fromUrl = new URLSearchParams(location.search).get('room');
  if (fromUrl) return fromUrl.toUpperCase();

  try {
    const saved = sessionStorage.getItem('two-walls-room');
    if (saved) return saved;
    if (create) {
      const fresh = mintRoomCode();
      sessionStorage.setItem('two-walls-room', fresh);
      return fresh;
    }
  } catch { /* private mode — fall through */ }

  return create ? mintRoomCode() : '';
}

// ---------- offline store ----------
const offlineKey = (room) => `two-walls-offline-${room}`;

function readOffline(room) {
  try { return JSON.parse(localStorage.getItem(offlineKey(room)) || '[]'); }
  catch { return []; }
}

function writeOffline(room, rows) {
  try { localStorage.setItem(offlineKey(room), JSON.stringify(rows)); }
  catch { /* out of quota or private mode; nothing we can do */ }
}

function upsertOffline(room, row) {
  const rows = readOffline(room);
  const i = rows.findIndex((r) => r.sessionId === row.sessionId && r.key === row.key);
  if (i > -1) rows[i] = row; else rows.push(row);
  writeOffline(room, rows);
}

// ---------- live state ----------
// Once a POST has failed we stop pretending we're online, so the leader's
// "offline" badge is telling the truth rather than flickering.
let degraded = false;
export const isOffline = () => !isBackendConfigured() || degraded;

async function post(body) {
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status}`);
  return res.json().catch(() => ({}));
}

/**
 * Write one answer. Upserts on (room, sessionId, key), so a student who
 * changes their mind replaces their answer instead of voting twice —
 * the same trick the AI-talk deck already relies on.
 */
export async function submit(room, identity, key, value) {
  const row = {
    roomCode: room,
    sessionId: identity.id,
    key,
    value,
    alias: identity.alias,
    color: identity.color,
    sigil: identity.sigil,
    ts: Date.now(),
  };

  upsertOffline(room, row);      // cache first so the UI can respond instantly
  if (isOffline()) return { synced: false };

  try {
    await post(row);
    return { synced: true };
  } catch (err) {
    console.warn('Falling back to offline mode:', err);
    degraded = true;
    return { synced: false };
  }
}

/** The projector publishes what stage the room is on. */
export async function publishControl(room, control) {
  return submit(
    room,
    { id: CONTROL_SESSION, alias: '', color: '', sigil: 'circle' },
    CONTROL_KEY,
    control,
  );
}

/** Pull the control record out of a batch of rows. */
export function readControl(rows) {
  const row = rows.find((r) => r.sessionId === CONTROL_SESSION && r.key === CONTROL_KEY);
  if (!row) return null;
  return typeof row.value === 'string' ? safeParse(row.value) : row.value;
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

/**
 * Poll for every row in this room. Returns an unsubscribe function.
 * Rows arrive as { sessionId, key, value, alias, color, sigil, ts }.
 */
export function subscribe(room, callback) {
  let stopped = false;
  let timer = null;

  async function tick() {
    if (stopped) return;

    if (isOffline()) {
      callback(readOffline(room), { offline: true });
    } else {
      try {
        const res = await fetch(`${SCRIPT_URL}?room=${encodeURIComponent(room)}`, { method: 'GET' });
        if (!res.ok) throw new Error(String(res.status));
        const rows = await res.json();
        callback(Array.isArray(rows) ? rows : [], { offline: false });
      } catch (err) {
        console.warn('Poll failed, switching to offline mode:', err);
        degraded = true;
        callback(readOffline(room), { offline: true });
      }
    }

    if (!stopped) timer = setTimeout(tick, POLL_INTERVAL_MS);
  }

  tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}

/** Wipe a room so the next group starts clean. */
export async function clearRoom(room) {
  writeOffline(room, []);
  if (isOffline()) return { synced: false };
  try {
    await post({ action: 'clearRoom', roomCode: room });
    return { synced: true };
  } catch (err) {
    console.warn('Could not clear the sheet:', err);
    return { synced: false };
  }
}

// ---------- shaping rows for the room map ----------

/** One entry per student per key, newest wins. */
export function byKey(rows, key) {
  const out = {};
  for (const r of rows) {
    if (r.key !== key || r.sessionId === CONTROL_SESSION) continue;
    const prev = out[r.sessionId];
    if (!prev || (r.ts || 0) >= (prev.ts || 0)) out[r.sessionId] = r;
  }
  return out;
}

/** { sessionId: cornerId } — what movement() in lesson.js expects. */
export function votesById(rows, key) {
  const picked = byKey(rows, key);
  const out = {};
  for (const [id, row] of Object.entries(picked)) out[id] = row.value;
  return out;
}

/** Counts per corner, in CORNERS order. */
export function countsFor(rows, key, corners) {
  const picked = byKey(rows, key);
  const counts = corners.map(() => 0);
  for (const row of Object.values(picked)) {
    const i = corners.findIndex((c) => c.id === row.value);
    if (i > -1) counts[i]++;
  }
  return counts;
}

/** Everyone who has joined, in join order, deduped by session. */
export function roster(rows) {
  const seen = new Map();
  for (const r of rows) {
    if (r.sessionId === CONTROL_SESSION || !r.alias) continue;
    if (!seen.has(r.sessionId)) {
      seen.set(r.sessionId, {
        id: r.sessionId, alias: r.alias, color: r.color, sigil: r.sigil, ts: r.ts || 0,
      });
    }
  }
  return [...seen.values()].sort((a, b) => a.ts - b.ts);
}
