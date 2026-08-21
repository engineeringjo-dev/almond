# -*- coding: utf-8 -*-
"""عميلُ أودو **للقراءة فقط** — يرفض أيّ نداءٍ يكتب، بنيويّاً لا بالنيّة.

الحارس: قائمةُ سماحٍ للأساليب (`allow-list`) لا قائمةَ منع. أيُّ أسلوبٍ خارجها يُلقي
`PermissionError` قبل أن يغادر النداءُ العمليّة — فسهوُ كاتبِ سكربتٍ لاحقاً لا يصير كتابةً
على إنتاجٍ يبيع.
"""
import os
import xmlrpc.client as xc

READ_ONLY_METHODS = frozenset({
    "search", "read", "search_read", "search_count", "read_group",
    "fields_get", "default_get", "name_search", "name_get",
})


class OdooReadOnly:
    def __init__(self) -> None:
        missing = [k for k in ("ODOO_URL", "ODOO_DB", "ODOO_LOGIN", "ODOO_API_KEY")
                   if not os.environ.get(k)]
        if missing:
            raise SystemExit("⛔ متغيّراتُ بيئةٍ ناقصة: " + ", ".join(missing))
        self.url = os.environ["ODOO_URL"].rstrip("/")
        self.db = os.environ["ODOO_DB"]
        key = os.environ["ODOO_API_KEY"]
        self._key = key
        common = xc.ServerProxy(f"{self.url}/xmlrpc/2/common", allow_none=True)
        self.version = common.version().get("server_version")
        self.uid = common.authenticate(self.db, os.environ["ODOO_LOGIN"], key, {})
        if not self.uid:
            raise SystemExit("⛔ فشلت المصادقة — راجِع ODOO_LOGIN/ODOO_API_KEY.")
        self._obj = xc.ServerProxy(f"{self.url}/xmlrpc/2/object", allow_none=True)
        # سياقٌ إلزاميّ: الشركاتُ الأربع مكلَّفون مستقلّون — إسقاطُ إحداها يُنتج تصديراً ناقصاً صامتاً.
        self.ctx = {"allowed_company_ids": [1, 2, 3, 4], "active_test": False}

    def call(self, model: str, method: str, args, opts=None):
        if method not in READ_ONLY_METHODS:
            raise PermissionError(
                f"⛔ «{method}» ليس أسلوبَ قراءة. هذه الأداةُ لا تكتب على الإنتاج."
            )
        o = dict(opts or {})
        o["context"] = {**self.ctx, **o.get("context", {})}
        return self._obj.execute_kw(self.db, self.uid, self._key, model, method, args, o)

    def count(self, model: str, domain=None) -> int:
        return self.call(model, "search_count", [domain or []])

    def read_all(self, model: str, domain, fields, order="id", page=2000):
        """كلُّ الصفوف بترقيمِ صفحاتٍ — لا حدَّ ١٠٠٠ الصامت الذي يقصّ التصدير."""
        out, offset = [], 0
        while True:
            rows = self.call(model, "search_read", [domain or []],
                             {"fields": fields, "limit": page, "offset": offset, "order": order})
            out.extend(rows)
            if len(rows) < page:
                return out
            offset += page
