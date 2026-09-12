// ============================================================
// PHONE VIEW
//
// The phone is a follower: it renders whatever stage the projector says
// the room is on, and nothing else. That's deliberate — a phone that can
// run ahead is a phone that gets stared at instead of the person talking.
//
// Between questions it shows a holding screen that tells them, in as many
// words, to put it face down and look up.
// ============================================================

import { ENABLE_WHY } from './config.js';
import { getIdentity, sigilSvg } from './identity.js';
import {
  CORNERS, cornerById, BELONGS_OPTIONS, VERSE_SORT, VERSES,
  verseText, STAGES,
} from './lesson.js';
import { getRoomCode, subscribe, submit, readControl, isOffline, byKey } from './room.js';

const me = getIdentity();
const view = document.getElementById('view');
const talkBtn = document.getElementById('talk');

let room = getRoomCode();
let control = null;
let myAnswers = {};        // key -> value, as last seen from the store
let renderedKey = '';      // so we don't rebuild the DOM on every poll
let unsubscribe = null;

// ---------- identity in the header ----------
document.getElementById('mesigil').innerHTML = sigilSvg(me, 26);
document.getElementById('mealias').textContent = me.alias;

function showIdentity() {
  document.getElementById('me').hidden = false;
  document.getElementById('prejoin').hidden = true;
  talkBtn.hidden = false;
}

// ---------- connection pip ----------
function setConn(offline) {
  const el = document.getElementById('conn');
  el.className = offline ? 'offline' : 'live';
  el.querySelector('.label').textContent = offline ? 'no signal' : room || '';
}

// ---------- small helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function buzz(ms = 18) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* unsupported */ }
}

async function save(key, value) {
  myAnswers[key] = value;
  await submit(room, me, key, value);
}

// ============================================================
// JOINING
// ============================================================
function renderJoinForm(err) {
  view.innerHTML = `
    <p class="kicker">This morning's session</p>
    <h1>Two walls,<br>one sentence</h1>
    <p>Enter the four-letter code on the screen at the front.</p>
    ${err ? `<p class="err">${esc(err)}</p>` : ''}
    <input type="text" id="code" class="codein" maxlength="4" autocomplete="off"
           autocapitalize="characters" spellcheck="false" placeholder="····"
           inputmode="latin" aria-label="Room code">
    <button class="btn sun" id="enter">Join the room</button>
    <p class="dim" style="margin-top:18px">You won't be asked for your name. You never will be.</p>`;

  const input = document.getElementById('code');
  const go = () => {
    const v = input.value.trim().toUpperCase();
    if (v.length < 3) { renderJoinForm('That code looks too short.'); return; }
    room = v;
    start();
  };
  document.getElementById('enter').onclick = go;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  input.focus();
}

async function start() {
  setConn(isOffline());
  showIdentity();

  // Announcing ourselves is what puts this alias on the projector.
  await save('join', 1);

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribe(room, (rows, meta) => {
    setConn(meta.offline);
    control = readControl(rows) || control;

    // Pull back our own answers, so a reloaded phone remembers what it said.
    for (const key of ['r1', 'r2', 'why', 'belongs', 'q3', 'talk', 'sort0', 'sort1', 'sort2']) {
      const mine = byKey(rows, key)[me.id];
      if (mine && mine.value != null) myAnswers[key] = mine.value;
    }

    talkBtn.classList.toggle('on', Boolean(myAnswers.talk));
    talkBtn.textContent = myAnswers.talk
      ? "You've asked to talk — the leader knows"
      : "I'd actually like to talk to someone";

    render();
  });
}

// ============================================================
// RENDER
// ============================================================
function render() {
  // "Phones down" wins over whatever slide the projector is on — that's the
  // point of it.
  const stageId = control?.phonesDown ? 'close' : (control?.stage || 'hold');
  const stage = control?.phonesDown
    ? { mode: 'off', title: 'Phones down', body: 'Look up. It\u2019ll come back when it\u2019s needed.' }
    : (STAGES[stageId] || STAGES.hold);

  // A cheap signature of everything that affects the markup. If it hasn't
  // changed, leave the DOM alone — otherwise we'd wipe a half-typed answer
  // every couple of seconds.
  const key = [
    stageId, stage.mode, control?.revealed, control?.sortIndex, control?.phonesDown,
    myAnswers.r1, myAnswers.r2, myAnswers.why, myAnswers.belongs, myAnswers.q3,
    myAnswers[`sort${control?.sortIndex ?? 0}`],
  ].join('|');
  if (key === renderedKey) return;
  renderedKey = key;

  switch (stage.mode) {
    case 'join':      return renderWelcome(stage);
    case 'vote':      return renderVote(stage);
    case 'why':       return renderWhy(stage);
    case 'belongs':   return renderChoice(stage, 'belongs', BELONGS_OPTIONS);
    case 'verse':     return renderVerse(stage);
    case 'reveal':    return renderReveal(stage);
    case 'verselist': return renderVerseList(stage);
    case 'versesort': return renderVerseSort(stage);
    case 'confront':  return renderConfront(stage);
    case 'text':      return renderText(stage);
    case 'off':       return renderOff(stage);
    default:          return renderHold(stage);
  }
}

