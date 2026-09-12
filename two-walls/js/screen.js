// ============================================================
// PROJECTOR VIEW
//
// The projector is the driver: the leader stands at the laptop and uses
// the arrow keys, exactly like the paper deck. Moving between slides
// publishes the current stage, and every phone in the room follows.
// leader.html is an optional remote that can drive it from the front.
// ============================================================

import { REHEARSAL_MODE, ENABLE_WHY, POLL_INTERVAL_MS, IS_LOCAL, SCRIPT_URL } from './config.js';
import { sigilSvg, mintSynthetic } from './identity.js';
import {
  CORNERS, cornerIndex, BELONGS_OPTIONS, VERSE_SORT, VERSES,
  verseText, verdict, movement,
} from './lesson.js';
import {
  getRoomCode, subscribe, publishControl, isOffline, clearRoom,
  byKey, votesById, countsFor, roster,
} from './room.js';
import { toSvg } from './vendor/qrcode.js';

const deck = document.getElementById('deck');
const slides = [...document.querySelectorAll('.slide')];
const room = getRoomCode({ create: true });

let current = 0;
let rows = [];
let revealed = false;
let sortIndex = 0;
let rehearsing = false;      // flipped on below if config asks for it
let phonesDown = false;
let lastNavSeq = 0;
let synthetic = [];

// ============================================================
// JOIN DETAILS
//
// The QR is the only instruction students get, so it has to encode an
// address their phones can actually reach. Building it from location.href
// is wrong in the one case that matters: the leader opens the projector
// page on `localhost`, and every phone in the room then scans a code
// pointing at their own device. So when we're on the local server we ask
// it for the laptop's LAN address and build the QR from that instead.
// ============================================================
document.getElementById('roombadge').textContent = room;
document.getElementById('roomcode').textContent = room;

function buildJoinUrl(base) {
  const url = new URL('join.html', base);
  url.searchParams.set('room', room);
  return url.href;
}

function paintJoin(joinUrl) {
  document.getElementById('joinurl').textContent =
    joinUrl.replace(/^https?:\/\//, '').replace(/\/join\.html.*$/, '');
  try {
    document.getElementById('qrbox').innerHTML = toSvg(joinUrl);
  } catch (err) {
    // Never let a QR failure take the join screen down — the address and
    // code underneath are enough to run the session.
    console.error('QR generation failed', err);
    document.getElementById('qrbox').innerHTML =
      '<p style="color:#131A22;font-size:14px;text-align:center;padding:16px;line-height:1.5">'
      + 'Type the address below into your browser.</p>';
  }
}

// Draw something immediately, then correct it once the server answers.
paintJoin(buildJoinUrl(location.href));

if (IS_LOCAL) {
  (async () => {
    try {
      const res = await fetch(`${SCRIPT_URL}?ping=1`, { cache: 'no-store' });
      const info = await res.json();

      if (!info.lan) {
        // The laptop has no network, so nothing the phones hold can reach
        // it. Say so plainly rather than showing an unscannable code.
        document.getElementById('lanwarn').hidden = false;
        return;
      }
      const lanJoin = buildJoinUrl(`${info.lan}/two-walls/`);
      if (lanJoin !== buildJoinUrl(location.href)) paintJoin(lanJoin);
    } catch (err) {
      console.warn('Could not ask the local server for its LAN address:', err);
    }
  })();
}

// ---------- navigation ----------
const dots = document.getElementById('dots');
const countEl = document.getElementById('count');
const pad = (n) => String(n).padStart(2, '0');

slides.forEach((s, i) => {
  const b = document.createElement('button');
  b.setAttribute('aria-label', s.dataset.label || `Section ${i + 1}`);
  b.addEventListener('click', () => go(i));
  dots.appendChild(b);
});
const dotEls = [...dots.children];

function setCurrent(i) {
  if (i === current) return;
  current = i;
  countEl.textContent = `${pad(i + 1)} / ${pad(slides.length)}`;
  dotEls.forEach((d, j) => d.setAttribute('aria-current', j === i ? 'true' : 'false'));
  pushControl();
  onEnterSlide(slides[i]);
}

function go(i) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  slides[i].scrollIntoView({ behavior: 'smooth' });
  setCurrent(i);
}

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) setCurrent(slides.indexOf(e.target)); });
}, { root: deck, threshold: 0.55 });
slides.forEach((s) => io.observe(s));

