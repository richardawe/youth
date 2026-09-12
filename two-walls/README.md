# Two Walls — Live

An interactive youth session on **Ecclesiastes 11:9**, where the room answers on their phones
instead of walking across the floor.

It's the same session as the original *Two Walls* deck: ask what God's face looks like when
you're having a good time, get everyone to commit to an answer, reveal Wall A (11:9a), reveal
Wall B (11:9b), then ask the same question again and see who moved. The difference is that the
commitment happens on a phone, anonymously, and the projector draws the room for you.

Three pages, no build step, no npm install, no framework.

**The recommended way to run it is on the laptop that drives the projector, with no internet
at all.** One command starts a server that hands out the pages and carries the answers over
the room's own wifi. Nothing leaves the building, there are no accounts or quotas, answers
land in about a millisecond, and a church hall's terrible internet stops being your problem.

| Page | Who opens it | What it is |
|---|---|---|
| `screen.html` | you, on the projector | the deck, and the live room map. **This drives the session.** |
| `join.html` | every student, on their phone | one question at a time, and nothing else |
| `leader.html` | you, on your own phone | optional remote, plus the hand tally if anything goes wrong |

Students never type an address or a code — they scan the QR on the projector, and it is built
from the laptop's own wifi address so it works even if you opened the page on `localhost`.

