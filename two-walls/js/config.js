// ============================================================
// TWO WALLS — LIVE : CONFIG
//
// There is nothing you have to edit here to run the session.
//
// The backend is chosen from WHERE THE PAGE WAS OPENED, so the same
// files work both ways with no config switching:
//
//   Opened from the laptop server  ->  that laptop, over the room's
//   (server/serve.mjs or .py)          own wifi. No internet at all,
//                                      answers in ~1ms. THIS IS THE
//                                      RECOMMENDED WAY TO RUN IT.
//
//   Opened from GitHub Pages       ->  the Google Sheet below, for
//                                      when people are not in one room.
//
// If neither is reachable the session still runs: it falls back to
// OFFLINE MODE and the leader taps the counters by hand, exactly like
// the original paper version.
// ============================================================

// Your Apps Script /exec URL — only used when the page is served from
// the internet rather than from the laptop.
export const CLOUD_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyBJn_dT9FXIW2L4QNZJ0oDCIZzMV5UEnF_JGywZrq24jrEG2X9pOGwyR-AU8AKU21pVQ/exec";

/**
 * True when this page came from the local session server rather than from
 * the internet. Anything that isn't a public web host is treated as local,
 * which covers localhost, a LAN address, and a phone opening the laptop's
 * address over wifi.
 */
export const IS_LOCAL = (() => {
  const h = location.hostname;
  if (!h) return false;                            // opened as a file://
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  return /^192\.168\./.test(h)
    || /^10\./.test(h)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    || /\.local$/.test(h);
})();

// The local server answers on /api at the same origin the page came from,
// so phones need no configuration whatsoever — they just load the page.
export const SCRIPT_URL = IS_LOCAL ? `${location.origin}/api` : CLOUD_SCRIPT_URL;

// Every session runs under a short room code. Students type it (or
// scan the QR, which fills it in for them). Leave this blank to get
// a fresh random code each time you open the projector view — or set
// a fixed one like "YOUTH" if you'd rather it never change.
export const ROOM_CODE = "";

// How often the projector and phones check for new answers (ms).
//
// On the laptop server a request costs about a millisecond, so we can poll
// fast and the room map moves as people tap. Against Apps Script every
// request costs roughly two seconds no matter what — its own overhead plus
// a mandatory redirect — so polling faster there buys nothing and only
// burns quota.
export const POLL_INTERVAL_MS = IS_LOCAL ? 400 : 1800;

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
  // The local server is plain http on a LAN address — there are no
  // certificates on a church wifi — so this must accept http too, or the
  // whole local mode would silently fall back to the hand tally.
  return Boolean(SCRIPT_URL && /^https?:\/\//.test(SCRIPT_URL));
}
