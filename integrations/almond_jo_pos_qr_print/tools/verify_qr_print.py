#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""تحقّق قبل/بعد من طباعة رمز JoFotara على الفواتير — قراءة فقط.

يحاكي شرط ``account.move._get_name_invoice_report()`` على بيانات الإنتاج الحيّة
ويُحصي، لكل شركة: عدد الفواتير الحاملة لرمز موقّع، وكم منها يسلك القالب الأردنيّ
(فيُطبع رمزها اليوم)، وكم منها لا يسلكه (فيستفيد من الإصلاح).

شغّله مرّتين — قبل النشر وبعده — والمتوقّع أن تبقى الأعداد كما هي: الإصلاح يغيّر
ما يُطبع لا ما هو مخزّن. القيمة هنا في تحديد نطاق الأثر بدقّة قبل النشر، وفي
إثبات أن الفواتير السليمة لم تُمَسّ بعده.

الاستعمال:
    python3 verify_qr_print.py                 # ملخّص + أول ٥٠ فاتورة متأثّرة
    python3 verify_qr_print.py --list-all      # كل الفواتير المتأثّرة
    python3 verify_qr_print.py --json out.json # حفظ النتيجة للمقارنة الآلية
"""

import argparse
import json
import os
import sys
import time
import xmlrpc.client

# الحقول المخزَّنة قابلة للبحث؛ أما ``l10n_jo_edi_xml_attachment_id`` فمحسوب غير
# مخزَّن ⇒ لا يجوز وضعه في domain، ولا سبيل لمعرفته إلا بالقراءة على دفعات.
MOVE_FIELDS = [
    "name", "company_id", "invoice_date", "amount_total", "currency_id",
    "l10n_jo_edi_state", "l10n_jo_edi_xml_attachment_id", "pos_order_ids",
]
JORDANIAN_STATES = ("sent", "demo")
BATCH_SIZE = 200

# حارس صريح: أي محاولة لاستدعاء تابع كتابة تُوقف السكربت بدل أن تمرّ.
READ_ONLY_METHODS = frozenset({
    "search", "read", "search_read", "search_count", "fields_get", "read_group",
})


class OdooReadOnlyClient:
    """عميل XML-RPC لا يسمح إلا بتوابع القراءة، مع إعادة محاولة متباطئة."""

    def __init__(self, url, db, login, api_key, retries=5, base_delay=3.0):
        self.db, self.api_key = db, api_key
        self.retries, self.base_delay = retries, base_delay
        self._common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common")
        self._models = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object")
        self.uid = self._call_with_retry(
            self._common.authenticate, db, login, api_key, {}
        )
        if not self.uid:
            raise SystemExit("فشل الاستيثاق: تحقّق من ODOO_LOGIN و ODOO_API_KEY.")

    def _call_with_retry(self, func, *args):
        """يعيد المحاولة على أخطاء التوفّر المؤقّتة فقط، ويرفع غيرها فوراً."""
        last_error = None
        for attempt in range(self.retries):
            try:
                return func(*args)
            except xmlrpc.client.Fault as exc:
                message = str(exc)
                # Access Denied قد ينتج عن خنق مؤقّت على Odoo.sh لا عن صلاحية فعلاً.
                if "Access Denied" not in message:
                    raise
                last_error = exc
            except (xmlrpc.client.ProtocolError, OSError) as exc:
                status = getattr(exc, "errcode", None)
                if status is not None and status not in (429, 502, 503, 504):
                    raise
                last_error = exc
            delay = self.base_delay * (attempt + 1)
            print(f"  … تعذّر الاتصال ({type(last_error).__name__})، إعادة بعد {delay:.0f}ث",
                  file=sys.stderr)
            time.sleep(delay)
        raise SystemExit(f"فشل الاتصال بعد {self.retries} محاولات: {last_error}")

    def execute(self, model, method, args, kwargs=None):
        if method not in READ_ONLY_METHODS:
            raise RuntimeError(f"مخالفة القراءة فقط: محاولة استدعاء {model}.{method}")
        return self._call_with_retry(
            self._models.execute_kw, self.db, self.uid, self.api_key,
            model, method, args, kwargs or {},
        )


def load_env(path):
    """يقرأ ملف بصيغة ``export KEY=value``."""
    if not os.path.isfile(path):
        raise SystemExit(f"ملف الاعتماد غير موجود: {path}")
    env = {}
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.removeprefix("export ").split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    missing = [k for k in ("ODOO_URL", "ODOO_DB", "ODOO_LOGIN", "ODOO_API_KEY")
               if not env.get(k)]
    if missing:
        raise SystemExit(f"مفاتيح ناقصة في {path}: {', '.join(missing)}")
    return env


def uses_jordanian_template(move):
    """نفس شرط ``l10n_jo_edi`` في اختيار القالب — أي تعديل عليه يجب أن يُطابَق هنا."""
    return bool(
        move["l10n_jo_edi_state"] in JORDANIAN_STATES
        and move["l10n_jo_edi_xml_attachment_id"]
    )


def fetch_invoices(client, company_ids):
    """يجلب كل الفواتير الحاملة لرمز JoFotara عبر الشركات المطلوبة."""
    context = {"context": {"allowed_company_ids": company_ids}}
    domain = [
        ("l10n_jo_edi_qr", "!=", False),
        ("move_type", "in", ["out_invoice", "out_refund"]),
        ("company_id", "in", company_ids),
    ]
    ids = client.execute("account.move", "search", [domain],
                         {"order": "invoice_date desc, id desc", **context})
    print(f"عدد الفواتير الحاملة لرمز موقّع: {len(ids)} — تُقرأ على دفعات…")
    moves = []
    for start in range(0, len(ids), BATCH_SIZE):
        chunk = ids[start:start + BATCH_SIZE]
        moves.extend(client.execute("account.move", "read", [chunk, MOVE_FIELDS], context))
        print(f"  … {min(start + BATCH_SIZE, len(ids))}/{len(ids)}", end="\r", file=sys.stderr)
    print(" " * 40, end="\r", file=sys.stderr)
    return moves


def summarize(moves, companies):
    """يبني تقريراً لكل شركة: الإجمالي، ما يُطبع اليوم، وما سيستفيد."""
    report = {cid: {"company": name, "with_qr": 0, "prints_today": 0,
                    "will_benefit": 0, "from_pos": 0}
              for cid, name in companies.items()}
    affected = []
    for move in moves:
        row = report[move["company_id"][0]]
        row["with_qr"] += 1
        if uses_jordanian_template(move):
            row["prints_today"] += 1
            continue
        row["will_benefit"] += 1
        if move["pos_order_ids"]:
            row["from_pos"] += 1
        affected.append(move)
    return report, affected


def print_report(report, affected, list_all):
    header = f"{'الشركة':<34}{'برمز':>8}{'تُطبع الآن':>12}{'ستستفيد':>10}{'من POS':>9}"
    print("\n" + header)
    print("-" * len(header))
    totals = {"with_qr": 0, "prints_today": 0, "will_benefit": 0, "from_pos": 0}
    for row in sorted(report.values(), key=lambda r: -r["with_qr"]):
        print(f"{row['company'][:33]:<34}{row['with_qr']:>8}{row['prints_today']:>12}"
              f"{row['will_benefit']:>10}{row['from_pos']:>9}")
        for key in totals:
            totals[key] += row[key]
    print("-" * len(header))
    print(f"{'الإجمالي':<34}{totals['with_qr']:>8}{totals['prints_today']:>12}"
          f"{totals['will_benefit']:>10}{totals['from_pos']:>9}")

    if not affected:
        print("\nلا توجد فواتير متأثّرة: كل فاتورة تحمل رمزاً تسلك القالب الأردنيّ.")
        return
    shown = affected if list_all else affected[:50]
    print(f"\nالفواتير التي ستبدأ بطباعة الرمز ({len(shown)} من {len(affected)}):")
    print(f"{'الفاتورة':<22}{'الشركة':<34}{'التاريخ':<13}{'المبلغ':>12}  المصدر")
    for move in shown:
        source = "POS" if move["pos_order_ids"] else "—"
        print(f"{move['name'][:21]:<22}{move['company_id'][1][:33]:<34}"
              f"{str(move['invoice_date'] or ''):<13}{move['amount_total']:>12,.2f}  {source}")
    if not list_all and len(affected) > len(shown):
        print(f"… و{len(affected) - len(shown)} فاتورة أخرى (استخدم --list-all).")


def main():
    parser = argparse.ArgumentParser(description="تحقّق قراءة-فقط من طباعة رمز JoFotara")
    parser.add_argument("--env-file",
                        default=os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                             os.pardir, ".odoo_env"),
                        help="مسار ملف الاعتماد (افتراضياً ../.odoo_env)")
    parser.add_argument("--list-all", action="store_true", help="اطبع كل الفواتير المتأثّرة")
    parser.add_argument("--json", dest="json_path", help="احفظ الملخّص بصيغة JSON للمقارنة")
    args = parser.parse_args()

    env = load_env(os.path.normpath(args.env_file))
    client = OdooReadOnlyClient(env["ODOO_URL"], env["ODOO_DB"],
                                env["ODOO_LOGIN"], env["ODOO_API_KEY"])
    print(f"متصل بـ {env['ODOO_URL']} (db={env['ODOO_DB']}, uid={client.uid})")

    # نكتشف الشركات بدل ترميز معرّفاتها، فيبقى السكربت صالحاً إن أُضيفت شركة خامسة.
    companies = client.execute("res.company", "search_read", [[]], {"fields": ["name"]})
    company_ids = [c["id"] for c in companies]
    names = {c["id"]: c["name"] for c in companies}
    print(f"الشركات: {', '.join(names.values())}")

    moves = fetch_invoices(client, company_ids)
    report, affected = summarize(moves, names)
    print_report(report, affected, args.list_all)

    if args.json_path:
        payload = {
            "database": env["ODOO_DB"],
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "per_company": list(report.values()),
            "affected": [{"id": m["id"], "name": m["name"],
                          "company": m["company_id"][1],
                          "date": m["invoice_date"],
                          "amount_total": m["amount_total"],
                          "from_pos": bool(m["pos_order_ids"])} for m in affected],
        }
        with open(args.json_path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        print(f"\nحُفظ الملخّص في {args.json_path}")


if __name__ == "__main__":
    main()
