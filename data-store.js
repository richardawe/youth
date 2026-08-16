import { SCRIPT_URL, POLL_INTERVAL_MS, isBackendConfigured } from './sheet-config.js';

const LOCAL_KEY = 'ai-talk-responses-v1';

function getSessionId() {
  let id = localStorage.getItem('ai-talk-session-id');
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    localStorage.setItem('ai-talk-session-id', id);
  }
  return id;
}

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); }
  catch { return {}; }
}
function writeLocal(all) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
}

/**
 * Save (or overwrite) this visitor's answers for a given survey slide.
 * answers: plain object of { questionId: value }
 */
export async function submitResponse(slideId, answers) {
  const sessionId = getSessionId();
  const record = { sessionId, slideId, answers, ts: Date.now() };

  // Always cache locally first so "you already answered" works instantly,
  // even if the network request is slow or fails.
  const all = readLocal();
  all[`${sessionId}_${slideId}`] = record;
  writeLocal(all);

  if (!isBackendConfigured()) {
    return { synced: false };
  }

  // text/plain avoids a CORS preflight, which Apps Script web apps
  // don't handle by default.
  await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(record)
  });
  return { synced: true };
}

/** Read this visitor's own previously-saved answers for a slide (for showing "you already answered"). */
export async function getMyResponse(slideId) {
  const sessionId = getSessionId();
  const all = readLocal();
  const rec = all[`${sessionId}_${slideId}`];
  return rec ? rec.answers : null;
}

export async function usingLiveSync() {
  return isBackendConfigured();
}

/**
 * Dashboard only: poll the sheet for all responses and call back
 * with a fresh array of {sessionId, slideId, answers, ts} every
 * POLL_INTERVAL_MS. Returns an unsubscribe function.
 */
export async function subscribeAllResponses(callback) {
  if (!isBackendConfigured()) {
    const all = readLocal();
    callback(Object.values(all));
    return () => {};
  }

  let stopped = false;
  async function poll() {
    if (stopped) return;
    try {
      const res = await fetch(SCRIPT_URL, { method: 'GET' });
      const rows = await res.json();
      callback(rows);
    } catch (err) {
      console.error('Poll failed', err);
    }
    if (!stopped) setTimeout(poll, POLL_INTERVAL_MS);
  }
  poll();
  return () => { stopped = true; };
}
