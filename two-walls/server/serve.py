#!/usr/bin/env python3
"""
TWO WALLS - LIVE : the local session server (Python version)

    python3 two-walls/server/serve.py

Identical to serve.mjs - use whichever your laptop already has. Run it on
the machine driving the projector; it serves the site and the live-sync
API from one port, over the room's own wifi, with no internet involved.

Speaks exactly the same API as apps-script/Code.gs, so the browser code is
the same either way. Standard library only, Python 3.8+.
"""

import json
import os
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent            # serve the whole repo
PORT = int(os.environ.get("PORT", "8080"))

# Answers live in memory and are mirrored to disk after every write, so a
# restart mid-session keeps the room intact.
STORE = HERE / "session-data.json"
_lock = threading.Lock()

try:
    rows = json.loads(STORE.read_text())
    if not isinstance(rows, list):
        rows = []
    if rows:
        print(f"↻ resumed {len(rows)} saved answer(s) from {STORE.name}")
except Exception:
    rows = []


def persist():
    try:
        STORE.write_text(json.dumps(rows))
    except OSError as err:
        print(f"could not save session data: {err}")


TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
}


def lan_ip():
    """The address phones can actually reach. Asking the OS which interface
    it would use to reach the internet is far more reliable than guessing
    from the hostname, and it works with no internet present."""
    candidates = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.2)
        s.connect(("10.255.255.255", 1))     # no packets are actually sent
        candidates.append(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            addr = info[4][0]
            if not addr.startswith("127."):
                candidates.append(addr)
    except Exception:
        pass

    for pattern in ("192.168.", "10.", "172."):
        for addr in candidates:
            if addr.startswith(pattern):
                return addr
    return candidates[0] if candidates else None


def lan_base():
    ip = lan_ip()
    return f"http://{ip}:{PORT}" if ip else None


def api_get(params):
    if "ping" in params:
        return {
            "ok": True,
            "backend": "local",
            "rows": len(rows),
            "lan": lan_base(),
            "time": datetime.now(timezone.utc).isoformat(),
        }
    wanted = (params.get("room", [""])[0] or "").upper()
    return [r for r in rows if not wanted or str(r.get("roomCode", "")).upper() == wanted]


def api_post(payload):
    global rows
    if payload.get("action") == "clearRoom":
        room = str(payload.get("roomCode") or "").upper()
        before = len(rows)
        rows = [r for r in rows if room and str(r.get("roomCode", "")).upper() != room]
        persist()
        return {"ok": True, "cleared": before - len(rows)}

    room = str(payload.get("roomCode") or "").upper()
    row = {
        "roomCode": room,
        "sessionId": payload.get("sessionId"),
        "key": payload.get("key"),
        "value": payload.get("value"),
        "alias": payload.get("alias") or "",
        "color": payload.get("color") or "",
        "sigil": payload.get("sigil") or "",
        "ts": payload.get("ts") or int(datetime.now().timestamp() * 1000),
    }

    # Upsert on (room, session, key) - changing your mind replaces your
    # answer rather than voting twice.
    for i, r in enumerate(rows):
        if (str(r.get("roomCode", "")).upper() == room
                and r.get("sessionId") == payload.get("sessionId")
                and r.get("key") == payload.get("key")):
            rows[i] = row
            break
    else:
        rows.append(row)
    persist()
    return {"ok": True}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass                                  # a quiet console during a session

    def _json(self, obj, store=True):
        body = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        if not store:
            self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api":
            with _lock:
                out = api_get(parse_qs(parsed.query))
            return self._json(out, store=False)

        rel = unquote(parsed.path)
        if rel == "/":
            rel = "/two-walls/screen.html"
        full = (REPO_ROOT / rel.lstrip("/")).resolve()

        # Never serve outside the repo, whatever the URL claims.
        if not str(full).startswith(str(REPO_ROOT)) or not full.is_file():
            body = b"not found"
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return self.wfile.write(body)

        data = full.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", TYPES.get(full.suffix.lower(), "application/octet-stream"))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if urlparse(self.path).path != "/api":
            self.send_response(405)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(min(length, 1_000_000))
        try:
            with _lock:
                out = api_post(json.loads(raw))
        except Exception as err:
            out = {"ok": False, "error": str(err)}
        self._json(out)


def main():
    base = lan_base()
    line = "─" * 58
    print(f"\n{line}")
    print("  TWO WALLS — LIVE   (local, no internet needed)")
    print(line)
    if base:
        print("\n  Open this on the PROJECTOR:")
        print(f"     {base}/two-walls/screen.html\n")
        print("  Students just scan the QR code on that screen.")
        print("  Your remote, on your own phone:")
        print(f"     {base}/two-walls/leader.html\n")
    else:
        print("\n  No wifi network found. Phones will not be able to reach")
        print("  this laptop until it joins the same wifi as the students.")
        print(f"  On this machine only: http://localhost:{PORT}/two-walls/screen.html\n")
    print(f"  Answers are saved to server/{STORE.name}")
    print("  Stop the server with Ctrl+C when you are done.")
    print(f"{line}\n")

    try:
        ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
    except OSError as err:
        print(f"\nCould not start on port {PORT}: {err}")
        print(f"Try:  PORT=8081 python3 two-walls/server/serve.py\n")
        raise SystemExit(1)
    except KeyboardInterrupt:
        print("\nStopped. Answers are saved.\n")


if __name__ == "__main__":
    main()
