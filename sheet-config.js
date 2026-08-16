// ============================================================
// BACKEND CONFIG — replace SCRIPT_URL below with your own.
// See README.md for exactly how to get it (about 5 minutes,
// just a Google Sheet + a small script — no Firebase, no
// GitHub Actions, nothing else to install).
// This file is loaded by both index.html (the talk) and
// dashboard.html (your live results view), so you only need
// to edit it in one place.
// ============================================================

export const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby5D9hxdrYT7T9YHsxxgFSSD_7LxmiJULdqYakpmKr6F7j1u-CQOSDc7sB1Mm7ZwD5Y/exec";

// A simple shared passcode so casual visitors can't stumble onto
// your live results by guessing the dashboard.html URL. This is a
// convenience lock, not real security — anyone who reads this file
// can see it. Change it to anything you like, or ignore it entirely
// since you said hard security isn't a concern here.
export const DASHBOARD_PASSCODE = "letterpress";

// How often the dashboard checks the sheet for new responses (ms).
export const POLL_INTERVAL_MS = 4000;

// Detects whether you've actually filled in SCRIPT_URL above.
// Until you do, the presentation still works — responses are just
// saved to each visitor's own browser instead of syncing live.
export function isBackendConfigured() {
  return SCRIPT_URL && SCRIPT_URL !== "YOUR_APPS_SCRIPT_WEB_APP_URL";
}
