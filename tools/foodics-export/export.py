#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ALMOND — حزمةُ تصديرٍ من أودو ١٩ إلى Foodics. **قراءةٌ فقط، صفرُ كتابة.**

    python3 tools/foodics-export/export.py --out ./foodics_export

## مبدآن يحكمان كلَّ سطرٍ هنا

**١) كلُّ صفٍّ يحمل `odoo_id` و`odoo_model`.** الاستيرادُ بلا مرجعٍ عكسيٍّ رحلةٌ باتّجاهٍ واحد:
لا تُطابِق، ولا تُصحِّح، ولا تعرف ما سقط. القوالبُ النهائيّة لـFoodics تُشتقّ من هذه الملفّات
بحذف عمودٍ أو إعادة تسميته — أمّا المرجعُ فيبقى.

**٢) الشركاتُ الأربع لا تُدمَج.** مكلَّفون مستقلّون بأرقامٍ ضريبيّةٍ منفصلة والتقاصُّ بينها
ممنوع، فكلُّ ملفٍّ يحمل عمودَ `company` وكلُّ عدٍّ يُفصَّل بها.

## قرارا تحويلٍ لا يُؤخَذان ضمناً

- **المتغيّرات ← مُعدِّلات.** ٤٧٣ صنفاً تُنتج ١٠٬٩٠١ متغيّراً في أودو؛ نقلُها ١:١ يُفجّر منيو
  Foodics إلى عشرة آلاف صنف. فيُصدَّر **الصنفُ مرّةً** (`menu_items`) و**الخصائصُ مجموعاتِ
  خياراتٍ منفصلة** (`modifiers`) — وربطُهما في `menu_item_modifiers`.
- **وصفاتُ `phantom` مُعلَّمة.** ٦٤٩ من ١٬١٨٣ تنفجر لحظةَ البيع لا في أمر تصنيع، ودلالتُها في
  Foodics مختلفة. العمودُ `bom_type` يُبقي القرارَ ظاهراً بدل أن يُطمَس في التسوية.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from odoo_ro import OdooReadOnly
import csvout


def _m2o(v, idx=1):
    """(id, name) من أودو → الاسم أو المعرّف أو فراغ."""
    if not v:
        return ""
    return v[idx] if isinstance(v, (list, tuple)) and len(v) > idx else v


