// ============================================================
// LESSON CONTENT
//
// The prose for each projector slide lives directly in screen.html —
// one <section class="slide"> per slide, editable by anyone who can
// read HTML, exactly like the original deck.
//
// What lives HERE is everything the phones and the room map need to
// agree on: the four corners, the copy each phone shows at each stage
// of the session, the verses, and the verdict wording.
//
// If you change a corner label, change it once here and it updates
// on the projector, on every phone, and in the leader's tally.
// ============================================================

import { DIVINE_NAME } from './config.js';

// ---------- the four corners ----------
// Lifted unchanged from the original deck's tally buckets. Order matters:
// index 0 is the warmest reading of God, index 3 the coldest. The verdict
// maths below depends on that ordering.
export const CORNERS = [
  { id: 'c1', label: "He's glad — He's in it with me", short: "He's glad",        corner: 'top-left' },
  { id: 'c2', label: 'Mostly fine with it',            short: 'Mostly fine',     corner: 'top-right' },
  { id: 'c3', label: 'Watching closely',               short: 'Watching closely', corner: 'bottom-left' },
  { id: 'c4', label: 'Waiting for me to mess up',      short: 'Waiting for me',  corner: 'bottom-right' },
];

export const cornerById = (id) => CORNERS.find((c) => c.id === id);
export const cornerIndex = (id) => CORNERS.findIndex((c) => c.id === id);

// ---------- scripture ({LORD} is swapped for DIVINE_NAME in config.js) ----------
export const VERSES = {
  wallA: {
    ref: 'Ecclesiastes 11:9a',
    text: 'Rejoice, young man, in your youth, and let your heart cheer you in the days of your youth. Walk in the ways of your heart, and in the sight of your eyes.',
  },
  wallB: {
    ref: 'Ecclesiastes 11:9b',
    text: 'But know that for all these things God will bring you into judgment.',
  },

  // Wall A has witnesses — enjoyment is not a one-off concession in Scripture.
  ecc97: {
    ref: 'Ecclesiastes 9:7',
    text: 'Go your way — eat your bread with joy, and drink your wine with a merry heart; for God has already accepted your works.',
    note: 'Already accepted. Past tense, before you got there.',
  },
  ecc224: {
    ref: 'Ecclesiastes 2:24',
    text: 'There is nothing better for a man than that he should eat and drink, and make his soul enjoy good in his labor. This also I saw, that it is from the hand of God.',
    note: 'The enjoyment itself is the thing handed to you.',
  },
  tim617: {
    ref: '1 Timothy 6:17',
    text: '…their hope set… on God, who richly provides us with everything to enjoy.',
    note: 'Richly. Not sparingly, not reluctantly.',
  },
  ps1611: {
    ref: 'Psalm 16:11',
    text: 'You will show me the path of life. In your presence is fullness of joy. In your right hand there are pleasures forever more.',
    note: 'The joy is located in Him — not somewhere away from Him.',
  },

  // Wall B, without softening it.
  cor510: {
    ref: '2 Corinthians 5:10',
    text: 'For we must all be revealed before the judgment seat of Christ, that each one may receive the things in the body according to what he has done, whether good or bad.',
    note: 'Say it plainly. Do not rush to the next verse.',
  },
  rom81: {
    ref: 'Romans 8:1',
    text: 'There is therefore now no condemnation to those who are in Christ Jesus.',
    note: 'Now read them in that order again. That order is the whole gospel.',
  },
  ps139: {
    ref: 'Psalm 139:1–3',
    text: '{LORD}, you have searched me, and you know me. You know my sitting down and my rising up. You perceive my thoughts from afar. You search out my path and my lying down, and are acquainted with all my ways.',
    note: 'For anyone in corner three: being watched and being known are not the same thing.',
  },

  // The close.
  ecc1110: {
    ref: 'Ecclesiastes 11:10',
    text: 'Therefore remove sorrow from your heart, and put away evil from your flesh; for youth and the dawn of life are vanity.',
  },
  ecc121: {
    ref: 'Ecclesiastes 12:1',
    text: 'Remember also your Creator in the days of your youth, before the evil days come, and the years draw near, when you will say, “I have no pleasure in them.”',
  },
  zeph317: {
    ref: 'Zephaniah 3:17',
    text: '{LORD}, your God, is among you, a mighty one who will save. He will rejoice over you with joy. He will calm you in his love. He will rejoice over you with singing.',
    note: 'This is the answer to the question you opened with. What is the look on His face? He is singing.',
  },
};

/** Swap {LORD} for whatever the leader chose in config.js. */
export function verseText(key) {
  const v = VERSES[key];
  if (!v) return '';
  return v.text.replace(/\{LORD\}/g, DIVINE_NAME);
}

// ---------- the five-second tap after Wall A ----------
export const BELONGS_OPTIONS = [
  'Yes — it belongs',
  "No — that can't be in there",
  "I've never heard it before",
];

