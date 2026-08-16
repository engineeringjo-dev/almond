# Runbook — معالجة تنبيهات ALMOND (2026-08-16)

**المالك:** حمزة · **البيئتان:** أودو ١٩ إنتاج (`ag-almond-coffee-house.odoo.com`) + تطبيق Vercel (مشروع **`almondjo`**).
**المصدر:** تحقيق فريق خبراء (أودو/Vercel/بايثون/مالي/جرد) على كود الإنتاج `production-almond@main`.

> ⚠️ حوكمة: كلّ كتابة على أودو الإنتاج تحتاج **`APPROVE PROD`** حرفياً من حمزة في الجلسة نفسها.
> السكربتات تعمل بـ**dry-run افتراضيّ**؛ لقطة/باكاب قبل أيّ لمس؛ تدقيق في `PROD_AUDIT.jsonl`.
> هذه الحاوية **بلا أودو حيّ** — التنفيذ يتمّ في بيئة الديف/الجلسة المخوّلة.

---

## حالة الخطوات

| # | الخطوة | النوع | الحالة |
|---|---|---|---|
| ١ | إيقاف الإنذار الليليّ الكاذب (فصل «بانتظار موافقة» عن «فشل») | كود `production-almond` | ✅ منجز — فرع `fix/waste-approval-not-failure` (اختبارات ٢٤٩٨/٢٤٩٨ · tsc/eslint نظيف). بانتظار دفع/PR. |
| ٢ | حسم جذر الموافقة على `stock.scrap` | إعداد أودو | ⏳ يحتاج introspection حيّ + `APPROVE PROD` (أدناه). |
| ٣ | تصفية تراكم مسودّات الإتلاف العالقة | سكربت ops | 🟡 جاهز: `scripts/scrapfix_batch.py` (dry-run). |
| ٤ | تصحيح تضخّم وحدات القياس (~٧٦٠ك) | بيانات | ⏳ قرار المالك/إيهاب — ملف `UOM_Inventory_Inflation_2026-07-31.xlsx`. **قبل الخطوة ٥.** |
| ٥ | ضبط حسابات التقييم على ٤ مواقع | إعداد أودو | ⏳ **قبل أيّ MRP** — يحتاج introspection حيّ + `APPROVE PROD` (أدناه). |
| ٦ | المحمص — ٩ أصناف قاربت الصلاحية | تشغيليّ | ⏳ يحتاج القائمة الحيّة (بيع سريع / سحب للكولد برو). |

**التسلسل المالي الإلزاميّ:** ٤ (UoM) → ٥ (التقييم) → تفعيل MRP.

---

## الخطوة ٢ — حسم جذر الموافقة (studio.approval على `stock.scrap`)

**الجذر:** قاعدة موافقة من Odoo Studio تعترض `stock.scrap.action_validate`؛ النداء الآليّ لا يمرّ بخطوة الموافقة، فيبقى الـscrap draft ويردّ أودو «Some approvals are missing».

### أ) تحقّق (قراءة فقط — بلا `APPROVE PROD`)
```
# اقرأ قاعدة/قواعد الموافقة المستهدِفة stock.scrap:
studio.approval.rule  search_read
  domain=[['model_id.model','=','stock.scrap']]
  fields=['method','action_id','group_id','exclusive_user','domain','company_id','users_to_notify']
# تأكّد: هل uid=41 (ALMOND API) ضمن group_id؟ وهل exclusive_user=True؟ ونطاق الشركات؟
# حدّد أيضاً هويّة السطر المخزَّن العالق: أهو خامٌ فعلاً أم تامٌّ مُصنَّفٌ is_storable=true خطأً؟
```

### ب) الإصلاح المُوصى به — **A2 (الجرّاحيّ)** — يحتاج `APPROVE PROD`
تضييق نطاق القاعدة لتستثني الـscrap الآليّ، مع إبقاء البوّابة لليدويّ:
```
# أضِف إلى domain القاعدة استثناءً للمرجع الآليّ (origin يبدأ WASTE-) أو create_uid=ALMOND:
studio.approval.rule  write [[rule_id], {'domain': "<القديم> AND origin NOT LIKE 'WASTE-%'"}]
# ثمّ تحقّق: أنشئ/أعد مصادقة scrap آليّ تجريبيّ ⇒ يجب أن يصل done بلا إشعار موافقة.
```
البدائل: **A1** حذف/تعطيل القاعدة (إن كان الاعتماد البشريّ زائداً) · **B** إبقاء البوّابة + منح uid=41 المجموعة و`exclusive_user=False` ثمّ استدعاء `set_approval` برمجياً قبل التصديق (يربط الكود بـAPI enterprise — أقلّ نظافة).

