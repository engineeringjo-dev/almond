# الربط مع الأنظمة — Integrations

<div dir="rtl">

**لمن:** فريق أشبك (Ishbek) الذي سيأخذ المشروع إلى الإنتاج. **الحالة بتاريخ:** 2026-09-23 (`main` بعد الالتزام `e9f6c15`).

هذه الصفحة تجمع كلّ نقطة ربطٍ بين هذا المستودع والعالم الخارجيّ، بقالبٍ واحد لكلّ ربط:
**الغرض · أين يتّصل (ملفّات) · ما أُنجز · ما على أشبك كتابته · متغيّرات البيئة · كيف يُختبَر.**
الحقيقة العامّة للمشروع في [`HANDOVER.md`](HANDOVER.md)؛ هنا التفاصيل التقنيّة فقط. كلّ مسارٍ ومتغيّرٍ
ورمز خطأٍ أدناه متحقَّقٌ منه في الكود.

> **تنبيهٌ يسري على الأقسام ١ و٢ و٣:** «نقاط الربط» (seams) في الخادم **جاهزةٌ ومختبَرة**، لكنّ
> **الواجهتين لا تستدعيانها بعد**: تسجيل الدخول في التطبيق والموقع محاكاةٌ على الجهاز، ولا واجهة تستدعي
> `/v1/payments/intent` ولا `/v1/checkout` بعميلٍ موثَّق (انظر HANDOVER §٣). ربط الواجهات عملٌ مستقلّ.

## نظرة عامّة