countEl.textContent = `${pad(1)} / ${pad(slides.length)}`;
dotEls[0].setAttribute('aria-current', 'true');

document.getElementById('up').onclick = () => go(current - 1);
document.getElementById('down').onclick = () => go(current + 1);

// ---------- leader notes ----------
const notes = document.getElementById('notes');
const toggleNotes = () => {
  const open = notes.classList.toggle('open');
  notes.setAttribute('aria-hidden', open ? 'false' : 'true');
};
document.getElementById('notesbtn').onclick = toggleNotes;
document.getElementById('notesclose').onclick = toggleNotes;

document.addEventListener('keydown', (e) => {
  if (/input|textarea/i.test(document.activeElement.tagName)) return;
  if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(current + 1); }
  if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); go(current - 1); }
  if (e.key === 'n' || e.key === 'N') toggleNotes();
  if (e.key === 'Escape' && notes.classList.contains('open')) toggleNotes();
  if (e.key === 'm' || e.key === 'M') playMigration();
  if (e.key === 'r' || e.key === 'R') toggleRehearsal();
});

// ---------- Wall B: one button, every phone ----------
function doUncover() {
  revealed = true;
  document.querySelectorAll('#coverB').forEach((c) => c.classList.add('off'));
  document.getElementById('afterUncover').style.opacity = '1';
}

document.getElementById('uncover').onclick = () => {
  doUncover();
  pushControl();
};

// ---------- what the room is currently on ----------
function stageOf(slide) { return slide.dataset.stage || 'hold'; }

function pushControl() {
  publishControl(room, {
    stage: stageOf(slides[current]),
    revealed,
    sortIndex,
    phonesDown,
    ts: Date.now(),
  });
}

/**
 * Act on a nav request from leader.html. The remote deliberately doesn't
 * write the control record itself — the projector owns that and republishes
 * it on a timer, so two writers would fight. The remote asks; we do.
 */
function applyNav(req) {
  if (!req || !req.seq || req.seq <= lastNavSeq) return;
  lastNavSeq = req.seq;

  if (typeof req.move === 'number') {
    go(current + req.move);
    return;                      // go() already pushes control
  }
  if (req.reveal) doUncover();
  if (typeof req.phonesDown === 'boolean') phonesDown = req.phonesDown;
  if (typeof req.sortMove === 'number') {
    sortIndex = Math.max(0, Math.min(VERSE_SORT.length - 1, sortIndex + req.sortMove));
    renderSort();
  }
  pushControl();
}

function onEnterSlide(slide) {
  if (stageOf(slide) === 'migration') playMigration();
}

// ============================================================
// ROOM MAP
// ============================================================
const maps = new Map();

document.querySelectorAll('[data-map]').forEach((shell) => {
  const grid = document.createElement('div');
  grid.className = 'mapgrid';
  CORNERS.forEach((c, i) => {
    const q = document.createElement('div');
    q.className = 'quad' + (shell.dataset.counts === 'hidden' ? ' hidden' : '');
    q.dataset.corner = c.id;
    q.innerHTML =
      `<p class="qlabel">${i + 1}. ${c.label}</p>` +
      '<div class="qn">0</div><div class="qpct">&nbsp;</div>';
    grid.appendChild(q);
  });
  const layer = document.createElement('div');
  layer.className = 'tokens';
  shell.append(grid, layer);
  maps.set(shell.dataset.map, { shell, grid, layer, tokens: new Map() });
});

/**
 * Where a token sits inside its quadrant. Tokens are packed into a tidy
 * grid in the lower part of each quadrant, below the label, so the cluster
 * reads as a crowd rather than a random scatter — and so positions stay
 * stable between polls instead of jittering.
 */
