# Two Walls — Live

An interactive youth session on **Ecclesiastes 11:9**, where the room answers on their phones
instead of walking across the floor.

It's the same session as the original *Two Walls* deck: ask what God's face looks like when
you're having a good time, get everyone to commit to an answer, reveal Wall A (11:9a), reveal
Wall B (11:9b), then ask the same question again and see who moved. The difference is that the
commitment happens on a phone, anonymously, and the projector draws the room for you.

Three pages, no build step, no npm install, no framework — static files plus one small Google
Sheet, exactly like the talk at the root of this repo.

| Page | Who opens it | What it is |
|---|---|---|
| `screen.html` | you, on the projector | the deck, and the live room map. **This drives the session.** |
| `join.html` | every student, on their phone | one question at a time, and nothing else |
| `leader.html` | you, on your own phone | optional remote, plus the hand tally for when the wifi dies |

**It works with zero setup.** Open `screen.html` and it runs in offline mode. You won't get
phones talking to the projector that way — for that you need the five-minute Sheet setup below —
but nothing is broken, and the hand tally in `leader.html` runs the session the old way.

---

## The trade this makes, and why

The original deck's leader notes are blunt about why the walking matters:

> "Changing your mind means walking across a room in front of everyone. **That cost is the
> point** — notice who moves, and notice who won't."

Phones delete that cost. So this version doesn't pretend otherwise — it spends the cost on two
things a room physically cannot do:

1. **An honest round one.** When students walk, they cluster with their friends and the first
   answer is half social. Anonymous taps get a truer baseline, which is what makes the
   before/after comparison worth anything at all.
2. **Per-person movement, still anonymous.** Each phone keeps a stable anonymous id, so the
   system knows *that* someone went from "waiting for me to mess up" to "He's glad" without ever
   knowing *who*. The projector animates every student's token from where they started to where
   they ended up. That's **The Migration**, and it's the moment the session turns.

And one beat that has no equivalent in a room: right before round two, every phone privately
shows that student **their own first answer** and asks whether it's still true. Twenty seconds of
silence, twenty-five different private conversations. Don't talk over it.

---

## Run of show

The projector is the driver — arrow keys, like the paper deck. Each slide tells the phones what
to show; they can't run ahead.

| Slide | Screen | Phone |
|---|---|---|
| 1 | **Join** — QR, room code, aliases landing live | pick up an alias, find it on the wall |
| 2–4 | Title · Part I · the question, asked aloud | *"Put it face down. Look up."* |
| 5 | **Round one** — tokens land, counts hidden | four corners, tap, lock in |
| 6 | **Where the room landed** — counts revealed | optional one-word *why* → live on screen |
| 7–9 | Part II · **Wall A** · "sounds like a permission slip" | verse in hand; one quick tap |
| 10–11 | Part III · **Wall B** — you uncover it once | tears away on every phone at the same instant |
| 12–13 | **Wall A has witnesses** · **Wall B, honestly** | the verses, in hand |
| 14 | **Verse sort** — which corner does this verse sound like? | same four corners, no new interface |
| 15 | **Before you answer again** | *privately:* "you said ___ — is it still true?" |
| 16–17 | **Round two** → **The Migration** + verdict | tap, then phones down |
| 18–19 | The three questions · where it lands | question three, in writing, if they'd rather |
| 20 | **Close** — Ecc 11:10→12:1, Zephaniah 3:17, room portrait | *phones away.* Paper and envelopes. |

The original's Part IV activities (bucket-list flip, dominoes, freeze-frame) are **not** in this
version — it runs straight from "where it lands" into the close. If you want them back, they're
in the original deck and they drop in fine before slide 20.

**Timing, 45 minutes:** join and opening question 8 · round one and the whys 6 · Wall A 5 ·
Wall B 5 · the other verses 5 · round two, migration and discussion 18 · letters and close 5.
If you're running long, cut the verse sort. Never cut the discussion — it *is* the lesson.

### Keys on the projector

`↑` `↓` move · `N` leader notes · `M` replay the migration · `R` rehearsal mode.

---

## Anonymous identity

Every phone is given a two-word alias — *Amber Kestrel, Quiet Lantern, North Ember* — plus a
colour and a shape. It's stored on the phone, so a reload or a locked screen keeps it for the whole session.

The property that matters is **self-recognisable, other-anonymous**: a student finds their own
token on the projector instantly and can't identify anybody else's. No names are collected
anywhere in this app, and you never see one.

**That costs you something, so it's handed back deliberately.** The original notes say: *"If a
student stands at 'waiting for me to mess up' and clearly isn't joking… Note who it was. Find
them afterwards."* You can't do that here — you genuinely cannot see who picked what. Instead,
every phone carries a quiet **"I'd actually like to talk to someone"** button. If it lights up,
your remote shows the alias and nothing else. Say it out loud once, kindly, and let them come to
you. Student-initiated, never surveillance.

**Groups under about eight:** with six students the aliases stop being anonymous, because people
can work out who's who. Set `ENABLE_WHY = false` in `js/config.js` so nobody's one-word answer
can be traced across the room.

---

## Setup for live sync

