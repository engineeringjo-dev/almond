#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stand-alone mock of the four Almond BFF till endpoints — stdlib only.

    python3 almond_bff_mock.py [--port 8898] [--key mock-pos-key]

Then, in Odoo: Settings -> Point of Sale -> Almond Loyalty
    API URL  = http://127.0.0.1:8898
    POS key  = mock-pos-key

It mimics the REAL server's behaviour where it matters for the till
(``bff/src/routes/pos.ts``, ``bff/src/pos/token.ts``):

* ``x-pos-key`` checked, fail closed -> 401 ``{"error":"unauthorized","message":"invalid pos key"}``
* member QR tokens are SINGLE-USE and expire after 60 s -> 409 ``pos_token_replay`` / 401 expired
* ``/earn`` is idempotent on ``posOrderRef``; same ref + different ticket/amount -> 409
* ``/redemption/settle`` settles ONCE; any other attempt -> 404 (one answer for all)
* a ``redeem`` scan carries the live redemption; only a ``redeem`` QR can settle by token

Mock-only control endpoints (no key needed; NEVER exist on the real BFF):

    POST /__mock/token   {"memberId":"m1","mode":"pay|earn|corporate|redeem",
                          "percentOff":10,           # corporate member
                          "redemptionValueJod":2.5}  # gives the member a live code
                         -> {"token": "...", "code": "AB2C-D3EF"|null}
    POST /__mock/config  {"delaySeconds": 2.0, "failNext": 503}
    GET  /__mock/state   -> counters (for tests)