function slot(cornerIdx, k, n) {
  const qx = (cornerIdx % 2) * 50;
  const qy = Math.floor(cornerIdx / 2) * 50;

  // The top of each quadrant belongs to the label and the count, so tokens
  // live in the band below it. Rows use a fixed pitch, centred in that band,
  // rather than being stretched to fill it — stretching two rows across the
  // whole band reads as two unrelated groups instead of one crowd.
  const BAND_TOP = 30, BAND_H = 18, MAX_PITCH_Y = 6.5;
  const SPAN_X = 38, MAX_PITCH_X = 11;

  const cols = Math.max(1, Math.ceil(Math.sqrt(n * 2.2)));
  const rowsN = Math.max(1, Math.ceil(n / cols));
  const col = k % cols;
  const rowI = Math.floor(k / cols);

  const pitchY = rowsN > 1 ? Math.min(MAX_PITCH_Y, BAND_H / (rowsN - 1)) : 0;
  const yStart = qy + BAND_TOP + (BAND_H - pitchY * (rowsN - 1)) / 2;

  const pitchX = cols > 1 ? Math.min(MAX_PITCH_X, SPAN_X / (cols - 1)) : 0;
  const xStart = qx + 6 + (SPAN_X - pitchX * (cols - 1)) / 2;

  return { x: xStart + col * pitchX, y: yStart + rowI * pitchY };
}

/** Positions for every student, given { id: cornerId }. */
function layout(votes, people) {
  const buckets = CORNERS.map(() => []);
  for (const p of people) {
    const idx = cornerIndex(votes[p.id]);
    if (idx > -1) buckets[idx].push(p);
  }
  const pos = {};
  buckets.forEach((bucket, idx) => {
    bucket.sort((a, b) => (a.id < b.id ? -1 : 1));   // stable ordering
    const crowded = bucket.length > 12;   // names would collide past this
    bucket.forEach((p, k) => {
      pos[p.id] = { ...slot(idx, k, bucket.length), corner: idx, crowded };
    });
  });
  return pos;
}

function tokenEl(map, person) {
  let el = map.tokens.get(person.id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'tok new';
    el.innerHTML = sigilSvg(person, 24) + `<span class="name">${person.alias}</span>`;
    map.layer.appendChild(el);
    map.tokens.set(person.id, el);
    setTimeout(() => el.classList.remove('new'), 520);
  }
  return el;
}

function renderMap(name, votes, people, counts) {
  const map = maps.get(name);
  if (!map) return;

  const pos = layout(votes, people);

  // drop tokens for anyone who has since un-voted
  for (const [id, el] of map.tokens) {
    if (!pos[id]) { el.remove(); map.tokens.delete(id); }
  }

  for (const p of people) {
    const at = pos[p.id];
    if (!at) continue;
    const el = tokenEl(map, p);
    el.style.left = `${at.x}%`;
    el.style.top = `${at.y}%`;
    el.classList.toggle('tight', at.crowded);
  }

  paintCounts(map, counts);
}

function paintCounts(map, counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  [...map.grid.children].forEach((q, i) => {
    q.querySelector('.qn').textContent = counts[i];
    q.querySelector('.qpct').innerHTML = total
      ? `${Math.round((counts[i] / total) * 100)}% of the room`
      : '&nbsp;';
  });
}

// ============================================================
// THE MIGRATION
// ============================================================
let migrationTimer = null;

function playMigration() {
  const map = maps.get('mig');
  if (!map) return;
  clearTimeout(migrationTimer);

  const people = roster(rows);
  const r1 = votesById(rows, 'r1');
  const r2 = votesById(rows, 'r2');

  // Only people who answered both rounds can migrate — anyone else has
  // nothing to compare and would just appear out of nowhere.
  const both = people.filter((p) => r1[p.id] && r2[p.id]);
  const from = layout(r1, both);
  const to = layout(r2, both);

  // Start everyone where they began the session.
  map.layer.querySelectorAll('.tok').forEach((el) => el.remove());
  map.tokens.clear();

  for (const p of both) {
    const el = tokenEl(map, p);
    el.style.left = `${from[p.id].x}%`;
    el.style.top = `${from[p.id].y}%`;
    el.classList.toggle('tight', from[p.id].crowded || to[p.id].crowded);
    el.classList.toggle('moving', from[p.id].corner !== to[p.id].corner);
    el.classList.toggle('stayed', from[p.id].corner === to[p.id].corner);
  }

  paintCounts(map, countsFor(rows, 'r1', CORNERS));

  // …then let them move. One beat first, so the room sees the starting
  // picture before anything shifts.
  migrationTimer = setTimeout(() => {
    for (const p of both) {
      const el = map.tokens.get(p.id);
      if (!el) continue;
      el.style.left = `${to[p.id].x}%`;
      el.style.top = `${to[p.id].y}%`;
    }
    paintCounts(map, countsFor(rows, 'r2', CORNERS));
  }, 1400);

  const m = movement(r1, r2);
  document.getElementById('verdict').textContent =
    verdict(countsFor(rows, 'r1', CORNERS), countsFor(rows, 'r2', CORNERS));

  const movestat = document.getElementById('movestat');
  if (!m.total) {
    movestat.innerHTML = '';
  } else {
    let line = `<b>${m.moved}</b> of <b>${m.total}</b> people moved · ` +
      `<b>${m.warmer}</b> toward “He’s glad” · <b>${m.colder}</b> the other way · ` +
      `<b>${m.stayed}</b> didn’t move at all.`;
    // The bar chart above averages individuals out. When the totals barely
    // budge but people did move, that's worth naming rather than missing.
    const flat = /barely moved/.test(document.getElementById('verdict').textContent);
    if (flat && m.moved > 0) {
      line += ` The totals hardly shifted, but <b>${m.moved}</b> people did move —
        they just cancelled each other out, or moved within the same half.
        Ask them, not the chart.`;
    }
    movestat.innerHTML = line;
  }
}

