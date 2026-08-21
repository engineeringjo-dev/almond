# -*- coding: utf-8 -*-
"""كتابةُ CSV بترميزٍ يفتحه Excel عربيّاً بلا تشويه."""
import csv
from pathlib import Path

_written: list[tuple[str, int]] = []


def write(outdir: Path, name: str, header: list[str], rows: list[list]) -> int:
    outdir.mkdir(parents=True, exist_ok=True)
    p = outdir / name
    # utf-8-sig: بلا BOM يفتح Excel العربيَّ حروفاً مشوَّهة — والملفّ يُسلَّم لبشر.
    with p.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")
        w.writerow(header)
        w.writerows(rows)
    _written.append((name, len(rows)))
    print(f"  ✅ {name:26} {len(rows):>8,} صفّاً")
    return len(rows)


def summary() -> list[tuple[str, int]]:
    return list(_written)