def _id(v):
    return v[0] if isinstance(v, (list, tuple)) and v else ""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="./foodics_export")
    args = ap.parse_args()
    out = Path(args.out)

    o = OdooReadOnly()
    print(f"\n🔌 أودو {o.version} · uid={o.uid} · قراءةٌ فقط")
    print(f"📁 المخرَج: {out.resolve()}\n")

    companies = {c["id"]: c for c in o.read_all(
        "res.company", [], ["name", "vat", "currency_id"])}
    comp = lambda cid: companies.get(cid, {}).get("name", "")

    # ── ١) الفروع ─────────────────────────────────────────────────────
    print("═══ ١) الفروع والصناديق ═══")
    cfgs = o.read_all("pos.config", [], ["name", "company_id", "active"])
    csvout.write(out, "01_branches.csv",
        ["odoo_id", "register_name", "company", "company_vat", "active", "odoo_model"],
        [[c["id"], c["name"], comp(_id(c["company_id"])),
          companies.get(_id(c["company_id"]), {}).get("vat", ""),
          "yes" if c.get("active") else "no", "pos.config"] for c in cfgs])

    # ── ٢) فئاتُ المنيو ───────────────────────────────────────────────
    print("═══ ٢) فئاتُ المنيو ═══")
    cats = o.read_all("pos.category", [], ["name", "parent_id", "sequence"])
    csvout.write(out, "02_menu_categories.csv",
        ["odoo_id", "category_name", "parent_category", "sequence", "odoo_model"],
        [[c["id"], c["name"], _m2o(c.get("parent_id")), c.get("sequence") or 0,
          "pos.category"] for c in sorted(cats, key=lambda r: (r.get("sequence") or 0, r["id"]))])

    # ── ٣) أصنافُ المنيو (قالبٌ واحدٌ لكلّ صنف — لا متغيّرات) ─────────
    print("═══ ٣) أصنافُ المنيو ═══")
    tmpl = o.read_all("product.template", [["available_in_pos", "=", True]],
        ["name", "list_price", "standard_price", "pos_categ_ids", "categ_id",
         "default_code", "barcode", "uom_id", "taxes_id", "company_id",
         "active", "type", "product_variant_count"])
    taxes = {t["id"]: t for t in o.read_all("account.tax", [], ["name", "amount", "price_include_override"])}
    tax_label = lambda ids: " | ".join(
        f"{taxes[i]['name']} ({taxes[i]['amount']}%{', شامل' if taxes[i].get('price_include_override') == 'tax_included' else ''})"
        for i in (ids or []) if i in taxes)
    csvout.write(out, "03_menu_items.csv",
        ["odoo_id", "item_name", "sku", "barcode", "sale_price", "cost",
         "pos_categories", "internal_category", "uom", "taxes", "company",
         "variant_count", "active", "odoo_model"],
        [[t["id"], t["name"], t.get("default_code") or "", t.get("barcode") or "",
          t.get("list_price") or 0, t.get("standard_price") or 0,
          " | ".join(str(x) for x in (t.get("pos_categ_ids") or [])),
          _m2o(t.get("categ_id")), _m2o(t.get("uom_id")), tax_label(t.get("taxes_id")),
          comp(_id(t.get("company_id"))) or "(كلُّ الشركات)",
          t.get("product_variant_count") or 1,
          "yes" if t.get("active") else "no", "product.template"] for t in tmpl])

    # ── ٤) المُعدِّلات (الخصائصُ وقيمُها) ─────────────────────────────
    print("═══ ٤) المُعدِّلات ═══")
    attrs = {a["id"]: a for a in o.read_all("product.attribute", [], ["name", "display_type", "create_variant"])}
    vals = o.read_all("product.attribute.value", [], ["name", "attribute_id", "sequence"])
    csvout.write(out, "04_modifiers.csv",
        ["odoo_id", "modifier_group", "option_name", "display_type",
         "creates_variant", "sequence", "odoo_model"],
        [[v["id"], _m2o(v.get("attribute_id")), v["name"],
          attrs.get(_id(v.get("attribute_id")), {}).get("display_type", ""),
          attrs.get(_id(v.get("attribute_id")), {}).get("create_variant", ""),
          v.get("sequence") or 0, "product.attribute.value"] for v in vals])

    lines = o.read_all("product.template.attribute.line", [], ["product_tmpl_id", "attribute_id", "value_ids"])
    tmpl_ids = {t["id"] for t in tmpl}
    csvout.write(out, "05_menu_item_modifiers.csv",
        ["odoo_id", "item_odoo_id", "item_name", "modifier_group", "option_count", "odoo_model"],
        [[l["id"], _id(l["product_tmpl_id"]), _m2o(l["product_tmpl_id"]),
          _m2o(l.get("attribute_id")), len(l.get("value_ids") or []),
          "product.template.attribute.line"]
         for l in lines if _id(l["product_tmpl_id"]) in tmpl_ids])

    # ── ٦) أصنافُ المخزون ─────────────────────────────────────────────
    print("═══ ٦) أصنافُ المخزون ═══")
    inv = o.read_all("product.template", [["type", "=", "consu"]],
        ["name", "default_code", "barcode", "uom_id", "uom_po_id", "standard_price",
         "categ_id", "company_id", "active", "available_in_pos"])
    csvout.write(out, "06_inventory_items.csv",
        ["odoo_id", "item_name", "sku", "barcode", "stock_uom", "purchase_uom",
         "cost", "category", "company", "sold_in_pos", "active", "odoo_model"],
        [[t["id"], t["name"], t.get("default_code") or "", t.get("barcode") or "",
          _m2o(t.get("uom_id")), _m2o(t.get("uom_po_id")), t.get("standard_price") or 0,
          _m2o(t.get("categ_id")), comp(_id(t.get("company_id"))) or "(كلُّ الشركات)",
          "yes" if t.get("available_in_pos") else "no",
          "yes" if t.get("active") else "no", "product.template"] for t in inv])

    # ── ٧) الوصفات ────────────────────────────────────────────────────
    print("═══ ٧) الوصفات ═══")
    boms = {b["id"]: b for b in o.read_all("mrp.bom", [],
        ["product_tmpl_id", "product_qty", "type", "code", "company_id", "product_uom_id"])}
    blines = o.read_all("mrp.bom.line", [], ["bom_id", "product_id", "product_qty", "product_uom_id"])
    rows = []
    for l in blines:
        b = boms.get(_id(l.get("bom_id")))
        if not b:
            continue
        rows.append([l["id"], _id(l["bom_id"]), _m2o(b.get("product_tmpl_id")),
                     b.get("product_qty") or 1, _m2o(b.get("product_uom_id")),
                     b.get("type") or "", _m2o(l.get("product_id")),
                     l.get("product_qty") or 0, _m2o(l.get("product_uom_id")),
                     comp(_id(b.get("company_id"))) or "(كلُّ الشركات)", "mrp.bom.line"])
    csvout.write(out, "07_recipes.csv",
        ["odoo_id", "bom_odoo_id", "produces_item", "yield_qty", "yield_uom",
         "bom_type", "ingredient", "ingredient_qty", "ingredient_uom", "company", "odoo_model"],
        rows)

    # ── ٨) المخزونُ الافتتاحيّ ────────────────────────────────────────
    print("═══ ٨) المخزونُ الافتتاحيّ ═══")
    quants = o.read_all("stock.quant", [["quantity", "!=", 0]],
        ["product_id", "location_id", "quantity", "company_id", "inventory_date"])
    locs = {l["id"]: l for l in o.read_all("stock.location", [],
        ["complete_name", "usage", "warehouse_id"])}
    csvout.write(out, "08_opening_stock.csv",
        ["odoo_id", "item", "item_odoo_id", "location", "location_usage",
         "warehouse", "qty", "company", "odoo_model"],
        [[q["id"], _m2o(q.get("product_id")), _id(q.get("product_id")),
          locs.get(_id(q.get("location_id")), {}).get("complete_name", _m2o(q.get("location_id"))),
          locs.get(_id(q.get("location_id")), {}).get("usage", ""),
          _m2o(locs.get(_id(q.get("location_id")), {}).get("warehouse_id")),
          q.get("quantity") or 0, comp(_id(q.get("company_id"))), "stock.quant"]
         for q in quants])

    # ── ٩) المورّدون ──────────────────────────────────────────────────
    print("═══ ٩) المورّدون ═══")
    sup = o.read_all("res.partner", [["supplier_rank", ">", 0]],
        ["name", "vat", "phone", "mobile", "email", "street", "city",
         "company_id", "active", "property_supplier_payment_term_id"])
    csvout.write(out, "09_suppliers.csv",
        ["odoo_id", "supplier_name", "vat", "phone", "mobile", "email",
         "street", "city", "payment_term", "company", "active", "odoo_model"],
        [[p["id"], p["name"], p.get("vat") or "", p.get("phone") or "",
          p.get("mobile") or "", p.get("email") or "", p.get("street") or "",
          p.get("city") or "", _m2o(p.get("property_supplier_payment_term_id")),
          comp(_id(p.get("company_id"))) or "(كلُّ الشركات)",
          "yes" if p.get("active") else "no", "res.partner"] for p in sup])

    si = o.read_all("product.supplierinfo", [],
        ["partner_id", "product_tmpl_id", "product_id", "price", "min_qty",
         "delay", "currency_id", "company_id"])
    csvout.write(out, "10_supplier_prices.csv",
        ["odoo_id", "supplier", "item", "price", "min_qty", "lead_days",
         "currency", "company", "odoo_model"],
        [[s["id"], _m2o(s.get("partner_id")),
          _m2o(s.get("product_id")) or _m2o(s.get("product_tmpl_id")),
          s.get("price") or 0, s.get("min_qty") or 0, s.get("delay") or 0,
          _m2o(s.get("currency_id")), comp(_id(s.get("company_id"))) or "(كلُّ الشركات)",
          "product.supplierinfo"] for s in si])

    # ── ١١) وحداتُ القياس ─────────────────────────────────────────────
    print("═══ ١١) وحداتُ القياس ═══")
    uoms = o.read_all("uom.uom", [], ["name", "factor", "rounding", "uom_type", "relative_uom_id"])
    csvout.write(out, "11_uom.csv",
        ["odoo_id", "uom_name", "type", "factor", "rounding", "reference_uom", "odoo_model"],
        [[u["id"], u["name"], u.get("uom_type") or "", u.get("factor") or 1,
          u.get("rounding") or 0, _m2o(u.get("relative_uom_id")), "uom.uom"] for u in uoms])

    # ── التحقّق ───────────────────────────────────────────────────────
    print("\n═══ تقريرُ التحقّق ═══")
    written = csvout.summary()
    checks = []
    for model, dom, fname in [
        ("pos.config", [], "01_branches.csv"),
        ("pos.category", [], "02_menu_categories.csv"),
        ("product.template", [["available_in_pos", "=", True]], "03_menu_items.csv"),
        ("product.attribute.value", [], "04_modifiers.csv"),
        ("product.template", [["type", "=", "consu"]], "06_inventory_items.csv"),
        ("mrp.bom.line", [], "07_recipes.csv"),
        ("stock.quant", [["quantity", "!=", 0]], "08_opening_stock.csv"),
        ("res.partner", [["supplier_rank", ">", 0]], "09_suppliers.csv"),
        ("product.supplierinfo", [], "10_supplier_prices.csv"),
        ("uom.uom", [], "11_uom.csv"),
    ]:
        live = o.count(model, dom)
        got = dict(written).get(fname, 0)
        ok = live == got
        checks.append({"file": fname, "model": model, "odoo": live, "csv": got, "match": ok})
        print(f"  {'✅' if ok else '🚩'} {fname:26} أودو {live:>8,} → CSV {got:>8,}"
              + ("" if ok else "  ← فرق!"))

    stock_by_company: dict[str, float] = {}
    for q in quants:
        stock_by_company[comp(_id(q.get("company_id")))] = \
            stock_by_company.get(comp(_id(q.get("company_id"))), 0) + (q.get("quantity") or 0)
    print("\n  مجموعُ الكمّيّات لكلّ شركة (طابِقه بعد الاستيراد):")
    for c, v in sorted(stock_by_company.items(), key=lambda x: -x[1]):
        print(f"    {c[:38]:38} {v:>14,.3f}")

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "odoo_version": o.version, "odoo_db": o.db, "uid": o.uid,
        "mode": "READ ONLY - no write method is reachable from this tool",
        "companies": [{"id": c["id"], "name": c["name"], "vat": c.get("vat")}
                      for c in companies.values()],
        "files": [{"name": n, "rows": r} for n, r in written],
        "verification": checks,
        "stock_qty_by_company": stock_by_company,
        "notes": [
            "المتغيّراتُ لم تُصدَّر ١:١ — الصنفُ مرّةً والخصائصُ مجموعاتِ خيارات (03/04/05).",
            "وصفاتُ phantom مُعلَّمةٌ بعمود bom_type — دلالتُها في Foodics مختلفة.",
            "الشركاتُ الأربع مكلَّفون مستقلّون: لا تُدمَج عند الاستيراد.",
            "لا محاسبةَ هنا: الحسابات/القيود/الذمم لا مكانَ لها في Foodics.",
            "الـ39,565 XML الضريبيّ أرشيفٌ قانونيٌّ منفصل — لا يُستورَد ولا يُحذَف.",
        ],
    }
    (out / "_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    bad = [c for c in checks if not c["match"]]
    print(f"\n📄 _manifest.json — {len(written)} ملفّاً")
    print("✅ كلُّ الأعداد تطابق أودو." if not bad
          else f"🚩 {len(bad)} ملفّاً لا يطابق — راجِعه قبل الاستيراد.")
    print("ℹ️  قراءةٌ فقط — لم يُكتب شيءٌ على الإنتاج.\n")


if __name__ == "__main__":
    main()
