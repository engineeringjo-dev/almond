# -*- coding: utf-8 -*-
"""خطّاف ما بعد التثبيت: تغطية تقرير Studio وتنظيف الإصلاح المؤقّت.

كلّ ما هنا يخصّ سجلّات **غير مضمونة الوجود** في قاعدة البيانات، ولذلك لا يمكن
التعبير عنه في ملف بيانات XML: أي ``ref=`` إلى سجلّ Studio مفقود يُفشل التثبيت
كلّه. الخطّاف يفحص أولاً ثم يتصرّف، ويسجّل سبب أي تخطٍّ بدل ابتلاعه صامتاً.
"""

import logging

_logger = logging.getLogger(__name__)

MODULE = "almond_jo_pos_qr_print"

# ------------------------------------------------------------------
# تقرير Studio
# ------------------------------------------------------------------
# نسخة Studio من قالب الفاتورة "مسطّحة" (inherit_id = False)، أي أنها لا ترث
# ``account.report_invoice_document`` ⇒ العرض الوراثيّ في ملف XML لا يصلها إطلاقاً
# وتبقى تطبع بلا رمز. لذلك نضيف لها عرضاً وراثياً خاصاً بها.
# نسخة Studio الأردنيّة (``l10n_jo_edi.report_invoice_document_copy_1``) مستثناة
# عمداً: كتلة الرمز الأردنيّة منسوخة داخلها أصلاً، وإضافتنا هناك تُنتج تكراراً.
STUDIO_FLAT_VIEW_XMLID = (
    "studio_customization.report_invoice_docum_206c2d13-c1e0-4a9e-b00b-92409ad527e2"
)
STUDIO_FLAT_VIEW_KEY = "account.report_invoice_document_copy_1"
STUDIO_PATCH_NAME = "report_invoice_document_copy_1_jo_fallback_qr"

STUDIO_PATCH_ARCH = """<data>
    <xpath expr="//div[@id='qrcode']" position="after">
        <t t-call="almond_jo_pos_qr_print.jo_fallback_qr_block"/>
    </xpath>
</data>"""

# ------------------------------------------------------------------
# الإصلاح المؤقّت المنشور عبر XML-RPC
# ------------------------------------------------------------------
# ``deploy_view_via_rpc.py`` ينشر عرضاً مكافئاً بمحتوى مضمّن حين يتعذّر نشر وحدة.
# لو بقي مفعّلاً بعد تثبيت الوحدة لطُبع الرمز مرّتين، فنعطّله (لا نحذفه) ليبقى
# أثره ظاهراً لمن يراجع. البادئة تغطّي هدفَي السكربت: القياسيّ ونسخة Studio.
RPC_HOTFIX_KEY_PREFIX = "almond_jo_pos_qr_print.rpc_hotfix_jo_qr"


def _resolve_studio_flat_view(env):
    """يُرجع عرض Studio المسطّح للفاتورة، أو None مع تسجيل السبب.

    نبدأ بالمعرّف الخارجيّ لأنه الأدقّ، ثم نرجع إلى ``key`` لأن معرّف Studio
    يحمل UUID يختلف بين قواعد البيانات.
    """
    view = env.ref(STUDIO_FLAT_VIEW_XMLID, raise_if_not_found=False)
    if view and view._name == "ir.ui.view":
        return view

    candidates = env["ir.ui.view"].search([
        ("key", "=", STUDIO_FLAT_VIEW_KEY),
        ("type", "=", "qweb"),
        ("inherit_id", "=", False),
    ])
    if len(candidates) == 1:
        _logger.info(
            "%s: عُثر على قالب Studio بالمفتاح %s (id=%s) بعد فشل المعرّف الخارجيّ.",
            MODULE, STUDIO_FLAT_VIEW_KEY, candidates.id,
        )
        return candidates
    if len(candidates) > 1:
        _logger.warning(
            "%s: وُجد %s قالب Studio بالمفتاح %s — تُرك بلا تعديل لتفادي اختيار الخطأ. "
            "عالِجها يدوياً أو عبر deploy_view_via_rpc.py --target studio --view-id <id>.",
            MODULE, len(candidates), STUDIO_FLAT_VIEW_KEY,
        )
    return None


def _patch_studio_invoice_view(env):
    """يضيف كتلة الرمز إلى قالب Studio المسطّح إن وُجد."""
    if env.ref(f"{MODULE}.{STUDIO_PATCH_NAME}", raise_if_not_found=False):
        return  # التثبيت مكرّر أو أُعيد تشغيل الخطّاف يدوياً

    studio_view = _resolve_studio_flat_view(env)
    if not studio_view:
        _logger.info(
            "%s: لا يوجد قالب فاتورة من Studio — التقارير القياسية مغطّاة بملف XML وحده.",
            MODULE,
        )
        return

    patch = env["ir.ui.view"].create({
        "name": "Studio invoice: JoFotara QR fallback",
        "type": "qweb",
        "mode": "extension",
        "inherit_id": studio_view.id,
        "key": f"{MODULE}.{STUDIO_PATCH_NAME}",
        "arch": STUDIO_PATCH_ARCH,
    })
    # noupdate=True يمنع أودو من اعتبار السجلّ "يتيماً" وحذفه عند أي ترقية لاحقة،
    # لأنه غير معرَّف في ملفات بيانات الوحدة. ويبقى مرتبطاً بالوحدة فيُحذف مع إلغاء تثبيتها.
    env["ir.model.data"].create({
        "module": MODULE,
        "name": STUDIO_PATCH_NAME,
        "model": "ir.ui.view",
        "res_id": patch.id,
        "noupdate": True,
    })
    _logger.info(
        "%s: أُضيف الرمز إلى قالب Studio (view %s ⇐ patch %s).",
        MODULE, studio_view.id, patch.id,
    )


def _disable_rpc_hotfix_view(env):
    """يعطّل العرض المؤقّت المنشور عبر RPC لمنع ازدواج الرمز."""
    hotfix = env["ir.ui.view"].search([("key", "=like", RPC_HOTFIX_KEY_PREFIX + "%")])
    if not hotfix:
        return
    hotfix.filtered("active").write({"active": False})
    _logger.warning(
        "%s: عُطِّل الإصلاح المؤقّت (keys=%s, ids=%s) لأن الوحدة تؤدي الغرض نفسه. "
        "احذفه يدوياً بعد التأكد من الطباعة.",
        MODULE, hotfix.mapped("key"), hotfix.ids,
    )


def post_init_hook(env):
    """توقيع أودو 17+ : يستقبل ``env`` جاهزاً بصلاحيات المثبِّت."""
    _disable_rpc_hotfix_view(env)
    _patch_studio_invoice_view(env)