function renderWelcome() {
  view.innerHTML = `
    <p class="kicker">You're in</p>
    <h1>${esc(me.alias)}</h1>
    <p>That's your name for this morning. It's on the screen at the front — find it.</p>
    <p>Nobody in this room can tell which one is yours, and nobody is ever going to ask.
       Answer honestly: it genuinely doesn't cost you anything here.</p>
    <div class="locked">
      <p>Now put the phone face down and look up. It'll tell you when it needs you.</p>
    </div>`;
}

function renderHold(stage) {
  view.innerHTML = `
    <div class="hold">
      <p class="glyph">—</p>
      <h2>${esc(stage.title)}</h2>
      <p>${esc(stage.body || '')}</p>
    </div>`;
}

function renderOff(stage) {
  view.innerHTML = `
    <div class="hold">
      <p class="glyph">✦</p>
      <h2>${esc(stage.title)}</h2>
      <p>${esc(stage.body || '')}</p>
    </div>`;
}

// ---------- the four corners ----------
function renderVote(stage) {
  const round = stage.round;
  const chosen = myAnswers[round];

  view.innerHTML = `
    <p class="kicker">${round === 'r2' ? 'Round two' : 'Round one'}</p>
    <h2>${esc(stage.title)}</h2>
    <p>${esc(stage.body || '')}</p>
    ${chosen ? lockedBlock(round) : ''}
    <div class="opts" id="opts">
      ${CORNERS.map((c, i) => `
        <button class="opt" data-id="${c.id}" aria-pressed="${chosen === c.id}">
          <span class="num">${i + 1}</span><span>${esc(c.label)}</span>
        </button>`).join('')}
    </div>`;

  view.querySelectorAll('.opt').forEach((btn) => {
    btn.onclick = async () => {
      buzz();
      view.querySelectorAll('.opt').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      renderedKey = '';                       // let the next poll redraw
      await save(round, btn.dataset.id);
      render();
    };
  });
}

function lockedBlock(round) {
  const c = cornerById(myAnswers[round]);
  return `<div class="locked">
    <p class="stamp">Locked in.</p>
    <p>You picked <strong>${esc(c ? c.label : '—')}</strong>. Change it if you want — nobody sees either way.</p>
  </div>`;
}

// ---------- one-word why ----------
function renderWhy(stage) {
  if (!ENABLE_WHY) return renderHold(STAGES.hold);
  const existing = myAnswers.why || '';

  view.innerHTML = `
    <p class="kicker">${esc(stage.title)}</p>
    <h2>Why that one?</h2>
    <p>${esc(stage.body || '')}</p>
    <input type="text" id="why" maxlength="16" placeholder="one word"
           autocomplete="off" spellcheck="false" value="${esc(existing)}" aria-label="One word">
    <p class="counter" id="whyleft">16 left</p>
    <button class="btn sun" id="sendwhy">${existing ? 'Change my word' : 'Send it up'}</button>
    ${existing ? `<div class="locked" style="margin-top:18px"><p>Yours is on the screen: <strong>${esc(existing)}</strong></p></div>` : ''}`;

  const input = document.getElementById('why');
  const left = document.getElementById('whyleft');
  const update = () => { left.textContent = `${16 - input.value.length} left`; };
  input.addEventListener('input', update);
  update();

  document.getElementById('sendwhy').onclick = async () => {
    // One word means one word — anything after the first space is dropped
    // rather than silently sending a sentence to the projector.
    const word = input.value.trim().split(/\s+/)[0] || '';
    if (!word) return;
    buzz();
    renderedKey = '';
    await save('why', word);
    render();
  };
}

// ---------- a simple choice list ----------
function renderChoice(stage, key, options) {
  const chosen = myAnswers[key];
  view.innerHTML = `
    <p class="kicker">${esc(stage.title)}</p>
    <h2>${esc(stage.body || '')}</h2>
    <div class="opts">
      ${options.map((o, i) => `
        <button class="opt" data-v="${esc(o)}" aria-pressed="${chosen === o}">
          <span class="num">${i + 1}</span><span>${esc(o)}</span>
        </button>`).join('')}
    </div>`;

  view.querySelectorAll('.opt').forEach((btn) => {
    btn.onclick = async () => {
      buzz();
      renderedKey = '';
      await save(key, btn.dataset.v);
      render();
    };
  });
}

// ---------- scripture in the hand ----------
function renderVerse(stage) {
  const v = VERSES[stage.verse];
  view.innerHTML = `
    <p class="kicker">${esc(stage.title)}</p>
    <div class="rule"></div>
    <p class="vref">${esc(v.ref)}</p>
    <p class="vtext">${esc(verseText(stage.verse))}</p>
    <p class="dim">${esc(stage.body || '')}</p>`;
}

