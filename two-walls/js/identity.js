// ============================================================
// ANONYMOUS IDENTITY
//
// Every phone gets a two-word alias, a colour and a sigil. The
// property we're after is: SELF-RECOGNISABLE, OTHER-ANONYMOUS.
// A student spots their own token on the projector in about half a
// second and cannot identify anybody else's. No names are collected
// anywhere in this app, and the leader never sees one.
//
// The alias lives in localStorage, so a reload — or a phone that
// locks and wakes — keeps the same identity all session. That's what
// makes "The Migration" possible: we know that someone moved from
// corner 4 to corner 1 without ever knowing who they are.
// ============================================================

const STORE_KEY = 'two-walls-identity-v1';

// Deliberately warm and a little poetic, to match the deck's tone.
// Nothing that could read as an insult if it landed on a teenager —
// they will be looking at this on a projector in front of their friends.
const FIRST = [
  'Amber', 'Quiet', 'North', 'Copper', 'Even', 'Golden', 'Distant', 'Steady',
  'Silver', 'Open', 'Bright', 'Autumn', 'Gentle', 'Far', 'Morning', 'Deep',
  'Clear', 'Rising', 'Warm', 'Patient', 'Long', 'Early', 'Wild', 'Certain',
  'Sudden', 'Kind', 'Last', 'First', 'Slow', 'True', 'Wide', 'Near',
];

const SECOND = [
  'Kestrel', 'Lantern', 'Ember', 'Harbour', 'Compass', 'Meadow', 'Thunder', 'Anchor',
  'Beacon', 'Willow', 'River', 'Falcon', 'Orchard', 'Signal', 'Canyon', 'Swallow',
  'Bellows', 'Sparrow', 'Cedar', 'Heron', 'Summit', 'Bramble', 'Lighthouse', 'Otter',
  'Thistle', 'Kingfisher', 'Pine', 'Wren', 'Stonework', 'Hollow', 'Aspen', 'Curlew',
];

// Readable against the deck's dark ground, and distinguishable from
// each other at projector distance.
const COLORS = [
  '#F2A93B', '#6BA8CB', '#E4746A', '#8FBF7F', '#C79BD6', '#E8C45E',
  '#7FC9C1', '#D98A5F', '#9AAEE0', '#C9B08A', '#E0839F', '#79BFA1',
];

const SIGILS = ['circle', 'square', 'diamond', 'triangle', 'hex', 'cross'];

function randomInt(n) {
  if (globalThis.crypto && crypto.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  }
  return Math.floor(Math.random() * n);
}

function mint() {
  const id = globalThis.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);
  const first = FIRST[randomInt(FIRST.length)];
  const second = SECOND[randomInt(SECOND.length)];
  return {
    id,
    alias: `${first} ${second}`,
    color: COLORS[randomInt(COLORS.length)],
    sigil: SIGILS[randomInt(SIGILS.length)],
  };
}

/** This device's identity, minted once and then stable forever. */
export function getIdentity() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && saved.id && saved.alias) return saved;
  } catch { /* fall through and mint a new one */ }

  const fresh = mint();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(fresh)); } catch { /* private mode */ }
  return fresh;
}

/** Only used by the "start over" link on the phone, and by rehearsal mode. */
export function resetIdentity() {
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
  return getIdentity();
}

/** Synthetic students for rehearsal mode. Never persisted. */
export function mintSynthetic(n) {
  const out = [];
  const seen = new Set();
  while (out.length < n) {
    const s = mint();
    if (seen.has(s.alias)) continue;   // duplicate aliases look like a bug on screen
    seen.add(s.alias);
    s.synthetic = true;
    out.push(s);
  }
  return out;
}

/** An inline SVG token. Used identically on the projector and the phone. */
export function sigilSvg(identity, size = 26) {
  const c = identity.color;
  const half = size / 2;
  const shapes = {
    circle: `<circle cx="${half}" cy="${half}" r="${half - 2}"/>`,
    square: `<rect x="3" y="3" width="${size - 6}" height="${size - 6}" rx="2"/>`,
    diamond: `<path d="M${half} 2 L${size - 2} ${half} L${half} ${size - 2} L2 ${half} Z"/>`,
    triangle: `<path d="M${half} 3 L${size - 3} ${size - 4} L3 ${size - 4} Z"/>`,
    hex: `<path d="M${half} 2 L${size - 3} ${size * 0.29} L${size - 3} ${size * 0.71} L${half} ${size - 2} L3 ${size * 0.71} L3 ${size * 0.29} Z"/>`,
    cross: `<path d="M${half - 3.5} 3 h7 v${half - 6.5} h${half - 6.5} v7 h-${half - 6.5} v${half - 6.5} h-7 v-${half - 6.5} h-${half - 6.5} v-7 h${half - 6.5} Z"/>`,
  };
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true" fill="${c}">${shapes[identity.sigil] || shapes.circle}</svg>`;
}