> بعد A2/A1، شغّل الخطوة ٣ لتصفية العالق؛ ستُصادَق سطور الخام تلقائياً.

---

## الخطوة ٣ — تصفية مسودّات الإتلاف العالقة (`scrapfix_batch.py`)

يُصنّف ويصفّي مسودّات `stock.scrap` بأصل `WASTE-*`:
- **untracked** (`is_storable=false`) ⇒ سندٌ ميّت ⇒ يُلغى بعد لقطة (تنظيف ~٤٤٨).
- **approval** (مخزَّن + رصيدٌ كافٍ) ⇒ يُحاوَل تصديقه؛ إن بقي على الموافقة يُترَك ويُعلَن (لا يُطمَس).
- **negative** (مخزَّن + رصيدٌ غير كافٍ) ⇒ `needs_human` (صحّح المخزون أولاً — لا يُعالَج آلياً).

```
export SCRATCH=/path/to/scratchpad/            # يحوي .odoo_env (ODOO_URL/DB/LOGIN/API_KEY)
python3 scripts/scrapfix_batch.py 500 4        # جولة تخطيط DRY-RUN — راجِع القوائم في scrapfix_state.json
APPROVE=PROD python3 scripts/scrapfix_batch.py 500 4   # تنفيذ فعليّ (بعد موافقة المالك)؛ كرّر حتى remaining≈0
```
المخرجات: `scrapfix_state.json` (cancelled/validated/approval/needs_human/fail) · `scrapfix_backups.jsonl` (لقطات) · `PROD_AUDIT.jsonl` (تدقيق) · `scrapfix.log`.

> **جرّب DRY-RUN أولاً دائماً**، وراجِع قائمة `would-unlink-untracked` قبل التنفيذ. لا حذف بلا لقطة.

---

## الخطوة ٥ — حسابات التقييم على المواقع الأربعة (قبل MRP)

**الخطر:** موقعٌ `is_valued_external=true` وحسابه فارغ ⇒ أودو ١٩ يتخطّى قيد اليوميّة **بصمت** ⇒ ينحرف الدفتر عن المخزون (سابقة: موقع عبور id 3 مرّر ~١٣٧٬١٩٦ د.أ بلا قيد). نائم الآن (٠ حركة) لكنه ينفجر عند أوّل حركة إنتاج.

### أ) تحقّق (قراءة فقط)
```
# لقطة حارس التقييم (production-almond): getValuationGuardSnapshot ⇒ هويّة المواقع الأربعة (usage/company).
# لكلّ موقع: stock.location read ['usage','valuation_in_account_id','valuation_out_account_id'] (أو حقول v19).
```
### ب) الإصلاح — يحتاج `APPROVE PROD`
اضبط حساب التقييم حسب الاستعمال (transit/inventory/production) لكلّ شركة، أو ألغِ `is_valued_external` إن لم يستحقّ الموقع تقييماً خارجيّاً (فيستعمل حسابات فئة المنتج). ثمّ أعِد فحص الحارس حتى `configGap → 0`.
> **لا تضبط التقييم قبل تصحيح UoM (الخطوة ٤)** وإلّا رُحِّلت قيودٌ منتفخة ×٥٠–×١٠٠٠ في الأستاذ.

---

## مراجع
- التقرير الموحّد (Artifact): تشريح تنبيهات ALMOND — 2026-08-16.
- كود الجذر: `production-almond@main` → `src/services/odoo/daily-export.ts` (`pushBranchWaste`, `scrapRefusalReason`, `splitWasteByTracking`, `wasteStepResult`) · `src/services/monitor/alerts.ts` (`odooExportFailure`, `scrapApprovalPending`, `valuationLeakAlert`).
- النمط المرجعيّ لسكربتات ops: `docs/maintenance/2026-08-02/scripts/negfix_batch.py`.