// ============================================================
// VERSE BLOCKS
// ============================================================
const VERSE_BLOCKS = {
  witnesses: ['ecc97', 'ecc224', 'tim617', 'ps1611'],
  honest: ['cor510', 'rom81', 'ps139'],
  close: ['ecc1110', 'ecc121'],
};

document.querySelectorAll('[data-verses]').forEach((host) => {
  const keys = VERSE_BLOCKS[host.dataset.verses] || [];
  host.innerHTML = keys.map((k) => {
    const v = VERSES[k];
    const water = host.dataset.verses === 'honest' ? ' water' : '';
    return `<div class="vitem${water}">
      <p class="vref">${v.ref}</p>
      <p class="vtext">${verseText(k)}</p>
      ${v.note ? `<p class="vnote">${v.note}</p>` : ''}
    </div>`;
  }).join('');
});

document.getElementById('zephline').textContent = verseText('zeph317');
document.getElementById('zephref').textContent = `${VERSES.zeph317.ref} — ${VERSES.zeph317.note}`;

// ============================================================
// VERSE SORT
// ============================================================
function renderSort() {
  const item = VERSE_SORT[sortIndex];
  const v = VERSES[item.key];
  document.getElementById('sortcard').innerHTML =
    `<p class="vref">${v.ref}</p><p class="vtext">${verseText(item.key)}</p>`;

  const counts = countsFor(rows, `sort${sortIndex}`, CORNERS);
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);
  document.getElementById('sortbars').innerHTML = CORNERS.map((c, i) => `
    <div class="sortrow">
      <div><div class="sl">${c.label}</div>
        <div class="st"><i style="width:${(counts[i] / max) * 100}%"></i></div></div>
      <div class="sn">${counts[i]}</div>
    </div>`).join('');
  document.getElementById('sortprev').disabled = sortIndex === 0;
  document.getElementById('sortnext').textContent =
    sortIndex >= VERSE_SORT.length - 1 ? 'Done' : 'Next verse';
  if (total === 0) { /* nothing yet; bars stay empty */ }
}

document.getElementById('sortprev').onclick = () => {
  sortIndex = Math.max(0, sortIndex - 1);
  pushControl(); renderSort();
};
document.getElementById('sortnext').onclick = () => {
  sortIndex = Math.min(VERSE_SORT.length - 1, sortIndex + 1);
  pushControl(); renderSort();
};

// ============================================================
// POLL AND RENDER
// ============================================================
function syntheticRows() {
  const out = [];
  for (const s of synthetic) {
    out.push({ sessionId: s.id, key: 'join', value: 1, alias: s.alias, color: s.color, sigil: s.sigil, ts: s.ts });
    out.push({ sessionId: s.id, key: 'r1', value: s.r1, alias: s.alias, color: s.color, sigil: s.sigil, ts: s.ts });
    out.push({ sessionId: s.id, key: 'r2', value: s.r2, alias: s.alias, color: s.color, sigil: s.sigil, ts: s.ts + 1 });
    if (s.why) out.push({ sessionId: s.id, key: 'why', value: s.why, alias: s.alias, color: s.color, sigil: s.sigil, ts: s.ts });
  }
  return out;
}

