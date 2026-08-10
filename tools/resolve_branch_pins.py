#!/usr/bin/env python3
"""
Turn Google Maps share links into ready-to-paste branch coordinates.

Written because this had to be done by hand once: `maps.app.goo.gl` is blocked
from the build container, so the eight share links could not be resolved there.
Run it anywhere with plain internet access — no API key, no dependencies.

READ-ONLY: it prints SQL, it never connects to a database.

Usage:
    python3 tools/resolve_branch_pins.py links.txt
    python3 tools/resolve_branch_pins.py            # reads the links from stdin

Input is one line per branch, `CODE <space> URL`:

    MAKKAH    https://maps.app.goo.gl/xxxxxxxx
    RABIA     https://maps.app.goo.gl/yyyyyyyy

Lines that are blank or start with # are ignored. A bare URL with no code is
still resolved and printed as a comment, so nothing is silently dropped.

Then paste the printed UPDATE statements into Supabase → SQL Editor.
"""
import re
import sys
import urllib.error
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

# Jordan's bounding box — the same guard the branches table enforces, applied
# here so a bad pin is caught before it reaches SQL rather than after.
LAT_RANGE = (29.1, 33.4)
LNG_RANGE = (34.9, 39.4)

# Ordered by how trustworthy the match is. `!3d<lat>!4d<lng>` is the resolved
# place itself; `@lat,lng,zoom` is only the map centre, which can sit a street
# away from the pin, so it is the last resort.
PATTERNS = [
    re.compile(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)"),
    re.compile(r"[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)"),
    re.compile(r"/@(-?\d+\.\d+),(-?\d+\.\d+),"),
]


def fetch(url):
    """Follow the short link and return (final_url, body)."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.geturl(), r.read().decode("utf-8", "replace")


def coords(url):
    final, body = fetch(url)
    for pat in PATTERNS:
        for hay in (final, body):
            m = pat.search(hay)
            if m:
                lat, lng = float(m.group(1)), float(m.group(2))
                if LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LNG_RANGE[0] <= lng <= LNG_RANGE[1]:
                    return lat, lng, final
    raise ValueError("no coordinate inside Jordan found — open the link and copy the pin by hand")


def main():
    src = open(sys.argv[1], encoding="utf-8") if len(sys.argv) > 1 else sys.stdin
    rows, problems = [], []

    for raw in src:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        url = next((p for p in parts if p.startswith("http")), None)
        if not url:
            problems.append(f"{line}  -> no URL on this line")
            continue
        code = parts[0].upper() if not parts[0].startswith("http") else None
        try:
            lat, lng, final = coords(url)
            rows.append((code, lat, lng))
            print(f"# {code or '(no code)':10} {lat:.6f}, {lng:.6f}", file=sys.stderr)
        except (urllib.error.URLError, ValueError, OSError) as e:
            problems.append(f"{code or url}  -> {e}")

    print("-- Exact branch pins, resolved from Google Maps share links.")
    print("-- Paste into Supabase → SQL Editor. Run 20260810_branch_geo.sql first.")
    print("begin;")
    for code, lat, lng in rows:
        if code:
            print(f"update public.branches set lat = {lat:.6f}, lng = {lng:.6f} where code = '{code}';")
        else:
            print(f"-- unassigned: {lat:.6f}, {lng:.6f}")
    print("commit;")
    print()
    print("-- Verify:")
    print("--   select branch_no, code, name_ar, lat, lng from public.branches")
    print("--   where kind = 'branch' order by branch_no;")

    if problems:
        print("\nUNRESOLVED — these still need a manual pin:", file=sys.stderr)
        for p in problems:
            print("  " + p, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
