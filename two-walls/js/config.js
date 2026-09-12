// ============================================================
// TWO WALLS — LIVE : CONFIG
//
// This is the only file you need to edit. See README.md for the
// five-minute Google Sheet setup that turns on live sync.
//
// Until you paste a SCRIPT_URL below, everything still runs —
// the session falls back to OFFLINE MODE, where the leader taps
// the counters by hand exactly like the original paper version.
// ============================================================

// Paste your Apps Script web app /exec URL between the quotes.
export const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyBJn_dT9FXIW2L4QNZJ0oDCIZzMV5UEnF_JGywZrq24jrEG2X9pOGwyR-AU8AKU21pVQ/exec";

// Every session runs under a short room code. Students type it (or
// scan the QR, which fills it in for them). Leave this blank to get
// a fresh random code each time you open the projector view — or set
// a fixed one like "YOUTH" if you'd rather it never change.
export const ROOM_CODE = "";

// How often the projector and phones check for new answers (ms).
// 1800 keeps the room map feeling alive. Don't go below ~1200 or
// you'll burn through Apps Script quota for no visible gain.
export const POLL_INTERVAL_MS = 1800;

// Keeps casual visitors off the leader remote. A convenience lock,
// not real security — anyone who reads this file can see it.
export const LEADER_PASSCODE = "twowalls";

// The World English Bible (public domain) renders the divine name as
// "Yahweh", which reads oddly to most youth groups. Set this to
// "Yahweh" if you'd rather keep WEB's own wording.
export const DIVINE_NAME = "The LORD";

// Set true to let the projector spawn ~20 synthetic students so you
// can rehearse the whole session alone. Also togglable at runtime by
// pressing R on the projector view. Never leave this on for a real
// session — it will pollute your counts.
export const REHEARSAL_MODE = false;

// The one-word "why" after round one is the only place students can
// type free text that the room sees. With a small group it stops being
// anonymous, so set this false for groups under about eight.
export const ENABLE_WHY = true;

export function isBackendConfigured() {
  return Boolean(SCRIPT_URL && SCRIPT_URL.startsWith("https://"));
}