| الربط | الحالة اليوم | يحجب الإطلاق؟ | القسم |
|---|---|---|---|
| الدفع الإلكترونيّ (Visa / بوّابة) | **الواجهة (seam) جاهزة في الخادم**؛ لا مزوّد حقيقيّ؛ لا واجهة أماميّة تستدعيها | **نعم** — يلزم عقد بوّابة ومحوّل | [١](#payments) |
| الكاشير (Odoo POS): رمز العضو، الخصم، الاستبدال، النقاط | **واجهة الخادم كاملة ومختبَرة** (قراءة، اكتساب، عكس، تسوية)؛ موديول أودو **هيكليّ غير مُثبَّت** | نعم للنقاط في المحلّ | [٢](#pos) |
| رسائل SMS لرمز الدخول | **الواجهة جاهزة**؛ لا مزوّد — الإنتاج يُجيب 503 بصدق | **نعم** — يلزم مزوّد وSender ID | [٣](#sms) |
| التوصيل (Careem / Talabat عبر Ishbek) | مسارات خادم في الموقع؛ أجسام الطلبات عيّنة؛ الربط مع أودو TODO | لا (للاستلام من الفرع) | [٤](#delivery) |
| المنيو من أودو | **حقيقيّ** — سحبٌ يدويّ للقراءة فقط يُنتج commit | لا | [٥](#menu) |

**قاعدة مشتركة:** قيمة `PAYMENT_PROVIDER` أو `SMS_PROVIDER` لا تسمّي مزوّداً مسجَّلاً ← **الخادم يرفض الإقلاع في
كلّ بيئة** (`bff/src/providers.ts`)، وكذلك `OTP_SMS_TEMPLATE` بلا `{code}`. خطأٌ إملائيٌّ في ملفّ البيئة يُكتشَف
عند الإقلاع لا عند أوّل عضو.

</div>

---

<a id="payments"></a>

## ١) الدفع الإلكترونيّ — Payments / Visa

<div dir="rtl">

**الغرض:** قبض ثمن طلبات الموقع والتطبيق بالبطاقة، وتأكيد القبض **على الخادم** قبل إنشاء الطلب ومنح النقاط.

**قرار المالك (2026-09-23):** «النقاط بعد تأكيد الدفع» — طلب البطاقة لا يُنشأ أصلاً ما لم يتأكّد القبض
(402)، وطلب النقد من التطبيق يُنشأ لكنّه **يكسب ٠ نقاط**؛ والكاشير يمنح النقاط بعد أن يستلم المال (§٢).

### أين يتّصل

| الملفّ | ماذا يفعل |
|---|---|
| `bff/src/payments/provider.ts` | **الواجهة الوحيدة** التي ينفّذها مزوّدٌ حقيقيّ: `createIntent`، `getCapture`، `verifyWebhook` |
| `bff/src/payments/index.ts` | سجلّ المزوّدين (`PAYMENT_PROVIDERS`) واختيار المزوّد من `PAYMENT_PROVIDER`؛ `mock` مسجَّلٌ للتطوير والاختبار فقط |
| `bff/src/payments/providers/TEMPLATE.ts` | **قالب أشبك**: فئةٌ ترمي «not implemented» في كلّ نداء، مع تعليماتٍ مفصّلة (مثال HyperPay في التعليقات). **غير مسجَّلة** عمداً |
| `bff/src/payments/unconfigured.ts` | المزوّد عند غياب `PAYMENT_PROVIDER`: ‏503 `payment_provider_unconfigured` |
| `bff/src/payments/mock.ts` | مزوّدٌ وهميّ للتطوير والاختبارات؛ **يُرفض عند الإقلاع في الإنتاج** (سرّ webhook الخاصّ به في المستودع) |
| `bff/src/payments/intent.ts` | `cartHash` وقواعد صلاحيّة النيّة عند إنشاء الطلب (`payment_not_captured`، `payment_intent_used`) |
| `bff/src/routes/payments.ts` | `POST /v1/payments/intent` و`POST /v1/payments/webhook/:provider` |
| `bff/src/routes/cart.ts` | مخطّط السلّة المشترك وإعادة التسعير للعضو، و`GATEWAY_METHODS` = `visa`، `mastercard`، `cliq`، `paypal` |
| `bff/src/routes/checkout.ts` | يستهلك النيّة داخل معاملة `Backend.checkout` الواحدة |
| `supabase/migrations/20260927_payment_intents.sql` | جدول `payment_intents` + `orders.payment_intent_id` |
| `almond-web/src/data/payment.ts` · `almond-web/src/data/checkout.ts#settleOrder` | جهة الموقع: الدفع ما زال وهميّاً (`mock`) أو يرمي (`odoo`)؛ التسلسل «ادفع وانتظر ← أرسل المندوب ← سجّل» جاهز. **غير موصولة بمسارات الخادم أعلاه** |

### العقد (من جهة الخادم)

المسار **`POST /v1/payments/intent`** — JWT العضو + ترويسة `Idempotency-Key`؛ السلّة بشكل `/v1/checkout` نفسه، و`paymentMethod`
واحدٌ من `visa|mastercard|cliq|paypal`. يعيد الخادم التسعير (بما فيه خصم الشركة) ويُجيب **201**
`{intentId, amountJod, redirectUrl?, clientSecret?}`. بلا مزوّد ← 503 `payment_provider_unconfigured`؛ محدودٌ لكلّ عضو.

المسار **`POST /v1/payments/webhook/:provider`** — توقيع المزوّد على **الجسم الخام** هو الاعتماد الوحيد (المسار يقرأ الجسم
نصّاً بلا تحليل). بلا مزوّد ← 503؛ اسمٌ ليس المزوّد النشط ← 404؛ توقيعٌ خاطئ ← 401؛ وإلّا **200**
`{received:true, intentId|null}`. ينقل الحالة من `pending` إلى `captured`/`failed` فقط، و**لا يُنشئ طلباً أبداً**.

المسار **`POST /v1/checkout`** — حقلٌ اختياريّ `paymentIntentId`. طلب البطاقة يُنشأ **فقط** إن كانت النيّة للعضو نفسه،
و`getCapture` لدى المزوّد = `captured`، والمبلغ المقبوض = المجموع المُعاد تسعيره **تماماً**، وبصمة السلّة تطابق،
والنيّة غير مستهلكة — ويُستهلَك كلّ ذلك داخل معاملة `Backend.checkout` الواحدة. وإلّا 402 `payment_not_captured`؛
نيّةٌ مستهلكة ← 409 `payment_intent_used`؛ نقدٌ مع `paymentIntentId` ← 400. **طلبات البطاقة تُرفض في التطوير أيضاً**
(بلا نيّة مقبوضة). قيدا تفرّد: `payment_intents.order_id` و`orders.payment_intent_id`.

### ما على أشبك كتابته

1. انسخ `bff/src/payments/providers/TEMPLATE.ts` إلى فئةٍ للبوّابة الحقيقيّة:
   - الدالّة `createIntent`: المبلغ يصلها **فلساتٍ صحيحة**، يُرسَل للبوّابة ديناراً؛
   - الدالّة `getCapture`: نداءٌ من خادمٍ لخادم، لا يعيد `captured` إلّا لقبضٍ مكتمل، والمبلغ بالفلسات؛
   - الدالّة `verifyWebhook`: HMAC (أو فكّ التشفير) على الجسم الخام بمقارنة `timingSafeEqual`.
2. سجّلها في `bff/src/payments/index.ts` (سطرٌ واحد)، واضبط `PAYMENT_PROVIDER` وأسرار البوّابة.
3. وجّه webhook البوّابة إلى `/v1/payments/webhook/<PAYMENT_PROVIDER>`.
4. **ربط الواجهات** بـ`/v1/payments/intent` ثمّ صفحة البوّابة ثمّ `/v1/checkout` (غير موجود اليوم).
5. **غير مبنيّ:** الاسترداد (refund) والإلغاء (void) لدى البوّابة.

قبل الكود، قرارٌ خارجه: **عقد بوّابة دفع** (المرشّحون في الوثائق: MEPS / HyperPay / Zain Cash) — الحاجز الثاني للإطلاق.

### الدفع بالبطاقة على الكاشير (مسار منفصل)

البطاقة الحاضرة على أجهزة MEPS في الفروع شأنٌ آخر: موديول أودو `integrations/pos_meps_apex/` (يعمل في وضع **mock**،
متوقّف بانتظار مواصفة رسائل Apex ECR من MEPS). التفاصيل في [`meps-integration/HANDOFF.md`](meps-integration/HANDOFF.md)
و`integrations/pos_meps_apex/README.md`.

### متغيّرات البيئة (`bff`)

| المتغيّر | المعنى |
|---|---|
| `PAYMENT_PROVIDER` | فارغ ← `unconfigured` (‏503، مسموحٌ في الإنتاج: المحفظة والنقد يعملان) · `mock` ← **مرفوضٌ عند الإقلاع في الإنتاج** · اسمٌ غير مسجَّل ← مرفوضٌ في كلّ بيئة |
| `PAYMENT_RETURN_URL` | اختياريّ: أين تُعيد صفحة البوّابة العضو |
| `PAYMENT_GATEWAY_*` | أسماءٌ مقترحة في القالب (`BASE_URL`، `ENTITY_ID`، `ACCESS_TOKEN`، `WEBHOOK_SECRET`) — يختارها المنفّذ؛ للخادم فقط |
| `RATE_PAYMENT_INTENT_PER_MEMBER` | افتراضاً ٢٠ في الدقيقة |

جهة الموقع اليوم: `NEXT_PUBLIC_DATA_SOURCE` (`mock` = دفعٌ وهميّ ناجح؛ `odoo` = الدفع يرمي خطأً).

### كيف يُختبَر

- الخادم: `bff/test/payments.test.ts` ضمن `npm test --workspace @almond/bff` (مقابل المزوّد الوهميّ).
- الموقع: اختبارات `settleOrder` (ثلاثة، منها واحدٌ يُبقي الدفع معلّقاً ويتحقّق أنّ لا شيء يتحرّك) ضمن `npm test --workspace almond-web`.
- بوّابة التمويل والنقاط غير الممولة: `bff/test/security-review.test.ts`.

</div>

---

<a id="pos"></a>

## ٢) الكاشير ورمز العضو والاستبدال — POS & barcode redeem

<div dir="rtl">

**الغرض:** على كاشير أودو ١٩ في الفروع: يقرأ الكاشير رمز QR من هاتف العضو، فيعرف العضو ونوع طلبه
(دفع/اكتساب/استبدال)، ويطبّق خصم الشركة إن وُجد، ويخصم قيمة الاستبدال، و**بعد الدفع** يُبلّغ الخادمَ بالبيع
فتُمنَح النقاط؛ والمرتجع يعكسها.

### الطرفان

| الطرف | المكان | الحالة |
|---|---|---|
| الخادم (`bff`) — الرمز والقراءة والتسوية والاكتساب والعكس | `bff/src/routes/pos.ts`، `bff/src/pos/token.ts`، `bff/src/pos/sales.ts` | **حقيقيّ ومختبَر** — لا شيء على أشبك كتابته في الخادم |
| أودو — موديول الكاشير | `integrations/almond_loyalty_pos/` | **هيكل مكتوب، غير مُثبَّت على أيّ أودو**؛ يستهدف العقد أدناه |

### العقد (من جهة الخادم)

كلّ مسارات الكاشير تتطلّب ترويسة `x-pos-key` = `POS_SCAN_KEY` وتُغلَق عند غيابه (fail closed). جسم الخطأ
`{error, message}`، والرموز الآليّة:

| الرمز | HTTP | المعنى |
|---|---|---|
| `pos_key_invalid` | 401 | مفتاح الكاشير خاطئ — **كاشيرٌ مُساء إعداده: نبّه العمليّات** |
| `token_invalid` · `token_expired` | 401 | رمز QR العضو غير صالح / منتهٍ (عمره ٦٠ ثانية) |
| `pos_token_replay` | 409 | رمز QR استُعمل من قبل |
| `ticket_invalid` · `ticket_expired` | 401 | تذكرة الاكتساب غير صالحة / منتهية |
| `ticket_used` | 409 | التذكرة صُرفت على بيعٍ آخر |
| `pos_order_conflict` | 409 | `posOrderRef` نفسه بعضوٍ/مبلغٍ/فرعٍ مختلف |
| `paid_at_outside_ticket_window` | 400 | وقت الدفع خارج نافذة التذكرة |
| `rate_limited` | 429 | تجاوز حدّ المعدّل |

| المسار | من يستدعيه | الطلب ← الجواب |
|---|---|---|
| `POST /v1/pos/token` | تطبيق العضو (JWT) | ← رمزٌ موقَّع HMAC، **أحاديّ الاستعمال**، عمره `POS_TOKEN_TTL_SECONDS` (٦٠ ث)، يحمل العضو والوضع |
| `POST /v1/pos/scan` | خادم أودو | `{token}` ← `{memberId, mode, redemption\|null, corporate\|null, earnsPoints, earnTicket\|null, earnTicketExpiresIn\|null}`. التذكرة **فقط** لوضعي `pay`/`earn` ولعضوٍ غير تابعٍ لشركة؛ لا تذكرة لقراءة `redeem` |
| `POST /v1/pos/earn` | خادم أودو، **بعد الدفع** | `{earnTicket, posOrderRef (1–64), branchId, paidTotal, paidAt?}` ← `{posOrderRef, pointsEarned, pointsBalance, replay}` |
| `POST /v1/pos/earn/reverse` | خادم أودو، عند المرتجع/الإلغاء | `{posOrderRef, reason (1–200)}` ← `{posOrderRef, reversedPoints, shortfall, pointsBalance, replay}` |
| `POST /v1/pos/redemption/settle` | خادم أودو | `{token}` أو `{code}` ← يستهلك كود الاستبدال؛ منفصلٌ عن `scan` عمداً (القراءة لا تحرق الكود). التسوية بعد القراءة **بالكود** الذي أعادته القراءة (الرمز نفسه صار مستعمَلاً) |

**تفاصيل `/v1/pos/earn`:**

- الحقل `paidTotal` بالدينار، **شاملٌ الضريبة، المال المقبوض فقط** (بلا قيمة الاستبدال)، ‏≥ ٠ و≤ ١٠٠٬٠٠٠، بثلاث خانات عشريّة كحدٍّ أقصى.
- الحقل `paidAt` بصيغة ISO-8601 **بإزاحةٍ صريحة** (`Z` أو `+03:00`)؛ أكثر من ٥ دقائق في المستقبل ← 400. أرسلوه دائماً: غيابه يعني «وقت التسليم»، وإعادة المحاولة بعد أيّام تقع خارج النافذة.
- **‏201** بيعٌ جديد؛ **‏200 `replay:true`** لنفس المرجع والعضو والمبلغ والفرع — حتى بعد انتهاء التذكرة أو بعد العكس. غير ذلك ← 409 `pos_order_conflict`/`ticket_used`، 401 `ticket_*`، 400 تحقّق، 429.
- **عمر التذكرة ٧ أيّام** (لتصمد طوابير أودو أثناء انقطاع الخادم)، لكنّ البيع يجب أن **يُدفَع** ضمن `[القراءة − ٣٠ دقيقة، القراءة + ٦ ساعات]`.
- النقاط = `computeEarn` المشتركة على `paidTotal` في لحظة `paidAt`؛ عضو الشركة لا يُعطى تذكرةً أصلاً، ومن صار عضو شركةٍ بعد القراءة يكسب ٠ (ويُسجَّل إنفاقه في نافذة الفئة)؛ **لا مكافأة كومبو على الكاشير** (لا أسطر في العقد).

**تفاصيل `/v1/pos/earn/reverse`:** ‏201 / ‏200 `replay` / ‏404 لمرجعٍ مجهول. **لا ينزل الرصيد تحت الصفر**: النقاط التي
صرفها العضو تُسجَّل `shortfall` ولا تُلاحَق. يزيل إنفاق البيع من نافذة الفئة.

**ما تغيّر عن الخطّة الأولى للعقد (سطرٌ لكلّ):** التذكرة ٧ أيّام بدل ٣٠ دقيقة مع نافذة دفع · رموز أخطاء آليّة مميَّزة
(تحلّ التباس 401 الذي رفعه مهندس الموديول) · حدود معدّل لكلّ كاشير ولكلّ مفتاح · الاكتساب 201/200 · النيّة المستهلكة 409 ·
PayPal يُحسب طريقة بوّابة · طلبات البطاقة مرفوضة في التطوير أيضاً · قيدا تفرّد على الجهتين · الإعادة تقارن الفرع ·
لا كومبو على الكاشير · لا تذكرة لقراءة الاستبدال · التسوية بالكود المُعاد من القراءة.

### موديول أودو `almond_loyalty_pos`

**مصدر الحقيقة للموديول هو `integrations/almond_loyalty_pos/README.md`** — والموديول يستهدف العقد أعلاه (كان يُحدَّث
لرموز الأخطاء النهائيّة وقاعدة `paidAt` لحظة كتابة هذه الصفحة؛ ما يلي ملخّصٌ منه).

**الحالة:** مكتوبٌ مقابل مصدر `odoo/odoo@19.0`، **لم يُثبَّت ولم يُشغَّل على أيّ أودو**. ما يُقال «متحقَّق» متحقَّقٌ خارج أودو فقط.

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

- مفتاح `x-pos-key` محفوظٌ في `ir.config_parameter` (مدير النظام فقط، حقلٌ للكتابة فقط)، **ولا يصل المتصفّح أبداً**؛ و`_load_pos_data_read` يحجب `almond_earn_ticket` عن بيانات المتصفّح، و`_process_order` يحذف مفاتيح `almond_*` التي يرسلها المتصفّح.
- **النقاط بعد الدفع فقط:** الربط في `pos.order._process_saved_order` (المستدعي الوحيد لـ`action_pos_order_paid` في ١٩.٠) يُدرج صفّ outbox داخل savepoint بلا شبكة — **لا يُفشِل البيع أبداً**؛ والـcron يرسل مع تراجعٍ زمنيّ، و409 لا يُعاد. `posOrderRef = pos.order.name`.
- **الاستبدال = سطر دفع** على طريقة دفع مخصّصة `almond_is_redemption` (استهلاك التزامٍ لا خصم مبيعات)؛ **خصم الشركة = خصمٌ لكلّ سطر** (`line.setDiscount`).
- **ملفّات:** `models/almond_loyalty_client.py` (عميل HTTP بلا أودو، HTTPS إلزاميّ عدا localhost، لا أسرار في السجلّات، بلا إعادة محاولة ذاتيّة) · `almond_loyalty_policy.py` (قواعد نقيّة) · `almond_loyalty_service.py` · `almond_loyalty_ledger.py` · `almond_loyalty_outbox.py` · `pos_order.py` · `pos_config.py` (تفعيل لكلّ متجر + معرّف الفرع) · `pos_payment_method.py` · `res_config_settings.py` · `controllers/main.py` (`/almond_loyalty/scan`، `/detach`، `/settle` — `type="jsonrpc"`، `auth="user"`) · `data/ir_cron.xml` · `static/src/app/*` (OWL 2) · `mock/almond_bff_mock.py` · `tests/test_client.py`.

**متحقَّق (خارج أودو):** اختبارات الوحدة للعميل والقواعد خضراء مقابل الـmock (أعدتُ تشغيلها عند كتابة النسخة الأولى من
هذه الصفحة: `Ran 22 tests … OK`)؛ طفراتٌ حارسة أُمسكت؛ `.py` يُترجَم، وXML سليم، وJS يمرّ ESLint.

**غير متحقَّق (لم يُنفَّذ قطّ):** كلّ خطافات الخادم والمسارات والـcron والواجهات، وكلّ ترقيعات JS؛ وتحديداً تفاعل
`setDiscount` مع قوائم الأسعار/الكومبو/`pos_loyalty`؛ هل ترسل قارئات الفروع رمز QR (~١٥٠ حرفاً) دفعةً واحدة؛ تحديث
تسمية الزرّ؛ وهل تُبقي موديولات JoFotara المخصّصة سلسلة `_process_saved_order` سليمة (الدوالّ الجديدة بادئتها `_almond_`
تفادياً لتصادم الأسماء المعروف في MRO).

### ما على أشبك كتابته

**في الخادم: لا شيء.** في أودو:

1. **التثبيت على `dev-almond`** وتشغيل خطّة الاختبار في README الموديول، وإصلاح ما ينكسر.
2. **اختبارات أودو:** `TransactionCase` للخطاف والـcron، وجولة POS (tour).
3. العضو و«النقاط ستُضاف» على **الإيصال**.
4. مسار `/almond_loyalty/order_state` لاستعادة العضو على جهازٍ آخر.
5. معالجة **انتهاء مهلة التسوية الملتبس**.
6. توجيه صفوف outbox الفاشلة إلى **التنبيهات** — ومعها أيّ 401 `pos_key_invalid`.
7. تنظيف صفوف القراءة القديمة، وتصدير `i18n/ar.po` وترجمته.

**قرارات مفتوحة للمالية/ERP:** الاستبدال كسطر دفع (أيّ حساب/يوميّة، ومعاملة ضريبة JoFotara)؛ خصم الشركة لكلّ سطر أم
قائمة أسعار؛ تفرّد `posOrderRef`؛ المرتجع الجزئيّ يعكس **كلّ** النقاط؛ الاستبدال المُرتجَع لا يُعاد للعضو؛ استبدالٌ أكبر من
الفاتورة يُقصّ عند المستحقّ. (التفصيل في HANDOVER §٧.)

**تنبيه معرّفات الفروع:** الموديول يطلب «Almond branch id» لكلّ متجر ويرسله `branchId`؛ القائمة في
`packages/shared/src/menu/seed.ts` لا تضمّ شارع المدينة — **أكّدوا المعرّفات الحقيقيّة**.

### متغيّرات البيئة

| أين | المتغيّر | ملاحظة |
|---|---|---|
| `bff` | `POS_TOKEN_SECRET` | يوقّع رموز QR وتذاكر الاكتساب؛ ≥ ٣٢ حرفاً في الإنتاج |
| `bff` | `POS_SCAN_KEY` | يقدّمه أودو في `x-pos-key` على المسارات الأربعة؛ ≥ ٣٢ حرفاً؛ غيابه يغلقها |
| `bff` | `POS_TOKEN_TTL_SECONDS` | اختياريّ؛ الافتراض ٦٠ من `packages/shared/src/config` |
| `bff` | `POS_EARN_TICKET_TTL_SECONDS` | عمر تذكرة الاكتساب؛ افتراضاً ٦٠٤٨٠٠ (٧ أيّام) |
| `bff` | `POS_EARN_SALE_WINDOW_SECONDS` | أقصى ما بعد القراءة لوقت الدفع؛ افتراضاً ٢١٦٠٠ (٦ ساعات) |
| `bff` | `POS_EARN_PAID_BEFORE_SCAN_SECONDS` | أقصى ما قبل القراءة؛ افتراضاً ١٨٠٠ (٣٠ دقيقة) |
| `bff` | `RATE_POS_EARN_PER_TILL` / `_PER_KEY` | ‏١٢٠ / ١٢٠٠ في الدقيقة (الاكتساب والعكس) |
| `bff` | `RATE_POS_SETTLE_PER_TILL` / `_PER_KEY` | ‏٦٠ / ٣٠٠ في الدقيقة (يحدّ تخمين أكواد الاستبدال بمفتاحٍ مسرَّب) |
| أودو | `almond_loyalty_pos.api_url` · `.pos_key` · `.timeout` · `.allow_insecure_http` | معاملات نظام (من الإعدادات) |

«لكلّ كاشير» = عنوان المصدر، فيعتمد على `TRUST_PROXY` صحيح.

### كيف يُختبَر

</div>

```bash
npm test --workspace @almond/bff        # includes bff/test/pos-earn.test.ts and pos-flow.test.ts
npm run pos:simulate                    # scripts/pos/till-simulator.ts against a RUNNING bff (env below)
python3 -m unittest discover integrations/almond_loyalty_pos/tests -v      # the addon's client, no Odoo
python3 integrations/almond_loyalty_pos/mock/almond_bff_mock.py --port 8898 --key mock-pos-key
```

<div dir="rtl">

محاكي الكاشير يقود بيعاً واحداً كما يفعل الموديول، ضدّ خادمٍ **يعمل**: `BFF_URL` و`POS_SCAN_KEY` و`MEMBER_JWT`، أو بلا
`MEMBER_JWT` فيسجّل الدخول بالرمز من سجلّ خادم التطوير (`MEMBER_PHONE` و`BFF_LOG_FILE`)؛ اختياريّاً `BRANCH_ID` و`PAID_TOTAL`.
يخرج بخطأ عند أوّل خطوةٍ لا تُجيب كما هو موثَّق. تشغيلٌ حيّ بحسب تقرير مهندس الخادم: بيعٌ بـ٢٥ ديناراً ← ‏+٥٠ نقطة ← إعادة
(`replay`) ← استبدال ٥٠ ← تسوية ← عكس (‏٠ نقاط، `shortfall` ‏٥٠).

</div>

---

<a id="sms"></a>

## ٣) رسائل الدخول — SMS

<div dir="rtl">

**الغرض:** إرسال رمز الدخول (OTP) إلى هاتف العضو. **لا مزوّد بعد** — الحاجز الأوّل للإطلاق. الإنتاج بلا مزوّد يُجيب الآن
**503 بصدق** بدل `{sent:true}` لرسالةٍ لم تُرسَل.

### أين يتّصل

| الملفّ | ماذا يفعل |
|---|---|
| `bff/src/auth/sms.ts` | الواجهة `SmsSender` (`send(to, text)`؛ `to` بصيغة `+9627XXXXXXXX`)، وسجلّ المرسلين `SMS_SENDERS`، والمرسل `log` للتطوير، وفحص القالب |
| `bff/src/auth/providers/TEMPLATE.ts` | **قالب أشبك** لمرسلٍ حقيقيّ |
| `bff/src/auth/otp.ts#requestOtp` | يولّد رمزاً عشوائيّاً تشفيريّاً من ٦ أرقام؛ حدود: `OTP_MAX_ATTEMPTS`، `OTP_RESEND_COOLDOWN_SECONDS`، `OTP_MAX_SENDS_PER_HOUR` |
| `bff/src/routes/auth.ts` | `POST /v1/auth/otp/request` و`/verify` |
| `bff/src/plugins/rateLimit.ts` | حدودٌ لكلّ IP: ٢٠ طلب رمز/١٠ دقائق، ٢٠ تحقّقاً فاشلاً/١٥ دقيقة |

### السلوك

- المسار `POST /v1/auth/otp/request` يُجيب `{sent:true}` **فقط** حين أُرسل فعلاً.
- بلا مزوّد (افتراض الإنتاج) ← **503 `sms_unavailable`**؛ فشل المزوّد ← **502 `sms_failed`**. لا يُحتسَب أيٌّ منهما على حدود الإرسال للعضو، والرمز غير المرسَل يُحرَق.
- في التطوير المرسل `log` يُبقي سطر `DEV OTP issued` في سجلّ الخادم (هكذا يدخل المطوّرون ومجموعة E2E واختبار الحِمل).

**لا تُصلحها برمزٍ ثابت.** كان `OTP_DEV_CODE=123456` يفتح **أيّ** حساب (على ٤٧٬٧٢٠ عضواً) وحُذف.

### ما على أشبك كتابته / إحضاره

1. **مزوّد رسائل أردنيّ + Sender ID مسجَّل لدى TRC** (إجراءٌ إداريّ بالأيّام) — قبل أيّ كود.
2. نفّذ `SmsSender.send` انطلاقاً من `bff/src/auth/providers/TEMPLATE.ts`: Sender ID المسجَّل، عربيّة Unicode، مهلة زمنيّة، و**ارمِ خطأً** عند أيّ ردٍّ غير «مقبول».
3. سجّله في `SMS_SENDERS` داخل `bff/src/auth/sms.ts`، واضبط `SMS_PROVIDER`.
4. اختبر التسليم الفعليّ على **زين وأورنج وأمنية**.

### متغيّرات البيئة (`bff`)

| المتغيّر | المعنى |
|---|---|
| `SMS_PROVIDER` | فارغ في التطوير ← `log` · فارغ في الإنتاج ← 503 · `log` في الإنتاج ← **مرفوضٌ عند الإقلاع** · اسمٌ غير مسجَّل ← مرفوضٌ في كلّ بيئة |
| `OTP_SMS_TEMPLATE` | افتراضاً «رمز التحقق من ألموند: {code}»؛ **يجب أن يحوي `{code}`** وإلّا رُفض الإقلاع في كلّ بيئة؛ جزءٌ واحد Unicode (≤ ٧٠ حرفاً) |
| `SMS_API_URL` · `SMS_API_KEY` · `SMS_SENDER_ID` | أسماءٌ مقترحة في القالب — يختارها المنفّذ؛ للخادم فقط |
| `OTP_TTL_SECONDS` · `OTP_MAX_ATTEMPTS` · `OTP_RESEND_COOLDOWN_SECONDS` · `OTP_MAX_SENDS_PER_HOUR` | ‏٣٠٠ · ٥ · ٣٠ · ٥ |
| `RATE_OTP_REQUEST_PER_IP` · `RATE_OTP_FAILED_VERIFY_PER_IP` | ‏٢٠ · ٢٠ |

### كيف يُختبَر

- الخادم: `bff/test/sms.test.ts` ضمن `npm test --workspace @almond/bff`.
- محليّاً بلا مزوّد: `npm run dev --workspace @almond/bff` ثمّ `POST /v1/auth/otp/request`، واقرأ الرمز من سطر `DEV OTP issued`.
- بعد المحوّل: رسالةٌ حقيقيّة إلى رقمٍ على كلّ شبكةٍ من الثلاث، والتأكّد من ظهور Sender ID والعربيّة سليمة.

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