There is also a Google Sheet backend for running this when people *aren't* in one room; see
[Running it over the internet](#running-it-over-the-internet). The pages pick the right one
automatically from where they were opened — there is no setting to switch.

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

Add `?newroom=1` to the projector URL to start a brand new room. Otherwise the room code is
sticky, so if the browser closes or crashes mid-session, reopening the page comes back on the
same room and every phone reconnects on its own.

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

## Running the session (the recommended way)

You need Node **or** Python on the projector laptop — whichever it already has. Nothing to
install beyond that.

### 1. Get the files onto the laptop

```bash
git clone https://github.com/richardawe/youth.git
cd youth
```

(Or download the repo as a zip and unpack it. It never needs to be online again after this.)

### 2. Put the laptop on the same wifi as the students

This is the only requirement. It does **not** need internet — just a network the phones are
also on. A phone hotspot works fine if the building's wifi doesn't.

### 3. Start the server

```bash
node two-walls/server/serve.mjs
```

or, if the laptop has Python instead:

```bash
python3 two-walls/server/serve.py
```

It prints exactly what to open:

```
──────────────────────────────────────────────────────────
  TWO WALLS — LIVE   (local, no internet needed)
──────────────────────────────────────────────────────────

  Open this on the PROJECTOR:
     http://192.168.1.44:8080/two-walls/screen.html

  Students just scan the QR code on that screen.
  Your remote, on your own phone:
     http://192.168.1.44:8080/two-walls/leader.html
```

### 4. Open the projector page and leave it on the join screen

Students scan the QR. That's the whole instruction — no code to read out, no address to type.

If the laptop isn't on a wifi network, the join screen says so in as many words rather than
showing a QR code nobody can reach.

**Port already in use?** `PORT=8081 node two-walls/server/serve.mjs`

### Notes on the local server

- **Answers are saved to disk** (`server/session-data.json`) after every write, so if the
  server or the laptop restarts mid-session, the room comes back intact. That file is
  gitignored — it's a room's data, not code.
- **It is fast.** A request costs about a millisecond, against roughly two seconds for the
  Sheet, so the projector polls at 400ms and the room map moves as people tap.
- **Nothing leaves the room.** No Google, no accounts, no quotas, no analytics.
- **Stop it with Ctrl+C** when you're done. Clear the room from `leader.html` first if you
  want the next group to start clean, or just delete `server/session-data.json`.

---

## Running it over the internet

Only needed if the group *isn't* in one room. Published pages on GitHub Pages talk to a Google
Sheet through Apps Script. The pages detect this automatically — served from the internet they
use the Sheet, served from the laptop they use the laptop.

Be aware of the trade: Apps Script spends about two seconds on every request regardless of how
little it does, so polling lands near a four-second cadence and the Wall B reveal is "within a
few seconds" rather than simultaneous. It also means every phone is hitting a rate-limited
service. Fine for a handful of people; the local server is better for a room.

### 1. Create the Google Sheet

1. Go to <https://sheets.google.com> and make a new blank spreadsheet.
   Use a **fresh, separate** sheet — don't reuse the AI-talk one at the repo root. Both scripts
   create a tab called `responses` with different columns, and sharing one would scramble that
   talk's data.
2. **Extensions → Apps Script.** Delete the placeholder and paste in the whole of
   `two-walls/apps-script/Code.gs`. Save.

### 2. Deploy it

1. **Deploy → New deployment** → type **Web app**.
2. **Execute as: Me**, **Who has access: Anyone**. ("Anyone with a Google account" will show
   students an auth page instead of the session.)
3. **Deploy**, authorise it, and copy the **Web app URL** (`…/exec`).

### 3. Paste it in

Set `CLOUD_SCRIPT_URL` in `two-walls/js/config.js`, then push. Your pages will be at
`https://<you>.github.io/<repo>/two-walls/screen.html`.

Check it worked by opening `…/exec?ping=1` — it should return
`{"ok":true,"sheet":"responses","rows":0,…}`. If it returns a list instead, the deployment is
running an older copy of `Code.gs`: paste the current one in, then
**Deploy → Manage deployments → edit → Version: New version**, which keeps the same URL.

Note that the `/exec` URL in a public repo is readable by anyone who finds it. The data is
anonymous aliases and corner picks, so the exposure is small, but it's worth knowing.

---

## During the session

- Open the projector page **before they arrive** and leave it on the join screen. Watching
  their own alias appear on the wall is the hook, and it gets everyone connected before you
  need them. You don't need to read anything out — they scan the QR.
- Drive from the projector with the arrow keys, or open `leader.html` on your phone if you'd
  rather stand at the front. The remote asks the projector to move rather than writing the
  state itself, so the two can't fight over who's in charge.
- Press `R` first, at home, to rehearse: it invents twenty students so you can walk the whole
  session alone, migration and all. **Turn it off before the real thing** — it says
  "Rehearsal mode" in the top bar the whole time it's on.
- Clear the room from `leader.html` after everyone's gone, once you've read the answers to
  question three.

### If something goes wrong anyway

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
- **Latency:** about a millisecond on the local server, so the room map keeps up with taps.
  Over the internet it's roughly two seconds per request — Apps Script's own overhead plus a
  mandatory redirect — which puts the poll cadence near four seconds. Another reason to run it
  on the laptop.
- **Fonts and everything else are vendored**, so the pages have no external requests at all.
  With no internet, a `<link>` to Google Fonts doesn't fail instantly — it can block first
  paint until DNS gives up, which on a projector is a blank screen in front of a room.

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

---

## Fonts

`fonts/` carries Archivo and Newsreader as variable woff2, latin and latin-ext subsets, about
400KB in total. Both are SIL Open Font License 1.1, which permits redistribution — the full
licences are in `fonts/archivo-OFL.txt` and `fonts/newsreader-OFL.txt`.

They're served locally rather than from Google Fonts so the session has no external
dependencies whatsoever, which is the whole point of running it on the laptop.

---

## What has actually been tested

- **37 end-to-end checks in a real browser against the real local server** — five phones
  joining, both voting rounds, the synchronised Wall B reveal across every phone, the private
  confrontation showing each student their own prior answer, the migration and verdict maths,
  the leader remote driving the projector, and the offline hand tally. Zero page errors.
- **The QR opened on `localhost` rewrites itself to the LAN address** and decodes back to the
  right join URL through a real QR decoder — the case that would otherwise hand every student
  a code pointing at their own phone.
- **A killed server resumes the room from disk** with answers intact.
- **Path traversal is refused** by both servers.
- **The Apps Script backend** was verified separately against a live deployment: write, read,
  room filter, upsert-not-duplicate, the control record surviving as a real object, cache
  invalidation making a reveal visible immediately, and `clearRoom`.
