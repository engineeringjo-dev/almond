#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stand-alone mock of the four Almond BFF till endpoints — stdlib only.

    python3 almond_bff_mock.py [--port 8898] [--key mock-pos-key]

Then, in Odoo: Settings -> Point of Sale -> Almond Loyalty
    API URL  = http://127.0.0.1:8898
    POS key  = mock-pos-key

It mirrors the REAL server (``bff/src/routes/pos.ts``, ``bff/src/pos/token.ts``,
``bff/src/pos/sales.ts``, ``bff/src/backend/memory.ts`` tillEarn) where it
matters for the till — status codes, machine codes and the ORDER of checks:

every route   key first, fail closed        401 pos_key_invalid
              rate limit (settle/earn/rev)  429 rate_limited      (via /__mock/config)
              body schema                   400 bad_request
/scan         QR malformed / mis-signed     401 token_invalid
              QR past signed deadline       401 token_expired (member60s, redemption120s)
              QR already scanned            409 pos_token_replay
              earnTicket only for pay/earn QR of a member who earns (never corporate,
              never redeem), with earnTicketExpiresIn (7 days)
/earn         ticket not ours               401 ticket_invalid
              paidAt > now + 5 min          400 bad_request
              ref known, same member/amount/branch -> 200 replay:true (even after the
                ticket expired, even after a reversal)
              ref known, anything different 409 pos_order_conflict
              ticket already paid another ref 409 ticket_used
              ticket expired (new sale)     401 ticket_expired
              paidAt outside [scan − 30 min, scan + 6 h]  400 paid_at_outside_ticket_window
              else                          201 grant
/earn/reverse unknown ref 404 not_found; first 201; again 200 replay:true
/settle       typed code                    400 redemption_barcode_required
              bad/expired receipt            401 token_invalid / token_expired
              identical order/key/body       201 original cached reply, including after expiry
              different body under key       422 idempotency_key_reused
              new attempt on settled row     409; absent/cancelled/expired reservation404

Mock-only control endpoints (no key needed; NEVER exist on the real BFF):

    POST /__mock/token      {"memberId":"m1","mode":"pay|earn|corporate|redeem",
                             "percentOff":10,            # corporate member
                             "redemptionValueJod":2.5,   # creates an exactly bound reservation
                             "ttl":60}                   # QR lifetime (negative = already expired)
                            -> {"token": "...", "code": "AB2C-D3EF"|null}
    POST /__mock/age_ticket {"earnTicket":"...","seconds":N}  # pretend it was scanned N s earlier
    POST /__mock/config     {"delaySeconds": 2.0, "failNext": 503|429}
    GET  /__mock/state      -> counters (for tests)

