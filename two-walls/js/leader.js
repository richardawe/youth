// ============================================================
// LEADER REMOTE
//
// Optional. The projector runs the session perfectly well on its own
// arrow keys; this is for when you'd rather stand at the front.
//
// The remote never writes the control record itself — the projector owns
// that, and republishes it periodically so late phones land on the right
// screen. Instead the remote posts a NAV REQUEST and the projector acts on
// it. One writer, no tug of war.
//
// It also carries the hand tally, which is the answer when the wifi dies:
// the same plus-and-minus counters as the original paper deck.
// ============================================================

import { LEADER_PASSCODE } from './config.js';
import {
  CORNERS, VERSE_SORT, verdict, movement,
} from './lesson.js';
import {
  getRoomCode, subscribe, submit, readControl, isOffline,
  byKey, votesById, countsFor, roster, clearRoom,
} from './room.js';

const view = document.getElementById('view');
const LEADER_ID = '__leader';
const leaderIdentity = { id: LEADER_ID, alias: '', color: '', sigil: 'circle' };

let room = getRoomCode();
let rows = [];
let control = null;
let offline = true;
let navSeq = Date.now();
let tallyRound = 'r1';

// Hand-tally counts, kept locally — these are what the leader taps when
// there's no live sync to draw from.
const hand = { r1: CORNERS.map(() => 0), r2: CORNERS.map(() => 0) };

// ---------- gate ----------
function gate(err) {
  view.innerHTML = `
    <p class="kicker">Leader access</p>
    <h2>Just so a student doesn't wander in here</h2>
    ${err ? `<p class="err">${err}</p>` : ''}
    <input type="text" id="pc" placeholder="passcode" autocomplete="off" aria-label="Passcode">
    <button class="btn sun" id="go">Unlock</button>`;
  const input = document.getElementById('pc');
  const submitPc = () => {
    if (input.value === LEADER_PASSCODE) {
      try { sessionStorage.setItem('two-walls-leader', 'yes'); } catch { /* ignore */ }
      askRoom();
    } else {
      gate('Not that one.');
    }
  };
  document.getElementById('go').onclick = submitPc;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitPc(); });
  input.focus();
}

function askRoom() {
  if (room) return start();
  view.innerHTML = `
    <p class="kicker">Which room</p>
    <h2>Enter the code showing on the projector</h2>
    <input type="text" id="code" class="codein" maxlength="4" autocomplete="off"
           autocapitalize="characters" spellcheck="false" placeholder="····" aria-label="Room code">
    <button class="btn sun" id="go">Connect</button>`;
  const input = document.getElementById('code');
  const go = () => {
    const v = input.value.trim().toUpperCase();
    if (v.length < 3) return;
    room = v;
    start();
  };
  document.getElementById('go').onclick = go;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  input.focus();
}

// ---------- nav requests ----------
function nav(action) {
  navSeq = Date.now();
  submit(room, leaderIdentity, 'nav', { ...action, seq: navSeq });
}

// ---------- main ----------
function start() {
  document.getElementById('roomsub').textContent = `room ${room}`;
  subscribe(room, (fresh, meta) => {
    offline = meta.offline;
    rows = fresh;
    control = readControl(fresh) || control;
    setConn();
    render();
  });
}

