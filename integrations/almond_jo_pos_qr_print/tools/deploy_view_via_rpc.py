#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""نشر بديل لإصلاح رمز JoFotara عبر XML-RPC — لمن لا يستطيع نشر وحدة فوراً.

ينشئ **سجلّ ir.ui.view واحداً** يحمل المحتوى نفسه الذي تحمله الوحدة
``almond_jo_pos_qr_print``، لكن بشرط مضمَّن داخل العرض بدل ``t-call`` إلى قالب
مشترك، لأن ذلك القالب لا يوجد إلا مع الوحدة.

هذا حلّ مؤقّت لا بديل عن الوحدة: العرض المنشور هكذا لا يخضع لأي مراجعة كود ولا
يظهر في مستودع Git، وسيبقى في قاعدة البيانات حتى يُحذف يدوياً. إن ثُبّتت الوحدة
لاحقاً فخطّاف ما بعد التثبيت يعطّل هذا العرض تلقائياً منعاً لطباعة الرمز مرّتين.

الوضع الافتراضيّ تجريبيّ: لا يكتب شيئاً ما لم تُمرَّر ``--apply``.

    python3 deploy_view_via_rpc.py                      # معاينة فقط
    python3 deploy_view_via_rpc.py --apply              # نشر على القالب القياسيّ
    python3 deploy_view_via_rpc.py --target studio --apply
    python3 deploy_view_via_rpc.py --rollback --apply   # تراجع
"""

import argparse
import os
import sys
import time
import xmlrpc.client

# الكتلة نفسها الموجودة في views/report_invoice_qr.xml، بشرطها مضمَّناً.
# الشرط هو النفي الحرفيّ لشرط ``_get_name_invoice_report()``: بدونه يُطبع الرمز
# مرّتين على كل فاتورة تسلك القالب الأردنيّ، لأن العروض من نوع extension تُطبَّق
# داخل الفرع الأردنيّ (primary) أيضاً. راجع README قبل تعديل أي حرف هنا.
QR_BLOCK = """
            <div t-if="o.l10n_jo_edi_qr and not (o.l10n_jo_edi_state in ('sent', 'demo') and o.l10n_jo_edi_xml_attachment_id)"
                 name="jo_fallback_qr_code" class="avoid-page-break-inside">
                <p>
                    <strong class="text-center">JoFotara QR Code</strong>
                    <img style="display:block;" t-att-src="o._l10n_jo_qr_code_src()"/>
                </p>
            </div>"""

ARCH_TEMPLATE = """<data>
    <xpath expr="//div[@id='qrcode']" position="after">%s
    </xpath>
