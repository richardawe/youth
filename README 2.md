# AI, Faith & the Future — Interactive Talk

A self-contained HTML presentation with three built-in audience surveys (start, mid-talk x2, end).
Responses are stored in a Google Sheet you own, and a private dashboard page shows them live
while you present. No Firebase, no GitHub Actions, no build step — just static files plus one
small Google Sheet.

- `index.html` — the presentation attendees view (share this link)
- `dashboard.html` — your private live-results view (do **not** share this link publicly)
- `css/`, `js/` — styles and logic
- `js/sheet-config.js` — the one file you edit to turn on live sync
- `apps-script/Code.gs` — the small backend script you paste into Google Sheets

**It works with zero setup**, right out of the box — responses are just saved to each visitor's
own browser instead of syncing to you. To actually *see* the room's answers live, do the
5-minute setup below.

---

## 1. Create the Google Sheet

1. Go to <https://sheets.google.com> and create a new blank spreadsheet.
   Name it anything — e.g. "AI Faith Talk — Responses."
2. In the menu, click **Extensions → Apps Script**. A new tab opens with a code editor.
3. Delete whatever placeholder code is in `Code.gs`, and paste in the entire contents of
   this project's `apps-script/Code.gs` file.
4. Click the **Save** icon (or Ctrl/Cmd+S).

## 2. Deploy it as a web app

1. Still in the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**. The first time, Google will ask you to authorize the script —
   click through the "Google hasn't verified this app" warning (it's your own script,
   running on your own account, only touching your own sheet).
5. Copy the **Web app URL** it gives you — it looks like:
   `https://script.google.com/macros/s/AKfycb.../exec`

## 3. Paste it into this project

Open `js/sheet-config.js` and replace the placeholder with your URL:

```js
export const SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec";
```

Optionally change `DASHBOARD_PASSCODE` in the same file to anything you like — it just keeps
casual visitors from stumbling onto `dashboard.html` by guessing the URL. You mentioned hard
security isn't a concern here, so the default is fine to leave as-is too, or you can delete the
gate entirely (see "Removing the passcode gate" below).

## 4. Deploy to GitHub Pages

1. Create a new GitHub repository and push all the files in this folder to it (keep the
   folder structure — `index.html` at the root, `css/` and `js/` as subfolders; the
   `apps-script/` folder is just a reference copy, GitHub Pages ignores it).
2. In the repo, go to **Settings → Pages**, set **Source** to your default branch, root folder.
3. GitHub will give you a URL like `https://yourname.github.io/your-repo/` — that's the link
   you share with your audience. Your private dashboard will be at
   `https://yourname.github.io/your-repo/dashboard.html`.

## 5. During the talk

- Share the `index.html` link with your audience (a QR code works well — generate one free at
  qr-code-generator.com pointing at your GitHub Pages URL).
- Open `dashboard.html` yourself, enter your passcode, and watch responses roll in as people
  move through the pre-survey, the two mid-talk polls, and the closing survey. It checks the
  sheet for updates every few seconds — adjust `POLL_INTERVAL_MS` in `sheet-config.js` if you
  want it faster or slower.
- Attendees can revisit a survey they already answered and change their response — it
  overwrites their previous row in the sheet rather than adding a duplicate.
- Every response also lands as a plain row in your Google Sheet, so you can open it directly,
  sort, filter, or export it after the talk without touching the dashboard at all.

## Removing the passcode gate (optional)

If you'd rather `dashboard.html` open with no prompt at all, delete this block near the top of
`dashboard.html`:

```html
<div id="gate"> ... </div>
```

and remove the gate-related lines at the top of `js/dashboard.js` (everything under
`// ---------- passcode gate ----------`).

## Customizing the content

- All slide text lives directly in `index.html` — each `<section class="slide">` is one slide.
- Survey questions live in the matching `<form class="survey-form" data-survey-id="...">`
  blocks in `index.html`, **and** must be mirrored in the `SCHEMA` object at the top of
  `js/dashboard.js` so the dashboard knows how to summarize them. If you add or change a
  question, update both places.
- Colors, fonts, and spacing all come from the CSS variables at the top of `css/style.css`.

## Notes

- No build step, no npm install, no GitHub Actions — everything runs directly from static
  files, which is exactly what GitHub Pages needs.
- A single Apps Script web app comfortably handles a live talk of hundreds of attendees;
  Google's quota for this kind of light use is generous.
- If you'd rather not stand up the Sheet at all, the deck still works as a purely local
  experience for each visitor — you'd just lose the "see everyone's answers live" feature.