// ---------- verse sort ----------
// Reuses the four-corner UI exactly, so it costs no new interface. The
// teaching payoff is that the room scatters these across corners and then
// has to sit with the fact that all three describe the same God.
export const VERSE_SORT = [
  { key: 'ecc97',  prompt: 'Which corner does this sound like?' },
  { key: 'ps139',  prompt: 'And this one?' },
  { key: 'cor510', prompt: 'And this one?' },
];

// ---------- stages ----------
// The projector publishes the current stage; phones render whatever view
// the stage maps to. Anything not listed shows the holding screen, which
// is the safe default: a phone should never show something the leader
// hasn't opened.
export const STAGES = {
  join: {
    mode: 'join',
    title: 'You\'re in',
  },
  hold: {
    mode: 'hold',
    title: 'Put it face down',
    body: 'Look up. We\'ll come back to your phone in a minute.',
  },
  question: {
    mode: 'hold',
    title: 'Listen to the question',
    body: 'Don\'t answer yet. Nobody answers out loud.',
  },
  corners1: {
    mode: 'vote',
    round: 'r1',
    title: 'When you\'re having a genuinely good time — what is God doing?',
    body: 'Not when you\'re doing something you\'d be ashamed of. Just a good weekend. Answer honestly — nobody in this room will ever know which one you picked.',
  },
  count1: {
    mode: 'why',
    title: 'One word',
    body: 'Why did you pick that? One word only — it goes up on the screen without your name on it.',
  },
  wallA: {
    mode: 'verse',
    verse: 'wallA',
    title: 'Wall A',
    body: 'Read it again, in your hand, slowly.',
  },
  permission: {
    mode: 'belongs',
    title: 'Honest question',
    body: 'Does that sound like something that belongs in the Bible?',
  },
  wallB: {
    mode: 'reveal',
    verse: 'wallB',
    title: 'Wall B',
    body: 'Same verse. Same sentence. Same author. He didn\'t put these in two different chapters.',
  },
  witnesses: {
    mode: 'verselist',
    verses: ['ecc97', 'ecc224', 'tim617', 'ps1611'],
    title: 'Wall A has witnesses',
    body: 'Wall A wasn\'t a slip of the pen.',
  },
  honest: {
    mode: 'verselist',
    verses: ['cor510', 'rom81', 'ps139'],
    title: 'Wall B, honestly',
    body: 'We\'re not going to soften this one either.',
  },
  versesort: {
    mode: 'versesort',
    title: 'Which corner does this verse sound like?',
    body: 'Same four options as before. Go with your gut.',
  },
  confront: {
    mode: 'confront',
    title: 'Before you answer again',
    body: 'You\'ve now heard both halves.',
  },
  corners2: {
    mode: 'vote',
    round: 'r2',
    title: 'Same question. Where are you now?',
    body: 'You can leave it exactly where it was. Plenty of people will.',
  },
  migration: {
    mode: 'hold',
    title: 'Watch the screen',
    body: 'That\'s the room changing its mind. Or not.',
  },
  questions: {
    mode: 'text',
    field: 'q3',
    title: 'What if the judgment part isn\'t a threat?',
    body: 'What if it\'s the reason the enjoyment is safe? A sentence or two, if you want to — this one is for the leader, not the screen.',
  },
  lands: {
    mode: 'hold',
    title: 'Look up',
    body: 'This next bit is the whole point of the session.',
  },
  close: {
    mode: 'off',
    title: 'Phones away',
    body: 'Pen and paper for the last five minutes. Thanks for being honest this morning.',
  },
};

// ---------- verdict wording ----------
// The three original strings, kept word for word — they're well written and
// they carry the leader through the most important thirty seconds of the session.
export function verdict(r1Counts, r2Counts) {
  const a = r1Counts.reduce((x, y) => x + y, 0);
  const b = r2Counts.reduce((x, y) => x + y, 0);
  if (a === 0 || b === 0) return '';

  const shift = (r2Counts[0] + r2Counts[1]) / b - (r1Counts[0] + r1Counts[1]) / a;
  const pct = Math.round(Math.abs(shift) * 100);

  if (pct < 5) {
    return 'The room barely moved. Ask them why hearing the hard half changed nothing.';
  }
  if (shift > 0) {
    return `${pct}% of the room moved toward “He’s glad” — after hearing the judgment half. Ask the movers what changed.`;
  }
  return `${pct}% of the room moved the other way. Worth naming out loud: the second half landed as a threat. That’s the thing to talk about.`;
}

/**
 * Per-person movement — the thing a physical room can never show you.
 * Because each phone keeps a stable anonymous id, we can say exactly how
 * many people moved and which way, without knowing who any of them are.
 */
export function movement(r1ById, r2ById) {
  let moved = 0, warmer = 0, colder = 0, stayed = 0;

  for (const [id, first] of Object.entries(r1ById)) {
    const second = r2ById[id];
    if (!second) continue;              // didn't vote the second time
    const from = cornerIndex(first);
    const to = cornerIndex(second);
    if (from < 0 || to < 0) continue;
    if (from === to) { stayed++; continue; }
    moved++;
    if (to < from) warmer++; else colder++;
  }

  return { moved, warmer, colder, stayed, total: moved + stayed };
}
