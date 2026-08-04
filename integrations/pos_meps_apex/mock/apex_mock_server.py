#!/usr/bin/env python3
"""
Optional standalone Apex mock (HTTP path test). Run: python3 apex_mock_server.py
Then set system param  pos_meps_apex.mode = live  and
     pos_meps_apex.gateway_url = http://127.0.0.1:8899/sale
to exercise the real HTTP round-trip against a fake 'terminal' that approves.
(No Flask needed — stdlib only.)
"""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class H(BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        amount = body.get("amount", "0.000")
        resp = {
            "approved": True, "authCode": "MCK123", "rrn": "618800000001",
            "maskedPan": "400000******0002", "scheme": "VISA",
            "invoice": "000101", "batch": "000001", "echo": {"amount": amount, "tid": body.get("tid")},
        }
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(resp).encode())

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print("Apex mock listening on http://127.0.0.1:8899/sale")
    HTTPServer(("127.0.0.1", 8899), H).serve_forever()