Earn rule in the mock: 10 points per JOD, floored. Not the real rule.
"""
import argparse
import json
import re
import secrets
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN_TTL_SECONDS = 60                     # POS_TOKEN_TTL_SECONDS
REDEMPTION_QR_TTL_SECONDS = 120           # POS_REDEMPTION_TOKEN_TTL_SECONDS
EARN_TICKET_TTL_SECONDS = 7 * 24 * 3600    # POS_EARN_TICKET_TTL_SECONDS
SALE_WINDOW_SECONDS = 6 * 3600             # POS_EARN_SALE_WINDOW_SECONDS
PAID_BEFORE_SCAN_SECONDS = 30 * 60         # POS_EARN_PAID_BEFORE_SCAN_SECONDS
PAID_AT_MAX_SKEW_SECONDS = 5 * 60          # PAID_AT_MAX_SKEW_MS
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
# zod .datetime({ offset: true }): ISO-8601 with Z or ±HH:MM, optional fraction
_ISO_OFFSET = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$")


def _parse_iso(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def _now():
    return time.time()


def _utc_iso(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat().replace("+00:00", "Z")


class HttpErr(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def bad_request(message):
    return HttpErr(400, "bad_request", message)


class MockState:
    def __init__(self, pos_key):
        self.lock = threading.Lock()
        self.pos_key = pos_key
        self.tokens = {}        # token -> {memberId, mode, exp, used}
        self.members = {}       # memberId -> {percentOff, points}
        self.redemptions = {}   # CODE -> {memberId, valueJod, points, settled}
        self.receipts = {}      # opaque receipt -> exact member/redemption/original deadline
        self.settlements = {}   # idempotency key -> exact request body and completed reply
        self.tickets = {}       # earnTicket -> {memberId, jti, iat, exp}
        self.sales = {}         # posOrderRef -> sale row
        self.sale_by_jti = {}   # ticket jti -> posOrderRef   (UNIQUE on the real table)
        self.delay = 0.0
        self.fail_next = None
        self.requests = {}      # path -> count
        self.last_body = {}     # path -> last JSON body received (tests check what the client SENT)

    def count(self, path):
        with self.lock:
            self.requests[path] = self.requests.get(path, 0) + 1

    def issue_token(self, member_id, mode="pay", percent_off=None, redemption_value=None, ttl=None):
        with self.lock:
            member = self.members.setdefault(member_id, {"percentOff": None, "points": 0.0})
            if percent_off is not None:
                member["percentOff"] = float(percent_off)
            code = None
            if redemption_value is not None:
                raw = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))
                code = raw[:4] + "-" + raw[4:]
                self.redemptions[code] = {
                    "id": secrets.token_hex(16), "expiresAt": _now() + 900,
                    "memberId": member_id, "valueJod": float(redemption_value),
                    "points": int(float(redemption_value) * 100), "settled": False,
                }
            token = secrets.token_urlsafe(24) + "." + secrets.token_urlsafe(24)
            _, redemption = (code, self.redemptions[code]) if code else self.active_redemption(member_id)
            lifetime = float(ttl) if ttl is not None else (REDEMPTION_QR_TTL_SECONDS if mode == "redeem" else TOKEN_TTL_SECONDS)
            self.tokens[token] = {"memberId": member_id, "mode": mode, "exp": _now() + lifetime, "used": False,
                                  "redemptionId": redemption["id"] if mode == "redeem" and redemption else None}
            return token, code

    def active_redemption(self, member_id):
        for code, row in self.redemptions.items():
            if row["memberId"] == member_id and not row["settled"]:
                return code, row
        return None, None


def _redemption_view(row):
    return {"id": row["id"], "points": row["points"], "valueJod": row["valueJod"],
            "status": "settled" if row["settled"] else "pending", "expiresIn": max(0, int(row["expiresAt"] - _now())),
            "expiresAt": _utc_iso(row["expiresAt"])}


def _is_str(value, lo, hi):
    return isinstance(value, str) and lo <= len(value) <= hi


class Handler(BaseHTTPRequestHandler):
    server_version = "AlmondBffMock/2.0"
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

    def _body(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        try:
            data = json.loads(raw or b"{}")
        except ValueError:
            return None
        return data if isinstance(data, dict) else None

    def _verify_token(self, token):
        """Mirror of bff verifyPosToken: token_invalid / token_expired (401),
        pos_token_replay (409). Marks the QR used."""
        st = self.state
        with st.lock:
            row = st.tokens.get(token or "")
            if not row:
                parts = (token or "").split(".")
                msg = "malformed pos token" if len(parts) != 2 or not all(parts) else "bad pos signature"
                raise HttpErr(401, "token_invalid", msg)
            if row["exp"] <= _now():
                raise HttpErr(401, "token_expired", "pos token expired")
            if row["used"]:
                raise HttpErr(409, "pos_token_replay", "pos token already used")
            row["used"] = True
            if row["mode"] not in ("pay", "earn", "corporate", "redeem"):
                raise HttpErr(401, "token_invalid", "unknown pos token mode")
            return row

    def log_message(self, *args):  # keep test output clean; never echo bodies
        pass

    # ------------------------------------------------------------ routing
    def do_GET(self):
        if self.path == "/__mock/state":
            with self.state.lock:
                return self._send(200, {"requests": dict(self.state.requests), "sales": len(self.state.sales)})
        return self._send(404, {"error": "not_found", "message": "Not found"})

    def do_POST(self):
        st = self.state
        st.count(self.path)
        body = self._body()
        if self.path.startswith("/__mock/"):
            return self._control(body or {})

        with st.lock:
            st.last_body[self.path] = body
        if st.delay:
            time.sleep(st.delay)
        route = {
            "/v1/pos/scan": (self._scan, False),
            "/v1/pos/earn": (self._earn, True),
            "/v1/pos/earn/reverse": (self._reverse, True),
            "/v1/pos/redemption/settle": (self._settle, True),
        }.get(self.path)
        if not route:
            return self._send(404, {"error": "not_found", "message": "Not found"})
        handler, rate_limited = route
        try:
            # FAIL CLOSED, before anything else (requirePosKey)
            presented = self.headers.get("x-pos-key")
            if not st.pos_key or not presented or not secrets.compare_digest(presented, st.pos_key):
                raise HttpErr(401, "pos_key_invalid", "invalid pos key")
            with st.lock:
                fail, st.fail_next = st.fail_next, None
            if fail:
                fail = int(fail)
                if fail == 429 and rate_limited:
                    raise HttpErr(429, "rate_limited", "too many requests (mock) — try again later")
                raise HttpErr(fail, "internal", "Internal error")
            if body is None:
                raise bad_request("invalid JSON")
            status, payload = handler(body)
        except HttpErr as err:
            return self._send(err.status, {"error": err.code, "message": err.message})
        return self._send(status, payload)

    def _control(self, body):
        st = self.state
        if self.path == "/__mock/token":
            token, code = st.issue_token(
                body.get("memberId") or "member-1", body.get("mode") or "pay",
                body.get("percentOff"), body.get("redemptionValueJod"),
                body.get("ttl"),
            )
            return self._send(200, {"token": token, "code": code})
        if self.path == "/__mock/age_ticket":
            with st.lock:
                t = st.tickets.get(body.get("earnTicket") or "")
                if not t:
                    return self._send(404, {"error": "not_found", "message": "unknown ticket"})
                shift = float(body.get("seconds") or 0)
                t["iat"] -= shift
                t["exp"] -= shift
            return self._send(200, {"ok": True})
        if self.path == "/__mock/config":
            with st.lock:
                if "delaySeconds" in body:
                    st.delay = float(body.get("delaySeconds") or 0)
                if "failNext" in body:
                    st.fail_next = body.get("failNext")
            return self._send(200, {"ok": True})
        return self._send(404, {"error": "not_found", "message": "Not found"})

    # ------------------------------------------------------------ endpoints
    def _scan(self, body):
        st = self.state
        if not isinstance(body.get("token"), str):
            raise bad_request("token: Required")
        row = self._verify_token(body["token"])
        member_id, mode = row["memberId"], row["mode"]
        with st.lock:
            pct = st.members.get(member_id, {}).get("percentOff")
            earns = not pct
            ticket = None
            if earns and mode in ("pay", "earn"):
                ticket = "et." + secrets.token_urlsafe(24)
                now = time.time()
                st.tickets[ticket] = {"memberId": member_id, "jti": secrets.token_hex(8),
                                      "iat": now, "exp": now + EARN_TICKET_TTL_SECONDS}
            red = next((red for red in st.redemptions.values() if red["id"] == row.get("redemptionId")
                        and red["memberId"] == member_id), None) if mode == "redeem" else None
            redemption = None
            if mode == "redeem":
                if not red or red["settled"] or red.get("cancelled") or red["expiresAt"] <= _now():
                    raise HttpErr(404, "not_found", "redemption not found")
                receipt = secrets.token_urlsafe(24) + "." + secrets.token_urlsafe(24)
                st.receipts[receipt] = {"memberId": member_id, "redemptionId": red["id"], "exp": row["exp"]}
                redemption = {**_redemption_view(red), "settlementToken": receipt,
                              "presentationExpiresAt": _utc_iso(row["exp"])}
        return 200, {
            "memberId": member_id,
            "mode": mode,
            "redemption": redemption,
            "corporate": ({"companyId": "c1", "nameAr": "شركة تجريبية", "nameEn": "Mock Co",
                           "percentOff": pct} if pct else None),
            "earnsPoints": earns,
            "earnTicket": ticket,
            "earnTicketExpiresIn": EARN_TICKET_TTL_SECONDS if ticket else None,
        }

    def _earn(self, body):
        st = self.state
        ticket_s, ref, branch = body.get("earnTicket"), body.get("posOrderRef"), body.get("branchId")
        total, paid_at_s = body.get("paidTotal"), body.get("paidAt")
        # -- schema (earnBody)
        errors = []
        if not _is_str(ticket_s, 1, 1024):
            errors.append("earnTicket")
        if not _is_str(ref, 1, 64):
            errors.append("posOrderRef")
        if not _is_str(branch, 1, 64):
            errors.append("branchId")
        if isinstance(total, bool) or not isinstance(total, (int, float)) or not (0 <= total <= 100000) \
                or abs(total * 1000 - round(total * 1000)) >= 1e-6:
            errors.append("paidTotal")
        if paid_at_s is not None and not (isinstance(paid_at_s, str) and _ISO_OFFSET.match(paid_at_s)):
            errors.append("paidAt: Invalid datetime")
        if errors:
            raise bad_request("; ".join(errors))
        # -- signature first (readEarnTicket)
        with st.lock:
            ticket = st.tickets.get(ticket_s)
        if not ticket:
            raise HttpErr(401, "ticket_invalid", "this earn ticket was not issued by this server")
        now = time.time()
        paid_at = _parse_iso(paid_at_s) if paid_at_s else now
        if paid_at > now + PAID_AT_MAX_SKEW_SECONDS:
            raise bad_request("paidAt is in the future — check the till clock")
        in_window = ticket["iat"] - PAID_BEFORE_SCAN_SECONDS <= paid_at <= ticket["iat"] + SALE_WINDOW_SECONDS
        refusal = "expired" if ticket["exp"] < now else (None if in_window else "window")
        paid_fils = round(float(total) * 1000)
        with st.lock:
            # -- tillEarn: replay/conflict first, then ticket_used, then refusal
            sale = st.sales.get(ref)
            if sale:
                if (sale["memberId"], sale["paidFils"], sale["branchId"]) != (ticket["memberId"], paid_fils, branch):
                    raise HttpErr(409, "pos_order_conflict",
                                  "this POS order reference was already reported with a different member, "
                                  "branch or amount")
                return 200, {"posOrderRef": ref, "pointsEarned": sale["pointsEarned"],
                             "pointsBalance": sale["pointsBalanceAfter"], "replay": True}
            if ticket["jti"] in st.sale_by_jti:
                raise HttpErr(409, "ticket_used",
                              "this earn ticket was already spent on another POS order — scan the member again")
            if refusal == "expired":
                raise HttpErr(401, "ticket_expired", "this earn ticket has expired — scan the member again")
            if refusal == "window":
                raise HttpErr(400, "paid_at_outside_ticket_window",
                              "paidAt is not close enough to when this member was scanned — "
                              "scan the member for this sale")
            member = st.members.setdefault(ticket["memberId"], {"percentOff": None, "points": 0.0})
            points = float(int(paid_fils / 100))  # 10 points per JOD
            member["points"] += points
            st.sales[ref] = {"memberId": ticket["memberId"], "branchId": branch, "paidFils": paid_fils,
                             "pointsEarned": points, "pointsBalanceAfter": member["points"],
                             "status": "earned"}
            st.sale_by_jti[ticket["jti"]] = ref
            return 201, {"posOrderRef": ref, "pointsEarned": points,
                         "pointsBalance": member["points"], "replay": False}

    def _reverse(self, body):
        st = self.state
        ref, reason = body.get("posOrderRef"), body.get("reason")
        if not _is_str(ref, 1, 64) or not isinstance(reason, str) or not (1 <= len(reason.strip()) <= 200):
            raise bad_request("posOrderRef / reason")
        with st.lock:
            sale = st.sales.get(ref)
            if not sale:
                raise HttpErr(404, "not_found", "pos sale not found")
            replay = sale["status"] == "reversed"
            if not replay:
                member = st.members[sale["memberId"]]
                take = min(member["points"], sale["pointsEarned"])
                member["points"] -= take
                sale.update(status="reversed", reversedPoints=take, shortfall=sale["pointsEarned"] - take,
                            reverseBalanceAfter=member["points"])
        return (200 if replay else 201), {
            "posOrderRef": ref, "reversedPoints": sale["reversedPoints"], "shortfall": sale["shortfall"],
            "pointsBalance": sale["reverseBalanceAfter"], "replay": replay,
        }

    def _settle(self, body):
        st = self.state
        if "code" in body:
            raise HttpErr(400, "redemption_barcode_required", "scan the current redemption QR")
        token, receipt = body.get("token"), body.get("settlementToken")
        ref, key = body.get("posOrderRef"), self.headers.get("Idempotency-Key")
        if not _is_str(ref, 1, 64) or not _is_str(key, 1, 128):
            raise bad_request("posOrderRef and Idempotency-Key required")
        if bool(token) == bool(receipt) or not _is_str(token or receipt, 1, 4096):
            raise bad_request("exactly one token or settlementToken required")
        with st.lock:
            completed = st.settlements.get(key)
            if completed:
                if completed[0] != body:
                    raise HttpErr(422, "idempotency_key_reused", "key belongs to another request")
                return 201, completed[1]
        if token:
            row = self._verify_token(token)
            if row["mode"] != "redeem":
                raise bad_request("this QR is not a redemption")
        else:
            row = st.receipts.get(receipt)
            if not row:
                raise HttpErr(401, "token_invalid", "invalid settlement receipt")
            if row["exp"] <= _now():
                raise HttpErr(401, "token_expired", "settlement receipt expired")
        with st.lock:
            red = next((red for red in st.redemptions.values() if red["id"] == row.get("redemptionId")
                        and red["memberId"] == row["memberId"]), None)
            if not red or red.get("cancelled") or red["expiresAt"] <= _now():
                raise HttpErr(404, "not_found", "redemption not found")
            if red["settled"]:
                raise HttpErr(409, "redemption_already_settled", "redemption already settled")
            red["settled"] = True
            response = {"settled": True, "posOrderRef": ref, "memberId": red["memberId"], "valueJod": red["valueJod"],
                        "points": red["points"], "redemption": _redemption_view(red)}
            st.settlements[key] = (dict(body), response)
        return 201, response


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