Earn rule in the mock: 10 points per JOD, floored. Not the real rule.
"""
import argparse
import json
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN_TTL_SECONDS = 60
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


class MockState:
    def __init__(self, pos_key):
        self.lock = threading.Lock()
        self.pos_key = pos_key
        self.tokens = {}        # token -> {memberId, mode, exp, used}
        self.members = {}       # memberId -> {percentOff, points}
        self.redemptions = {}   # CODE -> {memberId, valueJod, points, settled}
        self.tickets = {}       # earnTicket -> memberId
        self.earns = {}         # posOrderRef -> {earnTicket, paidTotal, points}
        self.delay = 0.0
        self.fail_next = None
        self.requests = {}      # path -> count

    def count(self, path):
        with self.lock:
            self.requests[path] = self.requests.get(path, 0) + 1

    def issue_token(self, member_id, mode="pay", percent_off=None, redemption_value=None, ttl=TOKEN_TTL_SECONDS):
        with self.lock:
            member = self.members.setdefault(member_id, {"percentOff": None, "points": 0.0})
            if percent_off is not None:
                member["percentOff"] = float(percent_off)
            code = None
            if redemption_value is not None:
                raw = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))
                code = raw[:4] + "-" + raw[4:]
                self.redemptions[code] = {
                    "memberId": member_id, "valueJod": float(redemption_value),
                    "points": int(float(redemption_value) * 100), "settled": False,
                }
            token = secrets.token_urlsafe(24) + "." + secrets.token_urlsafe(24)
            self.tokens[token] = {"memberId": member_id, "mode": mode, "exp": time.time() + ttl, "used": False}
            return token, code

    def active_redemption(self, member_id):
        for code, row in self.redemptions.items():
            if row["memberId"] == member_id and not row["settled"]:
                return code, row
        return None, None


def _redemption_view(code, row):
    return {"code": code, "points": row["points"], "valueJod": row["valueJod"],
            "status": "settled" if row["settled"] else "pending", "expiresIn": 600}


class Handler(BaseHTTPRequestHandler):
    server_version = "AlmondBffMock/1.0"
    state = None  # set by make_server

    # ------------------------------------------------------------ helpers
    def _send(self, status, body):
        payload = json.dumps(body).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass  # the client gave up (timeout test) — that is the point

    def _err(self, status, code, message):
        self._send(status, {"error": code, "message": message})

    def _body(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        try:
            data = json.loads(raw or b"{}")
        except ValueError:
            return None
        return data if isinstance(data, dict) else None

    def _verify_token(self, token):
        """Mirror of bff verifyPosToken: 401 bad/expired, 409 replay."""
        st = self.state
        with st.lock:
            row = st.tokens.get(token or "")
            if not row:
                return None, (401, "unauthorized", "bad pos signature")
            if row["exp"] < time.time():
                return None, (401, "unauthorized", "pos token expired")
            if row["used"]:
                return None, (409, "pos_token_replay", "pos token already used")
            row["used"] = True
            return row, None

    def log_message(self, *args):  # keep test output clean; never echo bodies
        pass

    # ------------------------------------------------------------ routing
    def do_GET(self):
        if self.path == "/__mock/state":
            with self.state.lock:
                return self._send(200, {"requests": dict(self.state.requests), "earns": len(self.state.earns)})
        return self._err(404, "not_found", "Not found")

    def do_POST(self):
        st = self.state
        st.count(self.path)
        body = self._body()
        if body is None:
            return self._err(400, "bad_request", "invalid JSON")

        if self.path == "/__mock/token":
            token, code = st.issue_token(
                body.get("memberId") or "member-1", body.get("mode") or "pay",
                body.get("percentOff"), body.get("redemptionValueJod"),
                float(body.get("ttl") or TOKEN_TTL_SECONDS),
            )
            return self._send(200, {"token": token, "code": code})
        if self.path == "/__mock/config":
            with st.lock:
                if "delaySeconds" in body:
                    st.delay = float(body.get("delaySeconds") or 0)
                if "failNext" in body:
                    st.fail_next = body.get("failNext")
            return self._send(200, {"ok": True})

        # ---- real endpoints: key first, fail closed (like the BFF) ----
        if st.delay:
            time.sleep(st.delay)
        with st.lock:
            fail, st.fail_next = st.fail_next, None
        if fail:
            return self._err(int(fail), "internal", "Internal error")
        presented = self.headers.get("x-pos-key")
        if not st.pos_key or not presented or not secrets.compare_digest(presented, st.pos_key):
            return self._err(401, "unauthorized", "invalid pos key")

        route = {
            "/v1/pos/scan": self._scan,
            "/v1/pos/earn": self._earn,
            "/v1/pos/earn/reverse": self._reverse,
            "/v1/pos/redemption/settle": self._settle,
        }.get(self.path)
        if not route:
            return self._err(404, "not_found", "Not found")
        return route(body)

    def _scan(self, body):
        st = self.state
        if not isinstance(body.get("token"), str):
            return self._err(400, "bad_request", "token is required")
        row, err = self._verify_token(body["token"])
        if err:
            return self._err(*err)
        member_id, mode = row["memberId"], row["mode"]
        with st.lock:
            member = st.members.get(member_id, {})
            pct = member.get("percentOff")
            ticket = None
            if not pct:
                ticket = "et_" + secrets.token_urlsafe(16)
                st.tickets[ticket] = member_id
        code, red = st.active_redemption(member_id) if mode == "redeem" else (None, None)
        return self._send(200, {
            "memberId": member_id,
            "mode": mode,
            "earnTicket": ticket,
            "redemption": _redemption_view(code, red) if red else None,
            "corporate": ({"companyId": "c1", "nameAr": "شركة تجريبية", "nameEn": "Mock Co",
                           "percentOff": pct} if pct else None),
            "earnsPoints": not pct,
        })

    def _earn(self, body):
        st = self.state
        ticket, ref, branch = body.get("earnTicket"), body.get("posOrderRef"), body.get("branchId")
        total = body.get("paidTotal")
        if not (isinstance(ticket, str) and isinstance(ref, str) and isinstance(branch, str)) \
                or isinstance(total, bool) or not isinstance(total, (int, float)) or total < 0:
            return self._err(400, "bad_request", "earnTicket, posOrderRef, branchId, paidTotal required")
        with st.lock:
            member_id = st.tickets.get(ticket)
            if not member_id:
                return self._err(400, "bad_request", "unknown earn ticket")
            prior = st.earns.get(ref)
            if prior:
                if prior["earnTicket"] != ticket or abs(prior["paidTotal"] - float(total)) > 0.0005:
                    return self._err(409, "earn_conflict", "posOrderRef already earned with different data")
                return self._send(200, {"posOrderRef": ref, "pointsEarned": prior["points"],
                                        "pointsBalance": st.members[member_id]["points"], "replay": True})
            points = float(int(float(total) * 10))
            st.earns[ref] = {"earnTicket": ticket, "paidTotal": float(total), "points": points,
                             "memberId": member_id, "reversed": False}
            st.members.setdefault(member_id, {"percentOff": None, "points": 0.0})["points"] += points
            balance = st.members[member_id]["points"]
        return self._send(200, {"posOrderRef": ref, "pointsEarned": points, "pointsBalance": balance, "replay": False})

    def _reverse(self, body):
        st = self.state
        ref = body.get("posOrderRef")
        with st.lock:
            row = st.earns.get(ref) if isinstance(ref, str) else None
            if not row:
                return self._err(404, "not_found", "earn not found")
            if row["reversed"]:
                return self._send(200, {"reversedPoints": 0, "shortfall": 0})
            member = st.members[row["memberId"]]
            take = min(member["points"], row["points"])
            member["points"] -= take
            row["reversed"] = True
        return self._send(200, {"reversedPoints": take, "shortfall": row["points"] - take})

    def _settle(self, body):
        st = self.state
        token, code = body.get("token"), body.get("code")
        if not token and not code:
            return self._err(400, "bad_request", "token or code is required")
        if token:
            row, err = self._verify_token(token)
            if err:
                return self._err(*err)
            if row["mode"] != "redeem":
                return self._err(400, "bad_request", "this QR is not a redemption")
            code, red = st.active_redemption(row["memberId"])
        else:
            code = "".join(str(code).split()).upper()
            red = st.redemptions.get(code)
        with st.lock:
            if not red or red["settled"]:
                return self._err(404, "not_found", "redemption not found")
            red["settled"] = True
        return self._send(201, {"settled": True, "memberId": red["memberId"], "valueJod": red["valueJod"],
                                "points": red["points"], "redemption": _redemption_view(code, red)})


def make_server(host="127.0.0.1", port=0, pos_key="mock-pos-key"):
    """Build (not start) a mock server. ``port=0`` picks a free port; read it
    back from ``server.server_address[1]``. ``server.state`` is the store."""
    state = MockState(pos_key)
    handler = type("BoundHandler", (Handler,), {"state": state})
    server = ThreadingHTTPServer((host, port), handler)
    server.daemon_threads = True
    server.state = state
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8898)
    parser.add_argument("--key", default="mock-pos-key")
    args = parser.parse_args()
    server = make_server(args.host, args.port, args.key)
    print("Almond BFF mock on http://%s:%d  (POS key: set in Odoo settings)" % (args.host, args.port))
    print("Mint a QR token:  curl -s -XPOST localhost:%d/__mock/token -d '{\"memberId\":\"m1\",\"mode\":\"pay\"}'"
          % args.port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