function setConn() {
  const el = document.getElementById('conn');
  el.className = offline ? 'offline' : 'live';
  el.querySelector('.label').textContent = offline ? 'offline' : 'live';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function render() {
  const people = roster(rows);
  const r1 = votesById(rows, 'r1');
  const r2 = votesById(rows, 'r2');
  const liveC1 = countsFor(rows, 'r1', CORNERS);
  const liveC2 = countsFor(rows, 'r2', CORNERS);

  const talkers = Object.values(byKey(rows, 'talk'))
    .filter((r) => r.value && String(r.value) !== '0');
  const answers = Object.values(byKey(rows, 'q3'))
    .filter((r) => String(r.value || '').trim());
  const words = Object.values(byKey(rows, 'why'))
    .map((r) => String(r.value || '').trim()).filter(Boolean);

  const stage = control?.stage || '—';

  view.innerHTML = `
    ${offline ? `<p class="warn">No live sync. Phones can't reach you — run the session
      from the hand tally below and say so out loud. Nothing else about the session changes.</p>` : ''}

    <div class="card">
      <h3>The room is on</h3>
      <p class="stagenow">${esc(stage)}</p>
      <p class="dim" style="margin:0">${control?.revealed ? 'Wall B is uncovered.' : 'Wall B still covered.'}</p>
      <div class="navrow">
        <button class="btn ghost" id="prev">← Back</button>
        <button class="btn sun" id="next">Forward →</button>
      </div>
      <div class="navrow">
        <button class="btn ghost" id="reveal">Take the sheet off</button>
        <button class="btn ghost" id="phonesdown">
          ${control?.phonesDown ? 'Give phones back' : 'Phones down'}
        </button>
      </div>
    </div>

    <div class="card">
      <h3>Live</h3>
      <div class="stats">
        <div><div class="n">${people.length}</div><div class="l">joined</div></div>
        <div><div class="n">${Object.keys(r1).length}</div><div class="l">answered round one</div></div>
        <div><div class="n">${Object.keys(r2).length}</div><div class="l">answered round two</div></div>
      </div>
    </div>

    ${talkers.length ? `
      <div class="card">
        <h3>Asked to talk — go to them, kindly, afterwards</h3>
        <div class="list">
          ${talkers.map((t) => `<div class="li"><span class="who">wants a conversation</span><strong>${esc(t.alias || 'someone')}</strong></div>`).join('')}
        </div>
      </div>` : ''}

    ${answers.length ? `
      <div class="card">
        <h3>Answers to question three</h3>
        <div class="list">
          ${answers.map((a) => `<div class="li"><span class="who">${esc(a.alias || 'someone')}</span>${esc(a.value)}</div>`).join('')}
        </div>
      </div>` : ''}

    ${words.length ? `
      <div class="card">
        <h3>One-word whys (${words.length})</h3>
        <p style="margin:0;font-size:15px;line-height:1.7">${words.map((w) => esc(w)).join(' · ')}</p>
      </div>` : ''}

    <div class="card tally">
      <h3>Hand tally${offline ? '' : ' — only needed if the phones stop working'}</h3>
      <div class="roundtabs">
        <button id="tab1" aria-pressed="${tallyRound === 'r1'}">Round one</button>
        <button id="tab2" aria-pressed="${tallyRound === 'r2'}">Round two</button>
      </div>
      <div id="tallyrows"></div>
      <p class="verdictline" id="handverdict"></p>
    </div>

    <div class="card">
      <h3>Verse sort</h3>
      <p class="dim" style="margin:0 0 12px">Showing verse ${(control?.sortIndex ?? 0) + 1} of ${VERSE_SORT.length}</p>
      <div class="navrow">
        <button class="btn ghost" id="sortprev">← Previous verse</button>
        <button class="btn ghost" id="sortnext">Next verse →</button>
      </div>
    </div>

    <div class="card">
      <h3>After everyone's gone</h3>
      <button class="btn ghost" id="clear">Clear this room's answers</button>
      <p class="dim" style="margin:10px 0 0">Wipes this morning's responses so the next group starts clean.
        Do it after you've looked at the answers above, not before.</p>
    </div>`;

  document.getElementById('prev').onclick = () => nav({ move: -1 });
  document.getElementById('next').onclick = () => nav({ move: 1 });
  document.getElementById('reveal').onclick = () => nav({ reveal: true });
  document.getElementById('phonesdown').onclick = () => nav({ phonesDown: !control?.phonesDown });
  document.getElementById('sortprev').onclick = () => nav({ sortMove: -1 });
  document.getElementById('sortnext').onclick = () => nav({ sortMove: 1 });

  document.getElementById('tab1').onclick = () => { tallyRound = 'r1'; render(); };
  document.getElementById('tab2').onclick = () => { tallyRound = 'r2'; render(); };

  document.getElementById('clear').onclick = async () => {
    if (!confirm("Clear every answer for room " + room + "? This can't be undone.")) return;
    await clearRoom(room);
    rows = [];
    render();
  };

  renderTally(liveC1, liveC2);
}

/**
 * The hand tally. Falls back to live counts as its starting point when
 * there are any, so switching to hands mid-session doesn't start from zero.
 */
function renderTally(liveC1, liveC2) {
  const host = document.getElementById('tallyrows');
  const data = hand[tallyRound];
  const ghost = tallyRound === 'r2' ? hand.r1 : null;
  const max = Math.max(1, ...data, ...(ghost || [0]));

  host.innerHTML = CORNERS.map((c, i) => `
    <div class="row">
      <div>
        <div class="lbl">${esc(c.label)}</div>
        <div class="track">
          ${ghost ? `<div class="ghost" style="width:${(ghost[i] / max) * 100}%"></div>` : ''}
          <div class="fill" style="width:${(data[i] / max) * 100}%"></div>
        </div>
      </div>
      <div class="ctr">
        <button data-i="${i}" data-d="-1" aria-label="Remove one from ${esc(c.label)}">−</button>
        <span class="n">${data[i]}</span>
        <button data-i="${i}" data-d="1" aria-label="Add one to ${esc(c.label)}">+</button>
      </div>
    </div>`).join('');

  host.querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.i);
      const d = Number(b.dataset.d);
      data[i] = Math.max(0, data[i] + d);
      renderTally(liveC1, liveC2);
    };
  });

  // Prefer the hand counts once anything has been tapped; otherwise show
  // the verdict from the live data.
  const handTotal = hand.r1.reduce((a, b) => a + b, 0) + hand.r2.reduce((a, b) => a + b, 0);
  const useHand = handTotal > 0;
  const c1 = useHand ? hand.r1 : liveC1;
  const c2 = useHand ? hand.r2 : liveC2;

  let line = verdict(c1, c2);
  if (!useHand) {
    const m = movement(votesById(rows, 'r1'), votesById(rows, 'r2'));
    if (m.total) {
      line += ` (${m.moved} of ${m.total} moved · ${m.warmer} warmer · ${m.colder} colder)`;
    }
  }
  document.getElementById('handverdict').textContent = line;
}

// ---------- boot ----------
let unlocked = false;
try { unlocked = sessionStorage.getItem('two-walls-leader') === 'yes'; } catch { /* ignore */ }
if (unlocked) askRoom();
else gate();
