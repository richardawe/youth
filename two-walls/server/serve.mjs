#!/usr/bin/env node
// ============================================================
// TWO WALLS — LIVE : the local session server
//
//   node two-walls/server/serve.mjs
//
// Run this on the laptop that drives the projector. It serves the site
// AND the live-sync API from one port, so the whole session runs on the
// room's wifi and never touches the internet. No accounts, no quotas, no
// two-second round trips to a spreadsheet — and nothing about the room
// leaves the building.
//
// It speaks exactly the same API as apps-script/Code.gs, so the client
// code is identical either way: phones POST an answer and poll for rows.
// The only difference is that this one answers in about a millisecond.
//
// Zero dependencies. Node 18 or newer.
// ============================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');     // serve the whole repo
const PORT = Number(process.env.PORT || 8080);

// Answers live in memory, and are mirrored to disk after every write. A
// server restart mid-session therefore keeps the room intact — the same
// reason the room code is sticky in the browser.
const STORE = path.join(HERE, 'session-data.json');

let rows = [];
try {
  rows = JSON.parse(fs.readFileSync(STORE, 'utf8'));
  if (!Array.isArray(rows)) rows = [];
  if (rows.length) console.log(`↻ resumed ${rows.length} saved answer(s) from ${path.basename(STORE)}`);
} catch { rows = []; }

let saveTimer = null;
function persist() {
  // Debounced: a burst of 25 phones voting shouldn't mean 25 disk writes.
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(STORE, JSON.stringify(rows), (err) => {
      if (err) console.warn('could not save session data:', err.message);
    });
  }, 250);
}

// ---------- the API, identical in shape to the Apps Script ----------
function apiGet(params) {
  if (params.get('ping') !== null) {
    return {
      ok: true,
      backend: 'local',
      rows: rows.length,
      lan: lanBase(),                 // so the projector's QR is scannable
      time: new Date().toISOString(),
    };
  }
  const wanted = (params.get('room') || '').toUpperCase();
  return rows.filter((r) => !wanted || String(r.roomCode).toUpperCase() === wanted);
}

function apiPost(payload) {
  if (payload && payload.action === 'clearRoom') {
    const room = String(payload.roomCode || '').toUpperCase();
    const before = rows.length;
    rows = rows.filter((r) => !room || String(r.roomCode).toUpperCase() !== room);
    persist();
    return { ok: true, cleared: before - rows.length };
  }

  const room = String(payload.roomCode || '').toUpperCase();
  const row = {
    roomCode: room,
    sessionId: payload.sessionId,
    key: payload.key,
    value: payload.value === undefined ? null : payload.value,
    alias: payload.alias || '',
    color: payload.color || '',
    sigil: payload.sigil || '',
    ts: payload.ts || Date.now(),
  };

  // Upsert on (room, session, key): changing your mind replaces your
  // answer instead of voting twice.
  const i = rows.findIndex(
    (r) => String(r.roomCode).toUpperCase() === room &&
           r.sessionId === payload.sessionId &&
           r.key === payload.key,
  );
  if (i > -1) rows[i] = row; else rows.push(row);
  persist();
  return { ok: true };
}

// ---------- static files ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function serveStatic(urlPath, res) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/') rel = '/two-walls/screen.html';          // sensible default
  const full = path.join(REPO_ROOT, rel);

  // Never serve outside the repo, whatever the URL claims.
  if (!full.startsWith(REPO_ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',      // always pick up an edit on reload
    });
    res.end(data);
  });
}

// ---------- LAN address, so phones have something to reach ----------
function lanIp() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const list of Object.values(nets)) {
    for (const net of list || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      candidates.push(net.address);
    }
  }
  // Prefer ordinary home/church wifi ranges over virtual adapters.
  const preferred = candidates.find((a) => /^192\.168\./.test(a))
    || candidates.find((a) => /^10\./.test(a))
    || candidates.find((a) => /^172\.(1[6-9]|2\d|3[01])\./.test(a));
  return preferred || candidates[0] || null;
}

const lanBase = () => {
  const ip = lanIp();
  return ip ? `http://${ip}:${PORT}` : null;
};

// ---------- server ----------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api') {
    if (req.method === 'GET') {
      const out = apiGet(url.searchParams);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(out));
    }
    if (req.method === 'POST') {
      let raw = '';
      req.on('data', (c) => {
        raw += c;
        if (raw.length > 1e6) req.destroy();      // nobody needs to post a megabyte
      });
      req.on('end', () => {
        let out;
        try { out = apiPost(JSON.parse(raw)); }
        catch (err) { out = { ok: false, error: String(err.message) }; }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(out));
      });
      return;
    }
    res.writeHead(405).end('{}');
    return;
  }

  if (req.method !== 'GET') { res.writeHead(405).end('no'); return; }
  serveStatic(url.pathname, res);
});

server.listen(PORT, '0.0.0.0', () => {
  const base = lanBase();
  const line = '─'.repeat(58);
  console.log(`\n${line}`);
  console.log('  TWO WALLS — LIVE   (local, no internet needed)');
  console.log(line);
  if (base) {
    console.log('\n  Open this on the PROJECTOR:');
    console.log(`     ${base}/two-walls/screen.html\n`);
    console.log('  Students just scan the QR code on that screen.');
    console.log('  Your remote, on your own phone:');
    console.log(`     ${base}/two-walls/leader.html\n`);
  } else {
    console.log('\n  No wifi network found. Phones will not be able to reach');
    console.log('  this laptop until it joins the same wifi as the students.');
    console.log(`  On this machine only: http://localhost:${PORT}/two-walls/screen.html\n`);
  }
  console.log(`  Answers are saved to server/${path.basename(STORE)}`);
  console.log('  Stop the server with Ctrl+C when you are done.');
  console.log(`${line}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use. Either the server is already`);
    console.error(`running, or something else has the port. Try:\n`);
    console.error(`   PORT=8081 node two-walls/server/serve.mjs\n`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});
