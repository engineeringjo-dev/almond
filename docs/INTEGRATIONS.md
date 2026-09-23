# الربط مع الأنظمة — Integrations

<div dir="rtl">

**لمن:** فريق أشبك (Ishbek) الذي سيأخذ المشروع إلى الإنتاج. **الحالة بتاريخ:** 2026-09-23.

هذه الصفحة تجمع كلّ نقطة ربطٍ بين هذا المستودع والعالم الخارجيّ، بقالبٍ واحد لكلّ ربط:
**الغرض · أين يتّصل (ملفّات) · ما أُنجز · ما على أشبك كتابته · متغيّرات البيئة · كيف يُختبَر.**
الحقيقة العامّة للمشروع في [`HANDOVER.md`](HANDOVER.md)؛ هنا التفاصيل التقنيّة فقط.

> **اصطلاح:** الفقرات الموسومة «⏳ يُستكمَل من تقرير المهندس» أجزاءٌ **يبنيها مهندسان الآن** ولم
> تُدمَج في `main` لحظة الكتابة. لم تُوثَّق من التخمين عمداً؛ تُملأ من تقريرهما بعد التحقّق من الكود.

## نظرة عامّة

| الربط | الحالة اليوم | يحجب الإطلاق؟ | القسم |
|---|---|---|---|
| الدفع الإلكترونيّ (Visa / بوّابة) | **غير موجود** — محاكاة على الموقع، والخادم يرفض خلق قيمةٍ بلا دفع | **نعم** | [١](#payments) |
| الكاشير (Odoo POS): رمز العضو، الخصم، الاستبدال، النقاط | موديول أودو **هيكليّ غير مُثبَّت** + واجهة الخادم | نعم للنقاط في المحلّ | [٢](#pos) |
| رسائل SMS لرمز الدخول | **غير موجود** — لا أحد يستطيع تسجيل الدخول | **نعم** | [٣](#sms) |
| التوصيل (Careem / Talabat عبر Ishbek) | مسارات خادم في الموقع؛ أجسام الطلبات عيّنة؛ الربط مع أودو TODO | لا (للاستلام من الفرع) | [٤](#delivery) |
| المنيو من أودو | **حقيقيّ** — سحبٌ يدويّ للقراءة فقط يُنتج commit | لا | [٥](#menu) |

</div>

---

<a id="payments"></a>

## ١) الدفع الإلكترونيّ — Payments / Visa

<div dir="rtl">

**الغرض:** قبض ثمن طلبات الموقع والتطبيق، وتأكيد القبض على الخادم قبل منح أيّ نقاط أو قيمة.

**قرار المالك (2026-09-23):** «النقاط بعد تأكيد الدفع» — الطلب نقداً/بطاقةً من التطبيق يُنشأ
لكنّه **يكسب ٠ نقاط** حتى يُؤكَّد القبض على الخادم؛ والكاشير يمنح النقاط بعد أن يستلم المال (§٢).

### أين يتّصل (موجود في المستودع)

| الملفّ | ماذا يفعل اليوم |
|---|---|
| `almond-web/src/data/payment.ts` | `payForOrder`: في وضع `mock` يُرجع «مدفوع» فوراً؛ في وضع `odoo` **يرمي خطأً عمداً** |
| `almond-web/src/data/checkout.ts#settleOrder` | التسلسل الصحيح جاهز: **ادفع وانتظر ← أرسل المندوب ← سجّل الطلب**؛ فشل الدفع يُبقي السلّة ولا يرسل مندوباً |
| `bff/src/plugins/funding.ts#unfundedValueAllowed` | يسمح بقيمةٍ غير ممولة **فقط** خارج الإنتاج وبلا `DATABASE_URL` (التطوير والاختبارات) |
| `bff/src/routes/checkout.ts` | بوّابة `funded`: المحفظة وحدها ممولةٌ على الخادم؛ غيرها يُنشئ الطلب بـ`pointsEarned: 0` |
| `bff/src/routes/wallet.ts`، `bff/src/routes/subscription.ts` | شحن المحفظة والاشتراك بغير المحفظة يُرفضان في الإنتاج بـ403 `payment_capture_required` |

**قاعدة لا تُكسر:** لا تمرّ بيانات بطاقةٍ عبر `almond-web` ولا `almond-app`. نيّة الدفع تُنشأ على
الخادم، والبطاقة تُجمع في صفحة البوّابة المستضافة (hosted page / hosted fields)، والتأكيد
يصل الخادم (webhook) — ولا يُعاد الوثوق بطريقة الدفع التي يذكرها العميل في الطلب.

### واجهة مزوّد الدفع في الخادم (قيد البناء)

<!-- SEAM: to be filled from the engineer's final report -->
⏳ يُستكمَل من تقرير المهندس: بنية `bff/src/payments/…`، متغيّر `PAYMENT_PROVIDER` وقيمه،
مسارات نيّة الدفع والتأكيد، الهجرة `supabase/migrations/20260927_payment_intents.sql`،
وكيف تتحوّل بوّابة `funded` إلى «مرجع قبضٍ متحقَّقٍ منه على الخادم».

### ما على أشبك كتابته

<!-- SEAM: to be filled from the engineer's final report -->
⏳ يُستكمَل من تقرير المهندس (المحوّل الفعليّ للبوّابة المختارة وما ينقصه).

قبل الكود، قرارٌ خارجه: **عقد بوّابة دفع** (المرشّحون المذكورون في الوثائق: MEPS / HyperPay /
Zain Cash) — هذا الحاجز الثاني للإطلاق.

### الدفع بالبطاقة على الكاشير (مسار منفصل)

البطاقة الحاضرة على أجهزة MEPS في الفروع شأنٌ آخر: موديول أودو `integrations/pos_meps_apex/`
(يعمل في وضع **mock**، متوقّف بانتظار مواصفة رسائل Apex ECR من MEPS). التفاصيل في
[`meps-integration/HANDOFF.md`](meps-integration/HANDOFF.md) و`integrations/pos_meps_apex/README.md`.

### متغيّرات البيئة

<!-- SEAM: to be filled from the engineer's final report -->
⏳ يُستكمَل من تقرير المهندس (`PAYMENT_PROVIDER` ومفاتيح المزوّد). جهة الموقع اليوم:
`NEXT_PUBLIC_DATA_SOURCE` (`mock` = دفعٌ وهميّ ناجح؛ `odoo` = الدفع يرمي خطأً).

### كيف يُختبَر

- في `almond-web`: اختبارات `settleOrder` (ثلاثة، منها واحدٌ يُبقي الدفع معلّقاً ويتحقّق أنّ لا شيء
  يتحرّك) — ضمن `npm test --workspace almond-web`.
- في `bff`: بوّابة التمويل والنقاط غير الممولة ضمن `npm test --workspace @almond/bff`
  (`bff/test/security-review.test.ts` وغيرها).

<!-- SEAM: to be filled from the engineer's final report -->
⏳ اختبارات مزوّد الدفع الجديدة وطريقة تشغيلها — من تقرير المهندس.

</div>

---

<a id="pos"></a>

## ٢) الكاشير ورمز العضو والاستبدال — POS & barcode redeem

<div dir="rtl">

**الغرض:** على كاشير أودو ١٩ في الفروع: يقرأ الكاشير رمز QR من هاتف العضو، فيعرف العضو ونوع
طلبه (دفع/اكتساب/استبدال)، ويطبّق خصم الشركة إن وُجد، ويخصم قيمة الاستبدال، و**بعد الدفع**
تُرسَل النقاط إلى الخادم.

### الطرفان

| الطرف | المكان | الحالة |
|---|---|---|
| الخادم (BFF) — إصدار الرمز وقراءته وتسوية الاستبدال | `bff/src/routes/pos.ts`، `bff/src/pos/token.ts` | **حقيقيّ ومختبَر** (في `main`) |
| الخادم — اكتساب النقاط من الكاشير وعكسها | `POST /v1/pos/earn`، `POST /v1/pos/earn/reverse` | ⏳ قيد البناء (انظر أدناه) |
| أودو — موديول الكاشير | `integrations/almond_loyalty_pos/` | **هيكل مكتوب، غير مُثبَّت على أيّ أودو** |

### ما هو موجود في الخادم (في `main`)

| المسار | من يستدعيه | ماذا يفعل |
|---|---|---|
| `POST /v1/pos/token` | تطبيق العضو (JWT) | رمزٌ موقَّع HMAC، **أحاديّ الاستعمال**، عمره `POS_TOKEN_TTL_SECONDS` (٦٠ ثانية افتراضاً)، يحمل العضو والوضع (`pay`/`earn`/`redeem`…) |
| `POST /v1/pos/scan` | خادم أودو (ترويسة `x-pos-key`) | يتحقّق من الرمز ويُرجع `memberId` و`mode` وخصم الشركة (`corporate.percentOff`) و`earnsPoints` والاستبدال النشط إن كان الوضع `redeem`. إعادة الرمز نفسه ← 409 `pos_token_replay`؛ المنتهي ← 401 |
| `POST /v1/pos/redemption/settle` | خادم أودو (`x-pos-key`) | يستهلك كود الاستبدال (برمز QR أو بالكود المكتوب) — منفصلٌ عن `scan` عمداً: القراءة لا تحرق الكود |

المفتاح `POS_SCAN_KEY` **يُغلَق عند غيابه** (fail closed): بدونه المسارات ميّتة لا مفتوحة،
والإنتاج يرفض الإقلاع بدونه أو بأقلّ من ٣٢ حرفاً.

### واجهة الاكتساب/العكس في الخادم (قيد البناء)

<!-- SEAM: to be filled from the engineer's final report -->
⏳ يُستكمَل من تقرير المهندس: عقد `POST /v1/pos/earn` و`POST /v1/pos/earn/reverse` (الحقول،
الأخطاء، منع التكرار)، حقل `earnTicket` الذي يُضاف إلى استجابة `/v1/pos/scan` ومدّة صلاحيته،
الهجرة `supabase/migrations/20260926_pos_sales.sql`، ومحاكي الكاشير `scripts/pos/till-simulator.ts`.

### موديول أودو `almond_loyalty_pos` (المصدر الأساسيّ: `integrations/almond_loyalty_pos/README.md`)

**الحالة:** مكتوبٌ مقابل مصدر `odoo/odoo@19.0`، **لم يُثبَّت ولم يُشغَّل على أيّ أودو**. ما يُقال
«متحقَّق» أدناه متحقَّقٌ خارج أودو فقط.

**المسار:**

</div>

```
TILL (OWL)            ODOO server                                   BFF
«ألموند» / scanner ─► /almond_loyalty/scan   ── x-pos-key ─► POST /v1/pos/scan
"Use it" / code ────► /almond_loyalty/settle ── x-pos-key ─► POST /v1/pos/redemption/settle
PAY / VALIDATE ─────► _process_saved_order → almond.loyalty.outbox (no network, savepoint)
                      ir.cron (5 min + triggered) ─────────► POST /v1/pos/earn
REFUND (paid) ──────► outbox(reverse, original posOrderRef) ► POST /v1/pos/earn/reverse
```

<div dir="rtl">

- مفتاح `x-pos-key` محفوظٌ في `ir.config_parameter` (مدير النظام فقط، حقلٌ للكتابة فقط)، **ولا يصل
  المتصفّح أبداً**؛ و`_load_pos_data_read` يحجب `almond_earn_ticket` عن بيانات المتصفّح، و`_process_order`
  يحذف مفاتيح `almond_*` التي يرسلها المتصفّح.
- **النقاط بعد الدفع فقط:** الربط في `pos.order._process_saved_order` (المستدعي الوحيد لـ`action_pos_order_paid`
  في ١٩.٠) يُدرج صفّ outbox داخل savepoint بلا شبكة — **لا يُفشِل البيع أبداً**؛ والـcron يرسل مع
  تراجعٍ زمنيّ (backoff)، و409 لا يُعاد. `posOrderRef = pos.order.name`.
- **الاستبدال = سطر دفع** على طريقة دفع مخصّصة `almond_is_redemption` (استهلاك التزامٍ لا خصم مبيعات)؛
  **خصم الشركة = خصمٌ لكلّ سطر** (`line.setDiscount`).
- **ملفّات:** `models/almond_loyalty_client.py` (عميل HTTP بلا أودو، HTTPS إلزاميّ عدا localhost، لا أسرار
  في السجلّات، بلا إعادة محاولة ذاتيّة) · `almond_loyalty_policy.py` (قواعد نقيّة: backoff، إعادة أو فشل،
  `paid_total` = المال فقط بلا الاستبدال، الباقي النقديّ يُطرح) · `almond_loyalty_service.py` ·
  `almond_loyalty_ledger.py` · `almond_loyalty_outbox.py` · `pos_order.py` · `pos_config.py` (تفعيل لكلّ
  متجر + معرّف الفرع) · `pos_payment_method.py` · `res_config_settings.py` · `controllers/main.py`
  (`/almond_loyalty/scan`، `/detach`، `/settle` — `type="jsonrpc"`، `auth="user"`، جلسة POS مفتوحة) ·
  `data/ir_cron.xml` · `static/src/app/*` (OWL 2) · `mock/almond_bff_mock.py` · `tests/test_client.py`.

**متحقَّق (خارج أودو):** ٢٢ اختبار وحدة للعميل والقواعد خضراء مقابل الـmock (أعدتُ تشغيلها عند كتابة
هذه الصفحة: `Ran 22 tests … OK`)؛ خمس طفرات حارسة أُمسكت؛ كلّ `.py` يُترجَم، وXML سليم، وJS يُحلَّل ويمرّ ESLint.

**غير متحقَّق (لم يُنفَّذ قطّ):** كلّ خطافات الخادم والمسارات والـcron والواجهات، وكلّ ترقيعات JS؛ وتحديداً:
تفاعل `setDiscount` للشركات مع قوائم الأسعار/الكومبو/`pos_loyalty`؛ هل ترسل قارئات الفروع رمز QR
(~١٥٠ حرفاً) دفعةً واحدة (البديل: حقل الإدخال في النافذة)؛ تحديث تسمية الزرّ؛ وهل تُبقي موديولات
JoFotara المخصّصة سلسلة `_process_saved_order` سليمة (كلّ الدوالّ الجديدة بادئتها `_almond_` تفادياً
لتصادم الأسماء المعروف في MRO).

### ما على أشبك كتابته

1. **التثبيت على `dev-almond`** وتشغيل خطّة الاختبار ذات الخطوات السبع في README الموديول، وإصلاح ما ينكسر.
2. **اختبارات أودو:** `TransactionCase` للخطاف والـcron، وجولة POS (tour) للزرّ ← القراءة ← الدفع.
3. العضو و«النقاط ستُضاف» على **الإيصال**.
4. مسار `/almond_loyalty/order_state` لاستعادة العضو على جهازٍ آخر.
5. معالجة **انتهاء مهلة التسوية الملتبس** (ربما استُهلك الكود).
6. توجيه صفوف outbox الفاشلة إلى **التنبيهات**.
7. تنظيف صفوف القراءة القديمة.
8. تصدير `i18n/ar.po` وترجمته.

**قرارات مفتوحة للمالية/ERP (من README الموديول):** الاستبدال كسطر دفع (أيّ حساب/يوميّة، ومعاملة
ضريبة JoFotara)؛ خصم الشركة لكلّ سطر أم قائمة أسعار للشركة؛ تفرّد `posOrderRef` (`pos.order.name`
فريدٌ عمليّاً، `uuid` مفروضٌ في القاعدة)؛ المرتجع يعكس **كلّ** النقاط (العقد بلا مبلغ)؛ الاستبدال
المُرتجَع لا يُعاد للعضو (لا «إلغاء تسوية» في الـAPI)؛ استبدالٌ أكبر من الفاتورة يُقصّ عند المستحقّ.

**فجوات عقدٍ رفعها مهندس الموديول للخادم:** 401 ملتبس بين مفتاحٍ خاطئ ورمزٍ منتهٍ؛ الرمز المقروء
لا يُعاد استعماله للتسوية (فالموديول يسوّي بالكود المحفوظ من القراءة)؛ صلاحية `earnTicket`؛ صيغة
`paidAt` (يُرسَل UTC `…Z`)؛ حدّ معدّلٍ لكلّ مفتاح POS على `/settle`؛ عكسٌ جزئيّ للمرتجع الجزئيّ.

<!-- SEAM: to be filled from the engineer's final report -->
⏳ أيّ الفجوات أعلاه أغلقها مهندس الخادم — من تقريره.

**تنبيه معرّفات الفروع:** الموديول يطلب «Almond branch id» لكلّ متجر؛ القائمة الموجودة في
`packages/shared/src/menu/seed.ts` لا تضمّ شارع المدينة — **أكّدوا المعرّفات الحقيقيّة مع الخادم**.

### متغيّرات البيئة

| أين | المتغيّر | ملاحظة |
|---|---|---|
| `bff` | `POS_TOKEN_SECRET` | يوقّع رموز الكاشير؛ ≥ ٣٢ حرفاً في الإنتاج |
| `bff` | `POS_SCAN_KEY` | يقدّمه أودو في `x-pos-key`؛ ≥ ٣٢ حرفاً؛ غيابه يغلق المسارات |
| `bff` | `POS_TOKEN_TTL_SECONDS` | اختياريّ؛ الافتراض من `packages/shared/src/config` (٦٠) |
| أودو | `almond_loyalty_pos.api_url` · `.pos_key` · `.timeout` · `.allow_insecure_http` | معاملات نظام (من الإعدادات، لا من الملفّات) |

### كيف يُختبَر

</div>

```bash
python3 -m unittest discover integrations/almond_loyalty_pos/tests -v     # 22 tests, no Odoo needed
python3 integrations/almond_loyalty_pos/mock/almond_bff_mock.py --port 8898 --key mock-pos-key
npm test --workspace @almond/bff                                           # BFF side (pos routes, token)
```

<div dir="rtl">

<!-- SEAM: to be filled from the engineer's final report -->
⏳ تشغيل محاكي الكاشير `scripts/pos/till-simulator.ts` ضدّ الخادم الحقيقيّ — من تقرير المهندس.

</div>

---

<a id="sms"></a>

## ٣) رسائل الدخول — SMS

<div dir="rtl">

**الغرض:** إرسال رمز الدخول (OTP) إلى هاتف العضو. **اليوم لا يُرسَل إلى أحد** — الحاجز الأوّل للإطلاق.

### أين يتّصل (موجود في `main`)

| الملفّ | ماذا يفعل |
|---|---|
| `bff/src/auth/otp.ts#requestOtp` | يولّد رمزاً عشوائيّاً تشفيريّاً، ويُعيده **إلى المسار** لا إلى الاستجابة؛ حدود: `OTP_MAX_ATTEMPTS`، `OTP_RESEND_COOLDOWN_SECONDS`، `OTP_MAX_SENDS_PER_HOUR` |
| `bff/src/routes/auth.ts` | خارج الإنتاج يطبع الرمز في سجلّ الخادم (`DEV OTP issued`)؛ في الإنتاج لا يطبعه ولا يرسله، ويُجيب `{sent:true}` |
| `bff/src/plugins/rateLimit.ts` + `config.RATE_LIMITS` | حدودٌ لكلّ IP: ٢٠ طلب رمز/١٠ دقائق، ٢٠ تحقّقاً فاشلاً/١٥ دقيقة |

**لا تُصلحها برمزٍ ثابت.** كان `OTP_DEV_CODE=123456` يفتح **أيّ** حساب (على ٤٧٬٧٢٠ عضواً) وحُذف.

### واجهة مزوّد الرسائل (قيد البناء)

<!-- SEAM: to be filled from the engineer's final report -->
⏳ يُستكمَل من تقرير المهندس: `bff/src/auth/sms.ts` و`bff/src/auth/providers/`، متغيّر
`SMS_PROVIDER` وقيمه، ما يحدث عند فشل الإرسال، وهل يرفض الإنتاج الإقلاع بلا مزوّد.

### ما على أشبك كتابته / إحضاره

- **مزوّد رسائل أردنيّ + Sender ID مسجَّل لدى TRC** (إجراءٌ إداريّ بالأيّام) — قبل أيّ كود.

<!-- SEAM: to be filled from the engineer's final report -->
⏳ المحوّل الفعليّ للمزوّد المختار — من تقرير المهندس.

### متغيّرات البيئة

الإعدادات: `OTP_TTL_SECONDS` (٣٠٠) · `OTP_MAX_ATTEMPTS` (٥) · `OTP_RESEND_COOLDOWN_SECONDS` (٣٠) ·
`OTP_MAX_SENDS_PER_HOUR` (٥) · `RATE_OTP_REQUEST_PER_IP` (٢٠) · `RATE_OTP_FAILED_VERIFY_PER_IP` (٢٠)
— كلّها في `bff/src/config.ts`.

<!-- SEAM: to be filled from the engineer's final report -->
⏳ متغيّرات `SMS_PROVIDER` ومفاتيح المزوّد — من تقرير المهندس.

### كيف يُختبَر

محليّاً بلا مزوّد: `npm run dev --workspace @almond/bff` ثمّ `POST /v1/auth/otp/request`، واقرأ الرمز من
سطر `DEV OTP issued` في سجلّ الخادم (هكذا يفعل `scripts/load/bff-baseline.ts`).

<!-- SEAM: to be filled from the engineer's final report -->
⏳ اختبارات مزوّد الرسائل — من تقرير المهندس.

</div>

---

<a id="delivery"></a>

## ٤) التوصيل عبر أشبك — Delivery (Careem / Talabat via Ishbek)

<div dir="rtl">

**الغرض:** الزبون يطلب من موقعنا، وكباتن Careem/Talabat يوصّلون عبر تكاملٍ واحد مع Ishbek —
بدل عمولة المنصّات. التصميم في [`DELIVERY-INTEGRATION.md`](DELIVERY-INTEGRATION.md) وعيّنات
العقد في [`ishbek/`](ishbek/README.md).

### أين يتّصل (موجود في `main`)

| الملفّ | ماذا يفعل |
|---|---|
| `almond-web/src/server/ishbek.ts` | عميلٌ **للخادم فقط**: `ishbekQuote`، `ishbekDispatch`، `ishbekCancel`، `ishbekStatus`، `buildDispatchPayload`، `verifyWebhookSignature` (HMAC-SHA256، مقارنة ثابتة الزمن). ترويسة `X-Ishbek-Key` |
| `almond-web/src/app/api/delivery/quote/route.ts` | تسعيرة (عامّ، قراءة فقط) |
| `…/dispatch/route.ts`، `…/cancel/route.ts`، `…/status/[orderId]/route.ts` | **في الوضع الحيّ تتطلّب جلسة الأدمن** — لأنّ الموقع لا يملك جلسة عضو ولا دفعاً يثبت أنّ خلف الطلب مالاً |
| `…/webhook/route.ts` | يرفض غير الموقَّع (401)، ويرفض أيّ `occurredAt` بلا إزاحة صريحة (422) |
| `almond-web/src/data/delivery.ts` | جهة المتصفّح: يستدعي المسارات الداخليّة فقط، بلا مفتاح |
| `packages/shared/src/integration` | `baseUrls.ishbek` (`https://api.ishbek.com` من `ISHBEK_BASE_URL` في `packages/shared/src/config`) ومسارات `/delivery/*` |

«حيّ» = `NEXT_PUBLIC_DATA_SOURCE=odoo` **و**`ISHBEK_KEY` موجود (`isLive()`)؛ غير ذلك تُجيب
المسارات محليّاً بقيمٍ وهميّة ولا تنفق شيئاً. **انتبهوا:** المفتاح نفسه `NEXT_PUBLIC_DATA_SOURCE=odoo` يجعل
محمّل المنيو (`almond-web/src/data/menu.ts`) وخطوة الدفع يرميان خطأً عمداً — فلا يمكن اليوم تفعيل التوصيل
الحيّ على الموقع العامّ وحده. في `packages/shared/src/integration` مفتاحٌ لكلّ نظام (`enabled.delivery`) لكنّ
`isLive()` في الموقع لا يقرؤه.

**قاعدة التوقيت (لا تُكسر):** كلّ طابعٍ زمنيّ يعبر الحدود ISO-8601 بإزاحة **`+03:00`** صريحة
(`toAmmanISO()` من `@almond/shared/lib/format`) — كان غيابها سبب عدم ظهور الطلبات على الكاشير.

### ما على أشبك كتابته

أشبك هي صاحبة واجهة التوصيل نفسها، فأسماء الحقول النهائيّة عندكم:

1. مطابقة أجسام الطلب/الاستجابة في `server/ishbek.ts` مع **وثائق Ishbek الرسميّة** (الحاليّة عيّنةٌ من طرف ألموند).
2. **الترميز الجغرافيّ** للعنوان (`TODO(live)` في `buildDispatchPayload`: النصّ فقط اليوم).
3. **ربط حالة الـwebhook بأودو** (`TODO(live)` في `webhook/route.ts`: اليوم يتحقّق ويُجيب `ok` فقط).
4. نقل «من يحقّ له إرسال مندوب» من جلسة الأدمن إلى **خادمٍ رأى الدفع** (أودو عند تسوية الطلب، أو الخادم بعد تأكيد القبض — §١).
5. **نافذة زمنيّة ضدّ إعادة الـwebhook** (غير موجودة — «معروفٌ ومتروك» في HANDOVER).
6. **فصل مفتاح التوصيل الحيّ** عن `NEXT_PUBLIC_DATA_SOURCE` (انظر التنبيه أعلاه).

### متغيّرات البيئة (`almond-web`، للخادم فقط — لا `NEXT_PUBLIC_` أبداً)

المتغيّرات: `ISHBEK_KEY` · `ISHBEK_WEBHOOK_SECRET` · و`NEXT_PUBLIC_DATA_SOURCE=odoo` لتفعيل الوضع الحيّ ·
و`ADMIN_PASSWORD`/`ADMIN_SESSION_SECRET` لجلسة الأدمن التي تحرس المسارات الحيّة.

### كيف يُختبَر

الأمر `npm test --workspace almond-web` يشمل `src/server/ishbek.test.ts` و`src/app/api/delivery/routes.test.ts`
و`src/app/api/delivery/webhook/route.test.ts`؛ ورحلة التوصيل في E2E تعمل على الوضع الوهميّ.

</div>

---

<a id="menu"></a>

## ٥) المنيو من أودو — Odoo menu pull

<div dir="rtl">

**الغرض:** نفس منيو المحلّ على أودو، بأسعاره وصوره، على الموقع والتطبيق.

### أين يتّصل

| الملفّ | ماذا يفعل |
|---|---|
| `scripts/odoo-menu-pull.ts` (`npm run menu:pull`) | يقرأ من أودو (`search_read`/`read` فقط): `pos.category` ← فئات، `product.template` المتاحة في POS ← أصناف، سمات الحجم ← أحجام، باقي السمات ← مجموعات تخصيص (`display_type` يحدّد اختياراً واحداً إلزاميّاً أم متعدّداً) |
| `packages/shared/src/menu/menu.generated.ts` | الناتج المُولَّد: **٣٧٣ صنفاً و٤٤ فئة** (عددتُها عند الكتابة) — لا يُعدَّل يدويّاً |
| `almond-web/public/menu/`، `almond-app/public/menu/` | **٣٠٦ صورة WebP** في كلٍّ منهما (عددتُها) — نملكها، لا روابط إلى CDN خارجيّ |

**يدويّ عمداً:** السحب ينتج **commit** لا نشراً، حتى لا يُنشَر خطأ أودو (سعر صفر، اسم مفقود) للزبائن
بلا مراجعة. **معلّق:** إعادة السحب بمفاتيح أودو لتصير مجموعات مثل «Bagel Type» اختياراً إلزاميّاً
واحداً — المنيو المُولَّد الحاليّ فيه صفر مجموعات أحاديّة، واختبار E2E الخاصّ بها `fixme` حتى ذلك.

**ما ليس مبنيّاً في اتّجاه أودو:** محوّل الأعضاء (`DATA_SOURCE=odoo` في الخادم) هيكلٌ **يرمي خطأً عمداً**
(`bff/src/backend/odoo.ts`)؛ الأعضاء والنقاط تعيش في Postgres الخادم.

### متغيّرات البيئة (لتشغيل السحب فقط، لا تُحفَظ في المستودع)

المتغيّرات: `ODOO_URL` · `ODOO_DB` · `ODOO_LOGIN` · `ODOO_API_KEY`

### كيف يُختبَر

السكربت **ليس** ضمن `npm run typecheck` (يُفحَص منفرداً)؛ `menu.test.ts` في `almond-web/src/data/` و`bff/test/tax.test.ts`
(كلّ صنفٍ مسعَّر: المجموع = سعر المحلّ) يلتقطان منيو مُولَّداً معطوباً بعد السحب.

</div>