### 1. Create the Google Sheet

1. Go to <https://sheets.google.com> and make a new blank spreadsheet. Name it anything.
2. **Extensions → Apps Script.** A code editor opens in a new tab.
3. Delete the placeholder code and paste in the whole of `two-walls/apps-script/Code.gs`.
4. Save.

### 2. Deploy it

1. **Deploy → New deployment.** Click the gear next to "Select type" and choose **Web app**.
2. Set **Execute as: Me** and **Who has access: Anyone**.
3. **Deploy.** Authorise it when Google asks — it's your own script, on your own account,
   touching only your own sheet. Click through the "hasn't verified this app" warning.
4. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfycb.../exec`.

### 3. Paste it in

Open `two-walls/js/config.js` and set:

```js
export const SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec";
```

That's the only line you have to change. This is a **separate** deployment from the AI-talk deck
at the root of this repo — don't reuse that one, the sheet layout is different.

### 4. Publish

Push to GitHub and turn on **Settings → Pages** (source: your default branch, root). Your pages
will be at `https://yourname.github.io/your-repo/two-walls/screen.html` and `…/join.html`.
Students never need the URL — they scan the QR on the join screen.

---

## During the session

- Open `screen.html` on the projector **before they arrive** and leave it on the join screen.
  Watching their own alias appear on the wall is the hook, and it gets everyone connected before
  you need them. Read the four-letter code out loud once.
- Drive from the projector with the arrow keys, or open `leader.html` on your phone if you'd
  rather stand at the front.
- Press `R` first, at home, to rehearse: it invents twenty students so you can walk the whole
  session alone, migration and all. **Turn it off before the real thing** — it says
  "Rehearsal mode" in the top bar the whole time it's on.
- Clear the room from `leader.html` after everyone's gone, once you've read the answers to
  question three.

### If the wifi dies

Open `leader.html` and use the **hand tally** — the same plus-and-minus counters as the paper
version, with round one showing as a ghost bar behind round two. Say it out loud rather than
fighting it: "phones down, I'll count hands" costs you thirty seconds and nothing else. The
projector shows "Offline — use the hand tally" in the top bar so you're never guessing.

---

## Scripture

Texts are the **World English Bible** (public domain, and what the original deck cites).

Wall A and Wall B are Ecclesiastes 11:9a and 11:9b. The session then gives each wall its own
witnesses, because in the original one verse carries the entire weight:

- **Wall A has witnesses** — Ecclesiastes 9:7 ("God has already accepted your works" — the line
  that dismantles the coldest corner), Ecclesiastes 2:24, 1 Timothy 6:17, Psalm 16:11.
- **Wall B, honestly** — 2 Corinthians 5:10 and Romans 8:1, read in that order and without a
  gap, plus Psalm 139:1–3 for anyone sitting in "watching closely".
- **The close** — Ecclesiastes 11:10 → 12:1, then **Zephaniah 3:17**. That last one is the
  answer to the question you opened with: what is the look on His face? He's singing.
  Stop there.

WEB renders the divine name as "Yahweh", which reads oddly to most youth groups, so
`DIVINE_NAME` in `js/config.js` prints "The LORD" by default. Set it to `"Yahweh"` to keep WEB's
own wording.

---

## Customising

- **Slide prose** lives directly in `screen.html` — one `<section class="slide">` each, same as
  the original deck. Edit it like HTML.
- **The four corners, the verses, and the copy each phone shows** live in `js/lesson.js`. Change
  a corner label once there and it updates on the projector, on every phone, and in the tally.
- **Colours and type** are the CSS variables at the top of `css/screen.css`.
- Each slide's `data-stage` attribute is what the phones follow. If you add a slide, give it a
  stage that exists in `STAGES` in `js/lesson.js`, or leave it off and phones show the holding
  screen — which is the safe default.

## Known limits

- **Someone could vote twice** by opening the page in a second tab. There's no login, and adding
  one would cost the anonymity that makes the honest answers possible. Your remote shows the join
  count next to the vote count, so a mismatch is visible. In practice it hasn't been worth
  worrying about.
- **Latency is about two seconds** — the phones and projector poll rather than hold a socket.
  That's deliberate: polling survives flaky church wifi far better than a dropped connection.
- **Apps Script quota** is generous for this. A room of a hundred students polling every 1.8
  seconds is well inside the free limits.

---

## Verifying the QR encoder

`js/vendor/qrcode.js` is a small QR encoder written for this project rather than pulled from a
CDN, because the projector laptop is exactly the machine whose network will be unreliable, and a
join screen with no QR code on it is a dead session.

It was verified two ways: every output decodes back to the exact input string through the
`zxing-cpp` decoder for versions 1 through 10, and each matrix is byte-identical to the `segno`
reference encoder when both are pinned to the same mask. It picks its own mask by the spec's
penalty rules, so the chosen mask sometimes differs from segno's — all eight are valid and
scanners handle any of them.

To re-check it after an edit:

```bash
pip install segno zxing-cpp pillow
# then encode a few strings with the module and compare/decode —
# see the commit that introduced this file for the throwaway harness.
```