function render() {
  const people = roster(rows);

  // ---- join screen ----
  document.getElementById('joincount').textContent = people.length;
  const rosterEl = document.getElementById('roster');
  if (!people.length) {
    rosterEl.innerHTML = '<p class="emptyroster">Nobody yet. The first alias will appear here.</p>';
  } else {
    const existing = new Set([...rosterEl.querySelectorAll('.chip')].map((c) => c.dataset.id));
    if (rosterEl.querySelector('.emptyroster')) rosterEl.innerHTML = '';
    for (const p of people) {
      if (existing.has(p.id)) continue;
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.dataset.id = p.id;
      chip.innerHTML = sigilSvg(p, 15) + p.alias;
      rosterEl.appendChild(chip);
    }
  }

  // ---- the two live rounds ----
  const r1 = votesById(rows, 'r1');
  const r2 = votesById(rows, 'r2');
  const c1 = countsFor(rows, 'r1', CORNERS);
  const c2 = countsFor(rows, 'r2', CORNERS);

  renderMap('r1', r1, people, c1);
  renderMap('r1b', r1, people, c1);
  renderMap('r2', r2, people, c2);

  // ---- waiting strips ----
  const setWait = (labelId, barId, voted) => {
    const label = document.getElementById(labelId);
    const bar = document.getElementById(barId);
    if (!label || !bar) return;
    const n = people.length;
    label.textContent = n
      ? `${voted} of ${n} have answered`
      : 'Waiting for the room…';
    bar.style.width = n ? `${(voted / n) * 100}%` : '0%';
  };
  setWait('w1label', 'w1bar', Object.keys(r1).length);
  setWait('w2label', 'w2bar', Object.keys(r2).length);

  // ---- one-word whys ----
  if (ENABLE_WHY) {
    const words = Object.values(byKey(rows, 'why'))
      .map((r) => String(r.value || '').trim())
      .filter(Boolean)
      .slice(-28);
    const host = document.getElementById('words1');
    if (host.dataset.n !== String(words.length)) {
      host.dataset.n = String(words.length);
      host.innerHTML = words.map((w) => `<span class="word">${escapeHtml(w)}</span>`).join('');
    }
  }

  // ---- does this belong in the Bible ----
  const bCounts = BELONGS_OPTIONS.map(() => 0);
  for (const r of Object.values(byKey(rows, 'belongs'))) {
    const i = BELONGS_OPTIONS.indexOf(r.value);
    if (i > -1) bCounts[i]++;
  }
  const bMax = Math.max(1, ...bCounts);
  document.getElementById('belongs').innerHTML = BELONGS_OPTIONS.map((o, i) => `
    <div class="sortrow">
      <div><div class="sl">${o}</div>
        <div class="st"><i style="width:${(bCounts[i] / bMax) * 100}%"></i></div></div>
      <div class="sn">${bCounts[i]}</div>
    </div>`).join('');

  renderSort();
  renderPortrait(people, c1, c2, r1, r2);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ---------- the closing room portrait ----------
function renderPortrait(people, c1, c2, r1, r2) {
  const m = movement(r1, r2);
  const host = document.getElementById('portrait');
  const bars = (counts) => {
    const max = Math.max(1, ...counts);
    return CORNERS.map((c, i) => `
      <div class="pbar"><span>${c.short}</span>
        <span class="t"><i style="width:${(counts[i] / max) * 100}%"></i></span>
        <span>${counts[i]}</span></div>`).join('');
  };
  host.innerHTML = `
    <h3>This room, this morning</h3>
    <div class="pgrid">
      <div class="pstat"><div class="pn">${people.length}</div><div class="pl">in the room</div></div>
      <div class="pstat"><div class="pn">${m.moved}</div><div class="pl">changed their mind after hearing both halves</div></div>
      <div class="pstat"><div class="pn">${m.warmer}</div><div class="pl">moved toward “He’s glad”</div></div>
      <div class="pstat"><div class="pn">${m.stayed}</div><div class="pl">didn’t move at all</div></div>
    </div>
    <div class="pminis">
      <div class="pmini"><h4>Before either wall</h4>${bars(c1)}</div>
      <div class="pmini"><h4>After both walls</h4>${bars(c2)}</div>
    </div>`;
}

// ---------- rehearsal mode ----------
function toggleRehearsal() {
  rehearsing = !rehearsing;
  if (rehearsing && !synthetic.length) {
    synthetic = mintSynthetic(20).map((s, i) => {
      const r1i = [0, 1, 1, 2, 2, 2, 3, 3][Math.floor(Math.random() * 8)];
      // most people stay put; of those who move, most move warmer
      const move = Math.random() < 0.45;
      const r2i = move
        ? Math.max(0, Math.min(3, r1i + (Math.random() < 0.72 ? -1 : 1)))
        : r1i;
      return {
        ...s,
        ts: Date.now() + i,
        r1: CORNERS[r1i].id,
        r2: CORNERS[r2i].id,
        why: ['guilt', 'relief', 'unsure', 'scared', 'loved', 'watched', 'free', 'tired'][i % 8],
      };
    });
  }
  if (!rehearsing) {
    // clear synthetic tokens out of every map so nothing lingers
    for (const map of maps.values()) {
      for (const [id, el] of map.tokens) {
        if (synthetic.some((s) => s.id === id)) { el.remove(); map.tokens.delete(id); }
      }
    }
    document.querySelectorAll('#roster .chip').forEach((c) => {
      if (synthetic.some((s) => s.id === c.dataset.id)) c.remove();
    });
  }
  updateBadge();
  tick(rows);
}

// ---------- live badge ----------
function updateBadge(offline = isOffline()) {
  const badge = document.getElementById('livebadge');
  badge.className = 'badge ' + (offline ? 'offline' : 'live');
  badge.querySelector('.label').textContent = rehearsing
    ? 'Rehearsal mode'
    : offline
      ? 'Offline — use the hand tally'
      : 'Live';
}

// ============================================================
// LEFTOVERS FROM A PREVIOUS SESSION
//
// The room code is sticky so that a closed or crashed projector tab comes
// back on the same room instead of stranding every phone in the building.
// The cost of that is last week's answers still sitting there, which would
// quietly poison the room map and the migration.
//
// Age tells the two cases apart: a projector that just reloaded mid-session
// sees answers from minutes ago, while a previous session's are hours or
// days old. Only the latter gets a warning.
// ============================================================
const STALE_AFTER_MS = 30 * 60 * 1000;
let staleChecked = false;

function checkForLeftovers(fresh) {
  if (staleChecked) return;

  const students = fresh.filter(
    (r) => r.sessionId !== '__control' && r.sessionId !== '__leader',
  );
  if (!students.length) { staleChecked = true; return; }

  const newest = Math.max(...students.map((r) => r.ts || 0));
  const age = Date.now() - newest;
  if (age < STALE_AFTER_MS) { staleChecked = true; return; }   // a live reload

  staleChecked = true;
  const people = roster(fresh).length;
  const hours = Math.round(age / 3600000);
  const when = hours < 48 ? `about ${hours} hour${hours === 1 ? '' : 's'} ago`
    : `about ${Math.round(hours / 24)} days ago`;

  const banner = document.getElementById('stale');
  document.getElementById('staletext').textContent =
    `This room still has ${students.length} answer${students.length === 1 ? '' : 's'} in it from ${people} ` +
    `${people === 1 ? 'person' : 'people'}, last touched ${when}.`;
  document.getElementById('stalesub').textContent =
    'Clear them before you start, or they will be counted in the room map and the migration.';
  banner.hidden = false;

  document.getElementById('staleclear').onclick = async () => {
    document.getElementById('staleclear').disabled = true;
    await clearRoom(room);
    rows = [];
    banner.hidden = true;
    document.getElementById('roster').innerHTML =
      '<p class="emptyroster">Nobody yet. The first alias will appear here.</p>';
    render();
    pushControl();
  };
}

// ---------- the loop ----------
function tick(fresh, meta = {}) {
  checkForLeftovers(fresh);
  rows = rehearsing ? [...fresh, ...syntheticRows()] : fresh;
  updateBadge(meta.offline ?? isOffline());
  render();
}

subscribe(room, (fresh, meta) => {
  const nav = fresh.find((r) => r.key === 'nav');
  if (nav) applyNav(typeof nav.value === 'string' ? JSON.parse(nav.value) : nav.value);

  // Keep our own control row, and the remote's, out of the student data.
  tick(fresh.filter((r) => r.sessionId !== '__control' && r.sessionId !== '__leader'), meta);
});

// Publish where we are straight away, so a phone that joins late lands on
// the right screen rather than the holding one.
pushControl();
setInterval(pushControl, Math.max(POLL_INTERVAL_MS * 3, 5000));
if (REHEARSAL_MODE) toggleRehearsal();
updateBadge();
render();