</data>""" % QR_BLOCK

KEY_PREFIX = "almond_jo_pos_qr_print.rpc_hotfix_jo_qr"

TARGETS = {
    # القالب القاعديّ: يغطّي تقارير "Invoice PDF" و"PDF without Payment".
    "base": {
        "key": KEY_PREFIX,
        "name": "RPC hotfix: JoFotara QR on standard invoice",
        "parent_xmlid": "account.report_invoice_document",
        "parent_key": "account.report_invoice_document",
    },
    # نسخة Studio المسطّحة: لا ترث القالب القاعديّ ⇒ تحتاج عرضاً خاصاً بها.
    "studio": {
        "key": KEY_PREFIX + "_studio",
        "name": "RPC hotfix: JoFotara QR on Studio invoice",
        "parent_xmlid": "studio_customization."
                        "report_invoice_docum_206c2d13-c1e0-4a9e-b00b-92409ad527e2",
        "parent_key": "account.report_invoice_document_copy_1",
    },
}

WRITE_METHODS = frozenset({"create", "write", "unlink"})


class OdooClient:
    """عميل XML-RPC يمنع الكتابة ما لم تُطلب صراحةً، مع إعادة محاولة متباطئة."""

    def __init__(self, url, db, login, api_key, allow_write, retries=5, base_delay=3.0):
        self.db, self.api_key, self.allow_write = db, api_key, allow_write
        self.retries, self.base_delay = retries, base_delay
        common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common")
        self._models = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object")
        self.uid = self._retry(common.authenticate, db, login, api_key, {})
        if not self.uid:
            raise SystemExit("فشل الاستيثاق: تحقّق من ODOO_LOGIN و ODOO_API_KEY.")

    def _retry(self, func, *args):
        last_error = None
        for attempt in range(self.retries):
            try:
                return func(*args)
            except xmlrpc.client.Fault as exc:
                if "Access Denied" not in str(exc):
                    raise
                last_error = exc
            except (xmlrpc.client.ProtocolError, OSError) as exc:
                status = getattr(exc, "errcode", None)
                if status is not None and status not in (429, 502, 503, 504):
                    raise
                last_error = exc
            delay = self.base_delay * (attempt + 1)
            print(f"  … تعذّر الاتصال، إعادة بعد {delay:.0f}ث", file=sys.stderr)
            time.sleep(delay)
        raise SystemExit(f"فشل الاتصال بعد {self.retries} محاولات: {last_error}")

    def execute(self, model, method, args, kwargs=None):
        if method in WRITE_METHODS and not self.allow_write:
            raise RuntimeError(
                f"محاولة كتابة ({model}.{method}) في وضع المعاينة — مرّر --apply للتنفيذ."
            )
        return self._retry(self._models.execute_kw, self.db, self.uid, self.api_key,
                           model, method, args, kwargs or {})


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


def resolve_parent_view(client, target):
    """يحدّد العرض الأب بالمعرّف الخارجيّ أولاً ثم بالمفتاح.

    معرّف Studio يحمل UUID خاصاً بكل قاعدة بيانات، فالرجوع إلى ``key`` ضروريّ؛
    ونرفض الاستمرار عند التباس النتيجة بدل التخمين.
    """
    data = client.execute("ir.model.data", "search_read",
                          [[("module", "=", target["parent_xmlid"].split(".", 1)[0]),
                            ("name", "=", target["parent_xmlid"].split(".", 1)[1]),
                            ("model", "=", "ir.ui.view")]],
                          {"fields": ["res_id"], "limit": 2})
    if len(data) == 1:
        return data[0]["res_id"]

    views = client.execute("ir.ui.view", "search_read",
                           [[("key", "=", target["parent_key"]), ("type", "=", "qweb")]],
                           {"fields": ["id", "name", "inherit_id"]})
    if len(views) == 1:
        print(f"  المعرّف الخارجيّ غير موجود؛ استُخدم المفتاح {target['parent_key']} "
              f"⇒ view {views[0]['id']}")
        return views[0]["id"]
    raise SystemExit(
        f"تعذّر تحديد العرض الأب لهدف '{target['parent_key']}' بشكل قاطع "
        f"({len(views)} مرشّح) — حدّده يدوياً بـ --parent-id."
    )


def find_existing(client, key):
    return client.execute("ir.ui.view", "search_read", [[("key", "=", key)]],
                          {"fields": ["id", "name", "active", "inherit_id"]})


def do_deploy(client, target, parent_id, apply_changes):
    existing = find_existing(client, target["key"])
    if existing:
        print(f"العرض موجود مسبقاً (id={existing[0]['id']}, active={existing[0]['active']}) "
              f"— لا شيء لفعله. للتراجع استخدم --rollback.")
        return

    values = {
        "name": target["name"],
        "key": target["key"],
        "type": "qweb",
        "mode": "extension",
        "inherit_id": parent_id,
        "arch_db": ARCH_TEMPLATE,
        "active": True,
    }
    print("\nسيُنشأ سجلّ ir.ui.view التالي:")
    for field, value in values.items():
        printable = value if field != "arch_db" else "<انظر أدناه>"
        print(f"  {field:<12}: {printable}")
    print(ARCH_TEMPLATE)

    if not apply_changes:
        print("\n[معاينة] لم يُكتب شيء. أعد التشغيل مع --apply للتنفيذ.")
        return
    view_id = client.execute("ir.ui.view", "create", [values])
    print(f"\nتم الإنشاء: ir.ui.view id={view_id} (key={target['key']})")
    print("تحقّق الآن بطباعة فاتورة متأثّرة، ثم شغّل verify_qr_print.py.")


def do_rollback(client, target, apply_changes, view_id):
    existing = ([{"id": view_id}] if view_id
                else find_existing(client, target["key"]))
    if not existing:
        print(f"لا يوجد عرض بالمفتاح {target['key']} — لا شيء للتراجع عنه.")
        return
    ids = [view["id"] for view in existing]
    print(f"سيُحذف ir.ui.view: {ids}")
    if not apply_changes:
        print("[معاينة] لم يُحذف شيء. أعد التشغيل مع --apply للتنفيذ.")
        return
    client.execute("ir.ui.view", "unlink", [ids])
    print(f"تم الحذف: {ids} — عادت الطباعة إلى سلوكها السابق فوراً.")


def main():
    parser = argparse.ArgumentParser(
        description="نشر/تراجع إصلاح رمز JoFotara عبر XML-RPC (معاينة افتراضياً)")
    parser.add_argument("--env-file",
                        default=os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                             os.pardir, ".odoo_env"))
    parser.add_argument("--target", choices=sorted(TARGETS), default="base",
                        help="القالب المستهدَف: base (القياسيّ) أو studio")
    parser.add_argument("--parent-id", type=int,
                        help="معرّف العرض الأب يدوياً عند تعذّر تحديده آلياً")
    parser.add_argument("--rollback", action="store_true", help="احذف العرض المنشور")
    parser.add_argument("--view-id", type=int, help="معرّف العرض المطلوب حذفه (مع --rollback)")
    parser.add_argument("--apply", action="store_true",
                        help="نفّذ فعلاً — بدونه لا تُجرى أي كتابة")
    args = parser.parse_args()

    if args.view_id and not args.rollback:
        parser.error("--view-id لا يُستعمل إلا مع --rollback")

    env = load_env(os.path.normpath(args.env_file))
    client = OdooClient(env["ODOO_URL"], env["ODOO_DB"], env["ODOO_LOGIN"],
                        env["ODOO_API_KEY"], allow_write=args.apply)
    mode = "تنفيذ" if args.apply else "معاينة"
    print(f"[{mode}] متصل بـ {env['ODOO_URL']} (db={env['ODOO_DB']}, uid={client.uid})")

    target = TARGETS[args.target]
    if args.rollback:
        do_rollback(client, target, args.apply, args.view_id)
        return
    parent_id = args.parent_id or resolve_parent_view(client, target)
    print(f"العرض الأب: id={parent_id} ({target['parent_key']})")
    do_deploy(client, target, parent_id, args.apply)


if __name__ == "__main__":
    main()