/**
 * Wall B. The cover comes off every phone in the room at the same instant,
 * because it's the projector's reveal flag that drives it — which is the
 * whole reason this moment works better on phones than on paper.
 */
function renderReveal(stage) {
  const v = VERSES[stage.verse];
  const open = Boolean(control?.revealed);

  view.innerHTML = `
    <p class="kicker">${esc(stage.title)}</p>
    <div class="rule"></div>
    ${open ? `
      <div class="revealed">
        <p class="vref">${esc(v.ref)}</p>
        <p class="vtext">${esc(verseText(stage.verse))}</p>
        <p class="dim">${esc(stage.body || '')}</p>
      </div>` : `
      <div class="tear"><span>Still covered.<br>Watch the front.</span></div>`}`;

  if (open) buzz(26);
}

function renderVerseList(stage) {
  view.innerHTML = `
    <p class="kicker">${esc(stage.body || '')}</p>
    <h2>${esc(stage.title)}</h2>
    ${stage.verses.map((k) => {
      const v = VERSES[k];
      const water = stage.title.includes('Wall B') ? ' water' : '';
      return `<div class="vitem${water}">
        <p class="vref">${esc(v.ref)}</p>
        <p class="vtext">${esc(verseText(k))}</p>
        ${v.note ? `<p class="vnote">${esc(v.note)}</p>` : ''}
      </div>`;
    }).join('')}`;
}

// ---------- verse sort: same four corners, no new interface ----------
function renderVerseSort(stage) {
  const idx = control?.sortIndex ?? 0;
  const item = VERSE_SORT[idx];
  if (!item) return renderHold(STAGES.hold);

  const key = `sort${idx}`;
  const chosen = myAnswers[key];
  const v = VERSES[item.key];

  view.innerHTML = `
    <p class="kicker">Verse ${idx + 1} of ${VERSE_SORT.length}</p>
    <p class="vref">${esc(v.ref)}</p>
    <p class="vtext">${esc(verseText(item.key))}</p>
    <h2 style="font-size:19px;margin-top:20px">${esc(item.prompt)}</h2>
    <div class="opts">
      ${CORNERS.map((c, i) => `
        <button class="opt" data-id="${c.id}" aria-pressed="${chosen === c.id}">
          <span class="num">${i + 1}</span><span>${esc(c.label)}</span>
        </button>`).join('')}
    </div>`;

  view.querySelectorAll('.opt').forEach((btn) => {
    btn.onclick = async () => {
      buzz();
      renderedKey = '';
      await save(key, btn.dataset.id);
      render();
    };
  });
}

// ---------- the private confrontation ----------
function renderConfront(stage) {
  const first = cornerById(myAnswers.r1);

  view.innerHTML = `
    <p class="kicker">${esc(stage.title)}</p>
    ${first ? `
      <p class="dim">At the start of this morning, before you'd heard either wall, you said:</p>
      <h1 style="color:var(--sun);font-size:27px">${esc(first.label)}</h1>
      <p>${esc(stage.body)} Nobody else can see this. Nobody ever will.</p>
      <div class="locked"><p>Is it still true?</p></div>
      <p class="dim">Wait for the next question. Don't answer yet.</p>` : `
      <p class="dim">You didn't answer the first round, so there's nothing to compare —
         no harm done. Have a think about the question instead:</p>
      <h2>When you're having a genuinely good time, what is God doing?</h2>`}`;
}

// ---------- free text ----------
function renderText(stage) {
  const existing = myAnswers[stage.field] || '';
  view.innerHTML = `
    <p class="kicker">Question three</p>
    <h2>${esc(stage.title)}</h2>
    <p>${esc(stage.body || '')}</p>
    <textarea id="t" maxlength="600" placeholder="Only if you want to…"
      aria-label="Your answer">${esc(existing)}</textarea>
    <button class="btn sun" id="sendt">${existing ? 'Update my answer' : 'Send to the leader'}</button>
    ${existing ? '<p class="ok" style="margin-top:12px">Sent. You can change it any time.</p>' : ''}`;

  document.getElementById('sendt').onclick = async () => {
    const val = document.getElementById('t').value.trim();
    if (!val) return;
    buzz();
    renderedKey = '';
    await save(stage.field, val);
    render();
  };
}

// ============================================================
// TALK REQUEST
//
// Anonymity costs the leader the ability to notice who needs a
// conversation. This hands that back to the student instead: they opt in,
// and only then does their alias reach the leader's remote.
// ============================================================
talkBtn.onclick = async () => {
  const now = !myAnswers.talk;
  buzz(now ? 30 : 12);
  await save('talk', now ? 1 : 0);
  talkBtn.classList.toggle('on', now);
  talkBtn.textContent = now
    ? "You've asked to talk — the leader knows"
    : "I'd actually like to talk to someone";
};

// ============================================================
if (room) start();
else renderJoinForm();
