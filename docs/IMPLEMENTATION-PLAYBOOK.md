# دليل التنفيذ — ألموند كوفي هاوس (المتبقّي)

هذا الدليل يجمع خمس مساحات عمل متبقّية (الباك-إند المالي الآمن، تكامل Odoo 19، موقع Next.js للـSEO والأداء، UX/الوصولية WCAG 2.2 AA، وآليات الولاء والتحويل) في مرجع تنفيذي واحد للمالك والمهندسين. المبدأ الحاكم عبر كل الأقسام: **مصدر حقيقة واحد للمال والهوية على الخادم، ومصدر توكنات/منطق واحد في `@almond/shared` يشترك فيه التطبيق والموقع.**

## ملخص تنفيذي وترتيب الأولويات

| البند | المجال | الأولوية | الجهد | يعتمد على |
|---|---|---|---|---|
| إخماد الأسرار في العميل + تدقيق CI على `*_PUBLIC_` + إدخال `BFF_BASE_URL` | باك-إند مالي | حرجة (P0) | متوسط | — |
| هيكلة خدمة BFF مستقلّة (`api.almond.jo`) تحتكر الأسرار + CORS مقيّد + جدولا `idempotency_keys`/`outbox` | باك-إند مالي / Odoo | حرجة (P0) | كبير | إخماد الأسرار |
| المصادقة الحقيقية OTP + JWT قصير العمر (الهوية من `jwt.sub`) | باك-إند مالي / Odoo | حرجة (P0) | متوسط-كبير | خدمة BFF |
| بنية مفاتيح التفرّد (Idempotency-Key: UUID v4) + retry مشروط في `apiClient` | باك-إند مالي | حرجة (P0) | متوسط | خدمة BFF |
| `POST /v1/checkout` الذرّي (saga + تعويض + outbox + خصم محفظة ذرّي + إعادة تسعير) | باك-إند مالي | حرجة (P0) | كبير | JWT + التفرّد |
| توكن POS موقَّع قصير العمر (JWS + jti مرّة واحدة) بدل QR الثابت | باك-إند مالي / Odoo | عالية (P1) | متوسط | JWT |
| مزامنة المنيو (Talabat → `product.template`/attributes) + بذر + REST | Odoo | عالية | كبير | خدمة BFF |
| الطلبات على `sale.order` (نشر تكافئي idempotent + نافذة إلغاء 30ث + مزامنة حالة) | Odoo | عالية | كبير | التفرّد + JWT |
| الولاء الأصلي (`loyalty.program`/`card`/`reward`) + الفئات محسوبة في BFF | Odoo | عالية | كبير | خدمة BFF |
| المحفظة وبطاقات الهدايا (ewallet/gift_card) + idempotency على العمليات المالية | Odoo | عالية | متوسط | التفرّد |
| قلب `DATA_SOURCE` من mock إلى odoo + قراءة الموزّعات لـ`integration.enabled.*` للطرح التدريجي | Odoo | عالية | صغير | كل ما سبقه |
| Webhooks موقّعة (HMAC) + دفع Expo لحالة الطلب (استقصاء أولًا) | Odoo | متوسطة | متوسط | الطلبات |
| حسم هدف النشر (Vercel/Node مقابل static export) | موقع Next.js | حرجة (P0) — حاجز | صغير | — |
| SSG + `generateStaticParams` لصفحة المنتج + ربط `revalidate` بـ`DATA_SOURCE` | موقع Next.js | حرجة (P0) | صغير | هدف النشر |
| Image loader مخصص لـ deliveryhero + `formats`/`deviceSizes` + `priority` + blur | موقع Next.js | حرجة (P0) | متوسط | هدف النشر |
| بنية الميتاداتا + hreflang (ar-JO/en-JO/x-default) | موقع Next.js | حرجة (P0) | متوسط | — |
| خطوط WOFF2 مجزّأة + `adjustFontFallback`/preload | موقع Next.js | عالية (P1) | صغير-متوسط | — |
| JSON-LD schema.org (Restaurant/Menu/MenuItem/Offer/LocalBusiness) | موقع Next.js | عالية (P1) | متوسط | الميتاداتا |
| sitemap.ts + robots.ts + manifest + opengraph-image | موقع Next.js | عالية (P1) | صغير | الميتاداتا |
| ميزانيات Lighthouse-CI (LCP/INP/CLS + JS budget) | موقع Next.js | عالية (P1) | متوسط | صفحات SSG |
| إصلاح التباين (textSecondary/gradients/tierBean) + حارس آلي في CI | UX/a11y | عالية جدًّا — حاجز إطلاق | صغير | — |
| نظام ارتفاع الأسطح (surfaces) عبر التوكنات | UX/a11y | عالية | متوسط | التباين |
| توحيد الأرقام اللاتينية + صحّة RTL في `format.ts` | UX/a11y | عالية | صغير | — |
| وصولية كوب الولاء والمستوى (progressbar + reduce-motion) | UX/a11y | عالية | صغير-متوسط | — |
| الخط الديناميكي (`maxFontSizeMultiplier` + مرونة الأزرار) | UX/a11y | متوسطة | متوسط | — |
| اللمس الاهتزازي (`expo-haptics`) | UX/a11y | متوسطة | صغير | — |
| ترقية «الحجم الأعلى التالي» (Next size up) | ولاء/تحويل | عالية (أعلى أثر/جهد) | منخفض | — |
| سقف وتوحيد مُضاعِفات الكسب (حماية الهامش) | ولاء/تحويل | عالية | متوسط | — |
| عرض الأسعار شاملة الضريبة (16% VAT) | ولاء/تحويل | عالية | منخفض-متوسط | — |
| إشعارات دورة الحياة (سلّة متروكة + انتهاء نقاط) | ولاء/تحويل | عالية | متوسط | — |
| الإحالة ثنائية الجانب مع مانع إساءة + Idempotency-Key | ولاء/تحويل | عالية | متوسط | منطق `earn` + الإشعارات |

**قراءة سريعة للأولويات:** كل بنود P0 المالية (BFF، JWT، التفرّد، checkout الذرّي) وحاجز التباين وحاجز هدف النشر يجب أن تُنجَز أولًا لأنها تحكم كل ما بعدها. ثم تأتي طبقة Odoo وطبقة الموقع/الوصولية بالتوازي، وأخيرًا آليات التحويل التي تعتمد على استقرار منطق `earn` والبنية الآمنة.

---

## 1) الباك-إند المالي الآمن (Server-authoritative)

> **ملخّص الوضع الحالي (من الشيفرة):** المال والنقاط تُنسَّق اليوم على العميل بالكامل: `cart.tsx` يستدعي `loyaltyService.chargeWallet` ثم `createOrder.mutateAsync` ثم `loyaltyService.earn` كثلاث نداءات منفصلة بلا ذرّية ولا تراجع (`almond-app/app/(tabs)/cart.tsx:131-172`). الأسرار المميّزة تُقرأ من `EXPO_PUBLIC_*` وتُدمَج في حزمة GitHub Pages العامة (`almond-app/constants/integration.ts:36-39` عبر `packages/shared/src/integration/index.ts:35-40`). الهوية تأتي من `useUserId()` الذي يعيد `user.id` العشوائي أو `'guest'` (`almond-app/stores/authStore.ts:52-54`)، والنقاط النهائية «تثق» بأي `userId` يُرسَل في الجسم. رمز QR للدفع ثابت وقابل لإعادة التشغيل: `ALMOND|MEMBER|${userId}|MODE=PAY` (`almond-app/app/(tabs)/pay.tsx:44`). `apiClient` بلا مفتاح تفرّد وبلا إعادة محاولة، مع مهلة 15s فقط (`almond-app/lib/apiClient.ts:15,27-29`). و`odooPaymentService`/`odooOrderService`/`odooAuthService` ما زالت aliases للـ mock (`payment.service.ts:20-23`, `order.service.ts:160-168`, `auth.service.ts:31-35`) و OTP يقبل `123456` (`auth.service.ts:12-18`).

الهدف المعماري العام: **نقل كل قرار مالي/نقطي إلى الخادم**، بحيث يصبح العميل «عديم الثقة» (untrusted) يعرض حالة فقط. نبني **BFF/Edge API** واحدًا يقف بين العميلين (Expo web الثابت + Next.js) وبين Odoo 19 / loyalty-server، يحتكر الأسرار، ويعرّض نقاطًا عالية المستوى مؤمَّنة بـ JWT وبمفاتيح تفرّد.

ملاحظة نشر مهمة: تطبيق Expo يُصدَّر ثابتًا إلى GitHub Pages (لا خادم)، لذا **لا يمكن** أن يكون الـ BFF داخل حزمة التطبيق. بالمقابل `almond-web` هو Next.js App Router **بلا** `output: 'export'` (`almond-web/next.config.mjs:6-14`) فيدعم Route Handlers على الخادم — لكنه ينشر عادةً بلا خادم أيضًا. **القرار المُثلى:** BFF مستقلّ منفصل (خدمة واحدة على `api.almond.jo`) يستهلكه العميلان معًا، لأنّ GitHub Pages ثابت والـ BFF يجب أن يكون خادمًا دائمًا. تُبنى نقاط Next.js Route Handlers كـ «واجهة رقيقة» فقط إن رغبنا، لكن مصدر الحقيقة خدمة BFF واحدة.

---

### 1.1 — BFF/Edge API: إخفاء الأسرار وحصر السطح المالي

**الهدف:** ألّا يُشحن أي سرّ (`EXPO_PUBLIC_ODOO_API_KEY`, `EXPO_PUBLIC_LOYALTY_TOKEN`, `ISHBEK_KEY`) إلى أي حزمة عميل، وأن يمرّ كل نداء مالي عبر خادم واحد يفرض الهوية والتفرّد والذرّية.

**الطريقة المُثلى:**
- خدمة BFF مستقلّة (اقتراح: Node/Fastify أو NestJS على `https://api.almond.jo/v1`). الأسرار تُقرأ من متغيّرات بيئة **الخادم** (`process.env.ODOO_API_KEY` بلا بادئة `EXPO_PUBLIC_`/`NEXT_PUBLIC_`)، فلا تُدمَج في أي حزمة.
- العميل لا يعرف Odoo ولا loyalty-server إطلاقًا؛ يعرف فقط `BFF_BASE_URL` عامًا. نُعيد تعريف `config` بحيث `ODOO_BASE_URL`/`LOYALTY_BASE_URL` تُستخدَم **فقط داخل BFF**، ويحصل العميل على `BFF_BASE_URL` واحد.
- سطح BFF المالي المُقترَح (كلّها POST تعاملية):

| النقطة | الغرض |
|---|---|
| `POST /v1/auth/otp/request` · `POST /v1/auth/otp/verify` | إصدار JWT حقيقي |
| `POST /v1/checkout` | **الذرّية الكاملة**: دفع/شحن محفظة + إنشاء طلب + منح نقاط |
| `POST /v1/wallet/topup` | شحن المحفظة + بونص الإعادة |
| `POST /v1/loyalty/redeem` | استبدال نقاط بقسيمة |
| `POST /v1/pos/token` | إصدار توكن دفع/مسح قصير العمر موقَّع |
| `GET  /v1/me/*` | أرصدة/سجل/محفظة للقراءة فقط (هوية من JWT) |

**تعديل العميل (مواضع محدّدة):** نُبقي طبقة الخدمات كما هي شكلًا، لكن الـ live services تشير إلى BFF لا إلى Odoo مباشرة. في `packages/shared/src/integration/index.ts` نحذف `auth.odooApiKey`/`auth.loyaltyToken` من العميل بالكامل (تبقى في BFF فقط)، ونستبدل `baseUrls` بـ:

```ts
// packages/shared/src/integration/index.ts (نسخة العميل)
baseUrls: { bff: config.BFF_BASE_URL },   // لا Odoo/loyalty على العميل
// تُحذف auth.odooApiKey و auth.loyaltyToken و odooAuthHeaders()
```

**الملفات:** إنشاء خدمة `bff/` جديدة (خارج الحِزم الحالية أو كـ workspace رابع). تعديل `packages/shared/src/integration/index.ts:13-40,84-94` (إزالة الأسرار)، `packages/shared/src/config/index.ts:6-9` (إضافة `BFF_BASE_URL`)، وإعادة توجيه `almond-app/services/*.live.ts` و`almond-app/lib/apiClient.ts` إلى BFF.

**المزالق:**
- أي متغيّر ببادئة `EXPO_PUBLIC_`/`NEXT_PUBLIC_` **يُدمَج في الحزمة العامة** بحكم التصميم — تدقيق CI يجب أن يفشل البناء إن ظهرت `ODOO`/`LOYALTY`/`TOKEN`/`KEY` تحت هذه البادئة. (المزلق موجود فعلًا في `integration.ts:36-39`.)
- تدوير (rotate) المفاتيح المسرَّبة سابقًا فورًا؛ كل سرّ سبق دمجه في حزمة منشورة يُعتبر محروقًا.
- CORS: قصر `Access-Control-Allow-Origin` على نطاق GitHub Pages ونطاق الموقع فقط، مع `Authorization` مسموحًا.

**الجهد/الأولوية:** جهد كبير · **أولوية حرجة (P0)** — يحكم كل ما بعده.

---

### 1.2 — Checkout ذرّي: نقطة خادمية واحدة + saga/تعويض + Transactional Outbox

**الهدف:** جعل «ادفع/اشحن المحفظة + أنشئ الطلب + امنح النقاط» عملية **الكل-أو-لا-شيء**، بحيث لا يحدث خصم مزدوج ولا نقاط بلا طلب ولا طلب بلا دفع. اليوم الثلاثة نداءات مستقلّة في `cart.tsx:131-172`؛ فشل `earn` بعد نجاح `chargeWallet` يترك المستخدم مخصومًا بلا نقاط، وإعادة المحاولة تخصم ثانيةً.

**الطريقة المُثلى — نقطة واحدة `POST /v1/checkout`:** العميل يرسل **النيّة** فقط (لا مبالغ محسوبة موثوقة؛ الخادم يعيد التسعير من القائمة والثوابت في `packages/shared/src/config`). عقد الطلب/الاستجابة:

```http
POST /v1/checkout
Authorization: Bearer <JWT>
Idempotency-Key: 5f3e…-v4-uuid            // نيّة واحدة = مفتاح واحد
{
  "branchId": "khalda",
  "type": "pickup",
  "items": [{ "lineId": "latte__M__", "itemId": "latte", "qty": 1,
              "sizeId": "M", "customizations": [] }],
  "paymentMethod": "wallet",              // wallet | cash | card
  "promoCode": "WELCOME10",
  "activatedBonusDay": true,              // العميل يعلن التفعيل؛ الخادم يتحقق
  "curbside": true, "carInfo": "…"
}
```

```jsonc
// 200 OK  (أو إعادة تشغيل نفس الجسم عند مفتاح مكرَّر)
{
  "order": { "id": "order_…", "status": "received", "targetReadyAt": "…",
             "subtotal": 2.5, "tax": 0.4, "discount": 0, "total": 2.9 },
  "wallet": { "balance": 17.10 },         // الرصيد الجديد بعد الخصم
  "loyalty": { "pointsEarned": 22, "balance": 148, "cupProgress": 4 }
}
// 402 payment_failed | 409 insufficient_wallet | 422 price_mismatch
```

**التنسيق داخل BFF (saga مع تعويض + outbox):** إن كان كل شيء داخل Odoo/loyalty-DB نفسها، الأفضل **معاملة DB واحدة** (كما توصي `EXPERT-REVIEW.md:548`). لكن دفع البطاقة يمرّ ببوّابة خارجية لا تشترك في معاملة الـ DB، لذا نستخدم **saga** بخطوات تعويض وترتيب مقصود:

```
1) authorize/charge (بوّابة أو محفظة) ── تعويضه: refund/void
2) createOrder في Odoo                 ── تعويضه: cancel sale order
3) grantPoints في loyalty-DB           ── يُنفَّذ ضمن نفس معاملة (2) إن أمكن
```

- **المحفظة أولًا بذرّية على مستوى الصف:** `UPDATE ewallet SET balance = balance - :amt WHERE user_id=:u AND balance >= :amt RETURNING balance;` والرفض عند `affected-rows = 0` (409). هذا يمنع السباق (race) والرصيد السالب — البديل عن الحارس العميلي الحالي في `cart.tsx:125-128`.
- **Transactional Outbox** لخطوات ما بعد الالتزام (منح النقاط، إشعار FCM، مزامنة POS): تُكتب صفوف outbox داخل **نفس** معاملة إنشاء الطلب، ثم يسحبها relay/worker ويعيد المحاولة حتى النجاح. هذا يضمن أن النقاط تُمنَح «مرّة واحدة بالضبط» منطقيًا حتى لو تعطّل العامل.
- **العميل يتوقّف عن التنسيق:** يُستبدَل جسم `placeOrder` بنداء واحد. يبقى `try/catch` + `showError` الحاليان (`cart.tsx:176-181`) لكن حول نداء واحد.

```ts
// almond-app/services/checkout.service.live.ts (جديد)
export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  const key = getOrCreateIdempotencyKey(input.intentId);   // §1.3
  return apiPost(BFF, '/v1/checkout', input, { 'Idempotency-Key': key });
}
```

**تنسيق مفتاح التفرّد مع الـ saga:** المفتاح يُخزَّن في BFF مع **حالة الـ saga** ونتيجتها؛ إعادة إرسال نفس المفتاح تُرجع الاستجابة الأصلية المخزَّنة بلا إعادة تنفيذ أي خطوة (لا خصم ثانٍ، لا منح ثانٍ) — يحلّ مباشرةً «العميل بلا retry بمهلة 15s» في `apiClient.ts:15`.

**الملفات:** BFF: `checkout` handler + saga + جدول `idempotency_keys` + جدول `outbox`. العميل: إعادة كتابة `almond-app/app/(tabs)/cart.tsx:121-182` لنداء واحد؛ استبدال `almond-app/services/order.service.ts:160-168`, `payment.service.ts:20-23`, `loyalty.service.live.ts:32,43-44` بحيث لا تُستدعى منفصلة عند checkout. نظير الويب `almond-web/src/components/checkout/CheckoutView.tsx`.

**المزالق:**
- **تمثيل المال كأعداد فلس صحيحة** (integer fils) في BFF وDB لتفادي أخطاء الفاصلة العائمة عند 0.16 ضريبة و1.5 مضاعِف (`config` قيم عشرية). التقريب على الحدود فقط.
- إعادة الحساب الخادمي إلزامية: لا تثق بـ `total`/`discount`/`pointsToEarn` القادمة من العميل (هي اليوم من `computeTotals`/`estimateEarnedPoints`، `cart.tsx:84-94`) — أعِد تسعير الخصم من **الكود** و`subtotal` الحيّ (نفس عيب `PromoInput` في `EXPERT-REVIEW.md:39`).
- ترتيب التعويض عكس ترتيب التنفيذ؛ واجعل كل خطوة تعويض idempotent هي الأخرى.
- تحقّق `activatedBonusDay` و`comboBonusPoints` على الخادم، لا تقبل إعلان العميل (اليوم يحسبها العميل: `cart.tsx:164-170`).

**الجهد/الأولوية:** جهد كبير · **أولوية حرجة (P0)**.

---

### 1.3 — مفاتيح التفرّد (Idempotency-Key: UUID v4 من العميل) على كل POST مالي

**الهدف:** ضمان أنّ إعادة الإرسال (شبكة متقطّعة، مهلة 15s، ضغط زر مزدوج) لا تُنفِّذ العملية مرّتين — الخادم يخزّن أوّل نتيجة ويعيد تشغيلها، وفق اتفاقية Stripe/Square/PayPal/Adyen ومسودة IETF `draft-ietf-httpapi-idempotency-key-header`.

**الطريقة المُثلى:**
- **العميل يولّد UUID v4 واحدًا لكل نيّة مستخدم** (لا لكل محاولة HTTP)، ويعيد استخدامه عبر كل محاولات إعادة الإرسال حتى النجاح. المصدر الصحيح للـ UUID: `crypto.randomUUID()` (متاح في RN الحديث وعلى الويب؛ وإن لزم fallback مكتبة `uuid`).
- تخزين المفتاح مربوطًا بالنيّة حتى نجاح النداء ثم إبطاله:

```ts
// almond-app/lib/idempotency.ts (جديد)
const keys = new Map<string, string>();
export function getOrCreateIdempotencyKey(intentId: string): string {
  const k = keys.get(intentId) ?? crypto.randomUUID();
  keys.set(intentId, k);
  return k;                      // يبقى ثابتًا عبر إعادة المحاولات
}
export function clearIdempotencyKey(intentId: string) { keys.delete(intentId); }
```

- **حقنه في `apiClient`:** توسيع الغلاف الحالي (`almond-app/lib/apiClient.ts:8-34`) ليمرّر ترويسة اختيارية، وإضافة **إعادة محاولة بتراجع أُسّي للنداءات الآمنة فقط** (GET، أو POST يحمل مفتاح تفرّد — لأنه آمن التكرار بحكم المفتاح):

```ts
// apiClient: داخل request(...) headers
headers: { ...base, ...(opts.idempotencyKey
  ? { 'Idempotency-Key': opts.idempotencyKey } : {}) }
// retry: على 5xx/timeout فقط، وفقط إن وُجد مفتاح تفرّد. لا retry على 4xx.
```

- **أين نضيفها في خريطة النقاط:** كل مسار مالي في `packages/shared/src/integration/index.ts:44-70` يصبح «يتطلّب مفتاح تفرّد» على مستوى BFF: `earn` (46)، `redeemReward` (47)، `walletTopup` (53)، `walletCharge` (54)، `giftSend`/`giftRedeem` (57,60)، و`/v1/checkout` الجديد. النقاط `GET` (balance/history/wallet/scan-status) تبقى بلا مفتاح.

**عقد الخادم:** يفهرس BFF `(userId, Idempotency-Key)` في جدول `idempotency_keys(key, user_id, request_hash, response_json, status, created_at)`. عند تطابق المفتاح: إن كانت الحالة `completed` يعيد `response_json` (وربما ترويسة `Idempotent-Replayed: true`)؛ إن `in_progress` يعيد `409 conflict` (المحاولة الأصلية جارية)؛ إن اختلف `request_hash` لنفس المفتاح يعيد `422` (سوء استخدام). TTL معقول (مثلًا 24h).

**الملفات:** `almond-app/lib/apiClient.ts:8-47` (ترويسة + retry)، `almond-app/lib/idempotency.ts` (جديد)، `packages/shared/src/integration/index.ts:44-70` (توثيق أيّها يتطلّب مفتاحًا)، BFF: middleware التفرّد + الجدول.

**المزالق:**
- **لا تولّد المفتاح داخل `apiClient`** (سيصنع مفتاحًا جديدًا لكل محاولة ويُبطل الغرض) — يُولَّد أعلى، عند النيّة، ويُمرَّر إلى أسفل.
- إعادة المحاولة على POST بلا مفتاح تفرّد **خطر** (خصم مزدوج) — لذا شرط الـ retry هو وجود المفتاح.
- امسح المفتاح فقط بعد **نجاح مؤكَّد** أو رفض نهائي (4xx)، لا عند timeout.
- خزّن `request_hash` لمنع إعادة استخدام مفتاح لجسم مختلف.

**الجهد/الأولوية:** جهد متوسط · **أولوية حرجة (P0)** — يعمل جنبًا إلى جنب مع 1.2.

---

### 1.4 — الهوية من JWT لا من `userId` العميل

**الهدف:** أن تشتقّ كل عملية هويتها من توكن موقَّع يتحقّق منه الخادم، لا من `userId` قابل للتزوير في جسم الطلب. اليوم `useUserId()` يعيد معرّفًا عشوائيًا أو `'guest'` (`authStore.ts:52-54`)، ويُرسَل في جسم كل نداء (`cart.tsx:133,142-165`, `loyalty.service.live.ts:28-58`)، والنقاط «تثق» به.

**الطريقة المُثلى:**
- **OTP حقيقي على BFF:** `POST /v1/auth/otp/request { phone }` يرسل رمزًا عبر مزوّد SMS، و`POST /v1/auth/otp/verify { phone, code }` يتحقّق ويطابقه بـ `res.partner` في Odoo، ثم يُصدر:

```jsonc
// verify → 200
{ "accessToken": "<JWT 15m>", "refreshToken": "<opaque 30d>",
  "user": { "id": "partner_88", "phone": "+9627…", "name": "…" } }
```

- **JWT قصير العمر (≈15 دقيقة)** يحمل `sub = res.partner id` موقَّعًا (RS256 مفضّل، أو HS256 بسرّ خادمي). كل نقطة BFF تشتقّ `userId = jwt.sub` وتتجاهل أي `userId` في الجسم تمامًا. تجديد بـ refresh token دوّار (rotating).
- **العميل:** يخزّن التوكن (SecureStore على الأجهزة؛ cookie آمن على الويب) ويضعه في `Authorization: Bearer`. `useUserId()` يبقى لعرض الواجهة فقط، ولا يُرسَل كسلطة. حذف `MOCK_OTP='123456'` من مسار الإنتاج (`auth.service.ts:12-18`) وإبقاؤه تحت `mock` فقط عبر حارس إقلاع يرمي خطأ إن كان أي عميل live ما زال alias للـ mock (كما في `EXPERT-REVIEW.md:38`).
- **الضيف:** لا شراء ولا نقاط بلا JWT؛ العميل يوجّه للـ login أصلًا (`cart.tsx:113-118`).

**الملفات:** `almond-app/services/auth.service.ts:12-38` (استبدال mock + إصدار توكن)، `almond-app/stores/authStore.ts:19-54` (تخزين/تجديد التوكن، فصل «هوية العرض» عن «سلطة التوكن»)، `almond-app/lib/apiClient.ts` (حقن `Authorization`)، BFF: `auth/otp/*` + التحقّق من JWT. الويب: `almond-web/src/components/auth/LoginView.tsx`, `almond-web/src/middleware.ts`.

**المزالق:**
- لا تضع الـ JWT في `AsyncStorage` العادي على الأجهزة (استخدم `expo-secure-store`)؛ وعلى الويب احذر XSS (cookie `HttpOnly` أفضل من localStorage).
- تحقّق من `exp` وتوقيع الخادم؛ لا تقرأ الـ claims بلا تحقّق.
- ساعة الأجهزة قد تنحرف — اعتمد وقت الخادم في الصلاحية.

**الجهد/الأولوية:** جهد متوسط-كبير · **أولوية حرجة (P0)**.

---

### 1.5 — توكن مسح/دفع قصير العمر وموقَّع لنقطة البيع (منع إعادة التشغيل)

**الهدف:** منع إعادة تشغيل (replay) رمز الولاء في POS. اليوم QR ثابت: `ALMOND|MEMBER|${userId}|MODE=PAY` (`pay.tsx:44`) — أي التقاط بالكاميرا يُعيد استخدامه للأبد ويكشف `userId`.

**الطريقة المُثلى:**
- **العميل يطلب توكنًا قصير العمر عند فتح شاشة الدفع**، والـ QR يعرض التوكن لا `userId`:

```http
POST /v1/pos/token         Authorization: Bearer <JWT>
{ "mode": "PAY" }          // أو EARN
→ { "token": "<JWS>", "expiresAt": "…", "ttlSeconds": 60 }
```

- **التوكن JWS موقَّع خادميًا** (لا يستطيع العميل تزويره) يحمل `{ sub, mode, jti, exp≈60s, nonce }`. الـ QR يصير `value = token`.
- **POS يستهلكه server-to-server عبر `/pos/scan`** (`integration.ts:68`): يتحقّق BFF من التوقيع و`exp`، ويستهلك `jti` **مرّة واحدة** (single-use؛ رفض التكرار). المسح الثاني لنفس التوكن يُرفَض حتى لو لم تنتهِ المهلة.
- **تدوير تلقائي:** تجديد التوكن كل ~45-60s ما دامت الشاشة مركّزة (يتكامل مع `useFocusEffect` القائم في `pay.tsx:51-72`)، وإيقاف التجديد عند blur.
- **إغلاق حلقة التأكيد** عبر `scanStatus` القائم (`pay.tsx:92-93`, `integration.ts:70`) لعرض النجاح.

```ts
// almond-app/app/(tabs)/pay.tsx — بدل السلسلة الثابتة
const { data: posToken } = usePosToken(mode);      // يجدّد كل 45s
const qrValue = posToken?.token ?? '';             // لا userId في الـ QR
```

**الملفات:** `almond-app/app/(tabs)/pay.tsx:43-44,51-93` (توكن بدل السلسلة)، `almond-app/hooks/useLoyalty.ts` (hook `usePosToken` + تجديد)، `packages/shared/src/integration/index.ts:62-70` (إضافة `posToken`)، BFF: إصدار JWS + جدول `jti` المستهلَك.

**المزالق:**
- بلا `jti` مستهلَك مرّة واحدة، مهلة 60s وحدها تظلّ نافذة إعادة تشغيل — الاثنان معًا ضروريان.
- تفاوت ساعات الأجهزة: اجعل TTL من وقت الخادم، وأعطِ هامش انحراف بسيطًا عند التحقّق.
- بلا شبكة لا يمكن إصدار توكن؛ وفّر حالة «تعذّر إنشاء الرمز، أعد المحاولة» بدل عرض رمز قديم.
- لا تُدرِج `userId` الخام في الـ QR إطلاقًا (تسريب هوية + تمكين انتحال).

**الجهد/الأولوية:** جهد متوسط · **أولوية عالية (P1)** — بعد اكتمال المصادقة (1.4).

---

### ترتيب التنفيذ

1. **إخماد الأسرار في العميل (P0):** تدوير كل مفتاح سبق دمجه؛ حذف `EXPO_PUBLIC_ODOO_API_KEY`/`EXPO_PUBLIC_LOYALTY_TOKEN` من `integration.ts:36-39`؛ إضافة تدقيق CI يفشل البناء عند أي سرّ ببادئة `*_PUBLIC_`. إدخال `BFF_BASE_URL` في `config`.
2. **هيكلة خدمة BFF (P0):** المشروع، قراءة الأسرار من بيئة الخادم، CORS مقيّد، وجدولا `idempotency_keys` و`outbox`.
3. **المصادقة الحقيقية + JWT (P0):** `otp/request|verify` على BFF، ربط `res.partner`، إصدار/تجديد التوكن، تخزينه في SecureStore/cookie، حقن `Authorization` في `apiClient`، وحذف قبول `123456` من مسار live. الخادم يشتقّ الهوية من `jwt.sub` ويتجاهل `userId` الجسم.
4. **بنية التفرّد (P0):** `lib/idempotency.ts` + توسيع `apiClient` بترويسة `Idempotency-Key` وإعادة محاولة أُسّية مشروطة بوجود المفتاح؛ middleware التفرّد في BFF (تخزين/إعادة تشغيل).
5. **`POST /v1/checkout` الذرّي (P0):** saga (دفع→طلب→نقاط) بخطوات تعويض، خصم محفظة ذرّي على مستوى الصف، outbox لمنح النقاط والإشعارات، وإعادة تسعير خادمية (فلس صحيح). إعادة كتابة `cart.tsx:121-182` إلى نداء واحد، وربط الويب `CheckoutView.tsx`.
6. **توكن POS الموقَّع قصير العمر (P1):** `POST /v1/pos/token` (JWS، jti مرّة واحدة، ~60s)، تجديد تلقائي في `pay.tsx`، واستهلاك عبر `/pos/scan` مع إغلاق الحلقة بـ `scanStatus`.
7. **التصلّب (P2):** حراس إقلاع تمنع أي خدمة live من البقاء alias للـ mock؛ اختبارات تكامل لإعادة التشغيل (نفس المفتاح لا يخصم مرّتين) وللتعويض (فشل الخطوة N يتراجع عن 1..N-1)؛ مراقبة صفوف outbox العالقة.

**ملفات مرجعية (مطلقة):** `/home/user/almond/almond-app/app/(tabs)/cart.tsx`, `/home/user/almond/almond-app/app/(tabs)/pay.tsx`, `/home/user/almond/almond-app/lib/apiClient.ts`, `/home/user/almond/almond-app/stores/authStore.ts`, `/home/user/almond/almond-app/services/auth.service.ts`, `/home/user/almond/almond-app/services/payment.service.ts`, `/home/user/almond/almond-app/services/order.service.ts`, `/home/user/almond/almond-app/services/loyalty.service.live.ts`, `/home/user/almond/packages/shared/src/integration/index.ts`, `/home/user/almond/packages/shared/src/config/index.ts`, `/home/user/almond/almond-web/next.config.mjs`.

---

## 2) تكامل Odoo 19

> **القرار المعماري الحاكم (اقرأه أولًا):** التطبيق العميل (React Native/Expo + الويب) يجب ألا يتحدث إلى Odoo مباشرةً. طبقة الخدمات الحالية تشير أصلًا إلى بوابة وسيطة: `config.ODOO_BASE_URL = 'https://api.almond.jo/v1'` (وليس مضيف Odoo الخام) وخادم ولاء منفصل `LOYALTY_BASE_URL = 'https://loyalty.almond.jo'` (`packages/shared/src/config/index.ts:8-11`). نعتمد نمط **BFF/Gateway**: خدمة خلفية واحدة (Node/NestJS أو وحدة تحكم `http.Controller` داخل Odoo نفسه) تحمل مفتاح Odoo API server-side، وتُخاطب Odoo عبر **XML-RPC الخارجي** (`/xmlrpc/2/common` + `/xmlrpc/2/object`) أو `call_kw`، وتُعيد للتطبيق **JSON بشكل أنواعنا الجاهزة** (`MenuItem`, `Order`, `LoyaltyBalance`…). السبب: (1) `call_kw` عبر `/web/dataset/call_kw` يتطلب **session cookie** من تسجيل دخول ويب، وهو غير ملائم لعميل عام؛ (2) مفتاح Odoo API لا يجوز تضمينه في حزمة `EXPO_PUBLIC_*` عامة؛ (3) رياضيات النقاط/الفئات/المحفظة تعيش في `@almond/shared` ويجب أن يعيد استخدامها الـ BFF بدل إعادة تنفيذها داخل Odoo. **مزلق قائم اليوم:** `almond-app/services/menu.service.odoo.ts:13-26` ينشر مباشرةً إلى `${ODOO_BASE_URL}/web/dataset/call_kw` ويعيّن نتائج `product.template` الخام إلى `MenuItem[]` — هذا لن يعمل (حقل `name` في Odoo قاموس ترجمات، لا توجد `sizes`/`customizations`، السعر `list_price`). سنستبدله باستدعاءات REST إلى الـ BFF.

---

### 2.1 معمارية النقل والمصادقة الموحّدة (Transport)

- **الهدف:** قناة واحدة موثوقة بين العميل والـ BFF، مع حقن مصادقة قصيرة العمر ومفتاح تكرار (idempotency) للطلبات المالية.
- **الطريقة المُثلى:**
  - الإبقاء على `lib/apiClient.ts` كناقل وحيد، لكن نُضيف إليه:
    1. حقن **رأس `Idempotency-Key`** (UUID v4 من العميل) على كل `POST` مالي — قرار بحثي مؤكد (اتفاقية Stripe/Square/PayPal ومسودة `draft-ietf-httpapi-idempotency-key-header`): العميل يولّد المفتاح، والخادم يخزّن أول استجابة ويعيد تشغيلها عند التكرار.
    2. حقن **توكن جلسة JWT قصير العمر** من OTP بدل التوكن الثابت `EXPO_PUBLIC_LOYALTY_TOKEN` (يعالج ملاحظة الأمان `docs/ODOO-INTEGRATION.md:76-80`).
  - على RN استخدم `expo-crypto` (`Crypto.randomUUID()`)، وعلى الويب `crypto.randomUUID()`:

```ts
// lib/apiClient.ts — إضافة idempotency + توكن جلسة
import * as Crypto from 'expo-crypto'; // web: globalThis.crypto.randomUUID
const newIdemKey = () =>
  (globalThis.crypto?.randomUUID?.() ?? Crypto.randomUUID());

export function apiPost<T>(base: string, path: string, body: unknown,
  headers?: Record<string,string>, opts?: { idempotent?: boolean }): Promise<T> {
  return request<T>('POST', base, path, {
    body,
    headers: {
      ...(opts?.idempotent ? { 'Idempotency-Key': newIdemKey() } : {}),
      ...(headers ?? {}),
    },
  });
}
```
  - **مهم:** يُولَّد المفتاح **مرة واحدة لكل عملية منطقية** ويُعاد إرساله عبر إعادات TanStack Query. الحل الأنظف: توليد المفتاح في طبقة الخدمة (لا داخل `apiPost`) وتمريره، كي تشترك محاولات إعادة الشبكة في نفس المفتاح.
- **الملفات:** `almond-app/lib/apiClient.ts:8-47` (تعديل)، `packages/shared/src/integration/index.ts:84-94` (`loyaltyAuthHeaders`/`odooAuthHeaders` → تعيد توكن الجلسة).
- **المزالق:** توليد المفتاح داخل `apiPost` يعطي مفتاحًا جديدًا لكل إعادة محاولة فيُبطل الحماية؛ يجب أن يكون ثابتًا لكل عملية. XML-RPC من داخل RN مؤلم — لهذا الـ BFF يبقى الطرف الوحيد الذي يكلّم Odoo.
- **الجهد/الأولوية:** متوسط / **عالية جدًا** (أساس لكل ما بعده).

---

### 2.2 هوية العميل: `res.partner` بمفتاح هاتف +962 + OTP

- **الهدف:** كل عضو = `res.partner` واحد مفتاحه رقم هاتف مُطبّع E.164، ودخول عبر OTP يُرجِع توكن جلسة.
- **الطريقة المُثلى:**
  - تطبيع الرقم إلى `+962...` قبل أي بحث/إنشاء (استخدم `libphonenumber-js`, المنطقة `JO`). خزّنه في `res.partner.mobile` واجعله مفتاح بحث فريدًا.
  - OTP: Odoo لا يملك OTP أصلي للعملاء. الـ BFF يُصدر الرمز عبر مزوّد SMS (Twilio Verify أو بوابة أردنية محلية)، يتحقق، ثم `find-or-create` للـ partner ويعيد JWT.
  - عقود REST مقابلة لـ `authService` (`almond-app/services/auth.service.ts:5-11`):
    - `POST /auth/otp/send` ← `{ phone }` → `{ sent: true }`
    - `POST /auth/otp/verify` ← `{ phone, code }` → `{ user: User, token: string }`
  - تنفيذ `odooAuthService` (حاليًا يُسند إلى mock في `auth.service.ts:36-40`):

```ts
const odooAuthService: AuthService = {
  sendOtp: (phone) => apiPost(LOYALTY_BASE, '/auth/otp/send', { phone: toE164(phone) }),
  verifyOtp: async (phone, code) => {
    const { user, token } = await apiPost<{user:User; token:string}>(
      LOYALTY_BASE, '/auth/otp/verify', { phone: toE164(phone), code });
    saveSessionToken(token); // يُقرأ لاحقًا في loyaltyAuthHeaders()
    return user;
  },
};
```
  - داخل Odoo (BFF): `partner = env['res.partner'].search([('mobile','=',e164)], limit=1) or create({...})`.
- **الملفات:** `almond-app/services/auth.service.ts:36-40`، `packages/shared/src/integration/index.ts:84-94`، نوع `User` (`packages/shared/src/types/index.ts:332-337`) — يُضاف حقل `odooPartnerId?` اختياريًا إن احتجناه، لكن الأفضل إبقاء `userId` = معرّف داخلي والـ BFF يترجمه إلى `partner_id`.
- **المزالق:** تعدد سجلات `res.partner` بنفس الرقم (بيانات Odoo التاريخية) — أضف قيدًا فريدًا أو منطق دمج. لا تُسرّب `partner_id` الرقمي كـ `userId` علنًا (تعداد). الرمز التجريبي `123456` في mock يجب ألا يُفعَّل في الإنتاج.
- **الجهد/الأولوية:** متوسط / عالية.

---

### 2.3 مزامنة المنيو والمعدِّلات والأسعار (Talabat → Odoo products)

- **الهدف:** جعل Odoo مصدر الحقيقة لـ 267 صنفًا/31 فئة مع الأحجام والمعدِّلات والأسعار، مع سكربت بذر لمرة واحدة ثم مزامنة مستمرة.
- **الطريقة المُثلى:**
  - **التعيين (mapping):**
    - `Category` (`types/index.ts:5-11`) → `product.category` (مفتاح ثابت `default_code`/حقل مخصص = `Category.id`).
    - `MenuItem` → `product.template` (`name` مترجم AR/EN عبر `with_context(lang=…)`, `list_price` = السعر المرجعي "Price2", `categ_id`).
    - `ItemSize` (`types/index.ts:32-37`, S/M/L) → **سمة منتج** `product.attribute` "Size" بقيم لها `price_extra`، فتتولّد متغيّرات `product.product`. بديل أبسط: منتج مستقل لكل حجم — لكن السمات أنظف للتقارير.
    - `CustomizationGroup`/`CustomizationOption` مع `priceDelta` (`types/index.ts:16-30`) → في POS استخدم **`product.combo`/attributes** أو خطوط معدِّلات؛ العملي: سمات إضافية (single = `radio`, `multiple` = عدة سمات) مع `price_extra` = `priceDelta`.
    - `imageUrl` (روابط deliveryhero CDN): **لا** تُنزّل 267 صورة إلى `image_1920`؛ احفظ الرابط في حقل مخصص `x_image_url` واجعل الـ BFF يعيده كما هو (التطبيق يعرض `imageUrl` مباشرة).
  - **البذر:** سكربت Node لمرة واحدة يقرأ `generatedItems` من `packages/shared/src/menu/menu.generated.ts` ويستدعي `create/write` عبر XML-RPC، مفاتيح idempotent عبر `default_code = MenuItem.id`:

```ts
// scripts/seed-odoo-menu.ts (يعمل في CI/يدوي، ليس في التطبيق)
for (const it of generatedItems) {
  const id = await rpc('product.template','search',[[['default_code','=',it.id]]]);
  const vals = { name: it.nameEn, list_price: it.sizes[0].price,
    categ_id: catMap[it.categoryId], x_image_url: it.imageUrl ?? false };
  id.length ? await rpc('product.template','write',[id, vals])
            : await rpc('product.template','create',[{ ...vals, default_code: it.id }]);
  // ثم اضبط الترجمة العربية عبر context lang=ar_001، والأحجام كسمات
}
```
  - **القراءة وقت التشغيل:** استبدل `call_kw` الخام بعقود REST من الـ BFF التي تُعيد شكل `MenuItem` جاهزًا:
    - `getCategories` → `GET /menu/categories`
    - `getItems(categoryId)` → `GET /menu/items?category={id}`
    - `getItem(id)` → `GET /menu/items/{id}`، `searchItems(q)` → `GET /menu/search?q={q}`

```ts
// menu.service.odoo.ts — إعادة كتابة على REST بدل call_kw
export const odooMenuService: MenuService = {
  getCategories: () => apiGet(ODOO_BASE, '/menu/categories', odooAuthHeaders()),
  getItems: (categoryId) => apiGet(ODOO_BASE,
    `/menu/items${categoryId && categoryId!=='all' ? `?category=${categoryId}` : ''}`),
  getItem: (id) => apiGet(ODOO_BASE, `/menu/items/${id}`),
  searchItems: (q) => apiGet(ODOO_BASE, `/menu/search?q=${encodeURIComponent(q)}`),
};
```
- **الملفات:** `almond-app/services/menu.service.odoo.ts:13-48` (إعادة كتابة)، `packages/shared/src/menu/menu.generated.ts` (مصدر البذر)، `types/index.ts:39-56` (شكل الهدف).
- **المزالق:** حقل `name` في Odoo مترجم — البحث `ilike` على `name` يبحث بلغة الجلسة فقط؛ اجعل الـ BFF يبحث في العربية والإنجليزية معًا. `list_price` قد يشمل/يستثني الضريبة حسب إعداد الشركة — ثبّت أن الأسعار **بدون ضريبة** والضريبة 16% تُطبّق عبر `TAX_RATE` (`config/index.ts`). مخزون `inStock` يأتي من `qty_available`/إتاحة POS.
- **الجهد/الأولوية:** كبير / عالية.

---

### 2.4 الطلبات: `sale.order` مقابل `pos.order` + نشر تكافئي (idempotent)

- **الهدف:** نشر طلبات التطبيق إلى Odoo كمصدر حقيقة، بلا ازدواج عند إعادة المحاولة، ومزامنة الحالة عكسيًا.
- **القرار والتبرير:** **طلبات التطبيق (order-ahead/توصيل/دفع أونلاين) = `sale.order`**، لأن `pos.order` يتطلب **جلسة POS مفتوحة** و`session_id`/سياق كاشير لا يملكها التطبيق، بينما `sale.order` واجهي بامتياز (خطوط، ضرائب، `partner_id`، دفع إلكتروني، توصيل) والولاء الأصلي في Odoo 17+/19 يسري على أوامر البيع أيضًا. أما **الطلب الحضوري على الكاشير = `pos.order`** ينشئه Odoo POS نفسه (خادم-إلى-خادم؛ التطبيق يعرض QR فقط، §2.7). كلاهما يقيّد النقاط على `loyalty.card` لنفس `res.partner`.
  - (بديل مرفوض: إنشاء `pos.order` عبر API بجلسة "أونلاين" دائمة الفتح — هشّ ويلوّث تقارير POS.)
- **الطريقة المُثلى:** عقد `POST /orders` (BFF) مقابل `CreateOrderInput` (`order.service.ts:5-24`) مع `Idempotency-Key`:

```ts
const odooOrderService: OrderService = {
  createOrder: (input) => apiPost<Order>(ODOO_BASE, '/orders', input,
      odooAuthHeaders(), { idempotent: true }), // مفتاح واحد لكل محاولة دفع
  getOrder: (id) => apiGet(ODOO_BASE, `/orders/${id}`),
  getActiveOrders: (u) => apiGet(ODOO_BASE, `/orders?user=${u}&active=1`),
  getHistory: (u) => apiGet(ODOO_BASE, `/orders?user=${u}`),
  advanceStatus: (id) => apiPost(ODOO_BASE, `/orders/${id}/advance`, {}), // KDS/اختبار فقط
  cancelOrder: (id) => apiPost(ODOO_BASE, `/orders/${id}/cancel`, {}, odooAuthHeaders(), { idempotent: true }),
};
```
  - الـ BFF يبني `sale.order`: `partner_id`, `order_line = [(0,0,{product_id, product_uom_qty, price_unit})...]`, ثم يطبّق المعدِّلات كخطوط بأسعار `priceDelta`، ويؤكّد `action_confirm`، ويعيد `Order` بحالة `received`. تعيين الحالة: Odoo (`draft/sent/sale/done`) أو مراحل KDS → `OrderStatus` (`received/preparing/ready/completed/cancelled`, `types/index.ts:120-125`).
  - **نافذة الإلغاء 30 ثانية** (`order.service.ts:38, 147-157`) تُنفَّذ في الـ BFF: لا يُرسَل للمطبخ إلا بعد انقضائها.
- **الملفات:** `almond-app/services/order.service.ts:160-171` (استبدال الإسناد إلى mock بتنفيذ حي)، `types/index.ts:127-151`.
- **المزالق:** مفتاح idempotency يجب أن يُثبَّت لحظة تأكيد الدفع لا لحظة الإرسال. اتساق الضريبة: احسب `tax/total` في مكان واحد (الـ BFF مصدر الحقيقة، والعميل يعرض فقط) لتفادي اختلاف تقريب مع Odoo. `advanceStatus` وهمي للاختبار فقط — في الإنتاج الحالة تأتي من KDS (§2.8).
- **الجهد/الأولوية:** كبير / عالية.

---

### 2.5 الولاء الأصلي: `loyalty.program` / `loyalty.card` / `loyalty.reward`

- **الهدف:** جعل Odoo دفتر الأستاذ للنقاط (البِنّات)، مع فئات واستبدال، مع إبقاء رياضيات الأرباح في `@almond/shared`.
- **الطريقة المُثلى:**
  - أنشئ في Odoo برنامج `loyalty.program` من نوع `loyalty` (نقاط) واحد "Almond Beans"؛ رصيد كل عضو في `loyalty.card.points`. الجوائز في `loyalty.reward`.
  - **الفئات (tiers) غير أصلية في Odoo** — `bean/silver/gold/black` من الإنفاق المتدحرج 12 شهرًا (`packages/shared/src/loyalty/constants.ts:14-19`). نفّذها كحقل محسوب `x_tier` على `res.partner` من `windowSpend`، والـ BFF يطبّق `multiplier` عند الأرباح.
  - **قرار حاسم:** قواعد `loyalty.rule` الأصلية معدّل ثابت للنقاط، لا تدعم مضاعف الفئة و+50% للمحفظة و"يوم النقاط المضاعفة". لذا **الـ BFF يحسب النقاط بنفس كود `@almond/shared`** (`POINTS_PER_JOD=5`, `WALLET_EARN_MULTIPLIER=1.5`, `BONUS_BEAN_DAY`, `COMBO_BONUS_POINTS`) ثم يعدّل `loyalty.card.points` مباشرةً — Odoo يبقى دفترًا، والحساب موحّد بين mock والحي.
  - العقود مقابلة لخريطة `endpoints` (`integration/index.ts:43-49`) و`liveLoyaltyService` (`loyalty.service.live.ts:27-58`) — **جاهزة أصلًا**:
    - `GET /loyalty/balance/{userId}` → `LoyaltyBalance` (يشمل `windowSpend`,`tier`,`multiplier`,`cup`,`beansExpireAt`)
    - `POST /loyalty/earn` ← `EarnInput{invoiceAmount,paidFromBalance,isFriday,bonusMultiplier,comboBonusPoints}` (`loyalty.service.ts:16-25`) → `EarnResult`
    - `POST /loyalty/redeem-reward` → `{points, voucher}` (يُنشئ `loyalty.reward` مستهلكًا/قسيمة)
    - `GET /loyalty/history/{userId}`, `GET /loyalty/vouchers/{userId}`
  - **البِنّات لا قيمة نقدية لها** أبدًا (نموذج Starbucks، `loyalty.service.ts:56-60`) — لا تحوّلها لمحفظة.
- **الملفات:** `almond-app/services/loyalty.service.live.ts:27-58` (جاهز، لا تعديل)، `packages/shared/src/loyalty/constants.ts`, `packages/shared/src/config/index.ts`, `types/index.ts:171-193`.
- **المزالق:** ازدواج الأرباح — إن حسب Odoo POS نقاطًا أصليًا **و** الـ BFF حسبها، يتضاعف الرصيد؛ عطّل قواعد النقاط الأصلية في برنامج الولاء واجعل BFF المصدر الوحيد للكتابة. انتهاء البِنّات (`BEAN_EXPIRY_MONTHS=12` لـ Bean/Silver فقط) يحتاج مهمة مجدولة (`ir.cron`).
- **الجهد/الأولوية:** كبير / عالية.

---

### 2.6 المحفظة (e-wallet) وبطاقات الهدايا (gift cards)

- **الهدف:** قيمة مخزّنة قابلة للشحن والخصم، وبطاقات هدايا تصبّ في المحفظة.
- **الطريقة المُثلى:**
  - في Odoo 17+/19 كلاهما **نوعا `loyalty.program`**: المحفظة = `ewallet`، الهدية = `gift_card`، والرصيد في `loyalty.card` (وحدة عملة). هذا يوحّد المحفظة/الهدايا/النقاط تحت نفس البنية.
  - العقود جاهزة في `liveLoyaltyService` وخريطة `endpoints` (`integration/index.ts:52-60`):
    - `GET /loyalty/wallet/{userId}` → `{balance}`
    - `POST /loyalty/wallet/topup` ← `{userId,amount}` → `{balance}` (يمنح `WALLET_RELOAD_BONUS` بِنّات، `config/index.ts`)
    - `POST /loyalty/wallet/charge` ← `{userId,amount}` → `{walletBalance}` (دفع داخل التطبيق و POS؛ الدفع من المحفظة يربح +50% بِنّة)
    - `POST /loyalty/gifts/send`، `GET /loyalty/gifts/sent/{userId}`، `POST /loyalty/gifts/redeem` → `{amount, walletBalance}`
  - **إلزامي:** `walletTopup`, `walletCharge`, `giftSend`, `giftRedeem` عمليات مالية → `Idempotency-Key` (عدّل `liveLoyaltyService` لتمرير `{idempotent:true}`؛ حاليًا `loyalty.service.live.ts:41-50` لا يمرّره).
- **الملفات:** `almond-app/services/loyalty.service.live.ts:39-50`، `types/index.ts:317-328` (`GiftCard`).
- **المزالق:** بلا idempotency، ضغطة شحن مزدوجة = سحب مزدوج. الهدايا الجماعية = استدعاء لكل مستلم، كل واحد بمفتاحه الخاص. تحقّق من `redeemed` قبل الصرف لمنع الاستبدال المزدوج للرمز.
- **الجهد/الأولوية:** متوسط / عالية.

---

### 2.7 نقطة البيع: مسح QR للربح/الاستبدال/الخصم عند الكاشير

- **الهدف:** ربط/خصم/شحن عند الكاشير الفعلي عبر مسح رمز العضو، بلا استدعاء التطبيق لنقاط الحساسة.
- **الطريقة المُثلى:** المسار موصّف في `docs/ODOO-INTEGRATION.md:23-40`:
  - Odoo POS يمسح `ALMOND|MEMBER|{userId}|MODE=PAY|EARN` ويُرسِل **خادم-إلى-خادم** `POST /pos/scan` ← `{memberId,mode,invoiceAmount,paidFromWallet,branchId}`؛ الخادم يربح البِنّات، يستبدل أي جائزة مطبّقة، ويخصم المحفظة إن `paidFromWallet`. (`integration/index.ts:62-70`.)
  - التطبيق **لا يستدعي `/pos/scan`**؛ يستقصي فقط `GET /loyalty/scan-status/{userId}` عبر `useScanStatus` (نشط حين `integration.enabled.pos`) ويحدّث الرصيد عند `scanned:true`.
  - على جانب Odoo: `MODE=PAY` ينشئ `pos.order` مدفوعًا (نقد/بطاقة/محفظة) ويربح؛ `MODE=EARN` ربح فقط. الربح يكتب على نفس `loyalty.card` للعضو.
  - **الأمان:** استبدل QR الثابت (`app/(tabs)/pay.tsx` `qrValue`) برمز **دوّار قصير العمر يُصدره الخادم/POS** (`docs/ODOO-INTEGRATION.md:80`) لمنع إعادة الاستخدام.
- **الملفات:** `packages/shared/src/integration/index.ts:62-70`, `almond-app/services/loyalty.service.live.ts:53`, `app/(tabs)/pay.tsx`.
- **المزالق:** الاستقصاء اللانهائي يستنزف البطارية — حدّه بمهلة (≈2 دقيقة) وأوقفه عند مغادرة الشاشة. رمز ثابت = خطر إعادة تشغيل الربح. تأكّد أن POS لا يحسب نقاطًا أصليًا مزدوجًا مع الـ BFF (نفس مزلق §2.5).
- **الجهد/الأولوية:** متوسط / متوسطة (يعتمد على جاهزية POS الفعلي).

---

### 2.8 Webhooks مقابل Polling لتحديث حالة الطلب

- **الهدف:** انعكاس تقدّم المطبخ (KDS) إلى التطبيق فورًا.
- **الطريقة المُثلى:**
  - **MVP: استقصاء** عبر TanStack Query `refetchInterval` على `getOrder/getActiveOrders` (نفس نمط `useScanStatus` القائم).
  - **الإنتاج: Webhooks**. في Odoo `base.automation`/فعل خادمي عند تغيّر حالة `sale.order`/`pos.order` أو مرحلة KDS → `POST` إلى الـ BFF → **إشعار دفع Expo** للجهاز. يقلّل الاستقصاء ويعطي فورية. أبقِ الاستقصاء كاحتياط.
- **الملفات:** `almond-app/services/order.service.ts` (خطاف الحالة)، `almond-app/services/notification.service.ts` (موجود — قناة الدفع).
- **المزالق:** Webhook بلا توقيع = تزوير حالة؛ وقّع الحمولة (HMAC) وتحقّق في الـ BFF. الأفعال الخادمية في Odoo قد تُطلَق داخل معاملة قبل commit — أطلق الـ POST بعد الالتزام (`ir.cron`/طابور) لا داخل `write`.
- **الجهد/الأولوية:** متوسط / متوسطة.

---

### 2.9 قلب `config.DATA_SOURCE` من mock إلى odoo دون لمس الواجهة

- **الهدف:** تفعيل الإنتاج بتبديل مفتاح واحد، مع إمكانية إحضار نظام واحد أولًا.
- **الطريقة المُثلى:**
  1. اضبط أسرار البناء: `EXPO_PUBLIC_ODOO_API_KEY`, `EXPO_PUBLIC_LOYALTY_TOKEN` (أو الأفضل توكن جلسة OTP، §2.1)، وحدّث `ODOO_BASE_URL`/`LOYALTY_BASE_URL` (`config/index.ts:8-11`).
  2. نفّذ أجساد الخدمات الحية المُعطّلة حاليًا (كلها تُسند إلى mock الآن): `odooOrderService` (`order.service.ts:160-168`), `odooAuthService` (`auth.service.ts:36-40`), `odooMenuService` (`menu.service.odoo.ts` — إعادة كتابة على REST). خدمات الولاء/المحفظة/الهدايا/المسح **جاهزة** في `loyalty.service.live.ts`.
  3. اقلب `config.DATA_SOURCE = 'odoo'` — كل الموزّعات تتفرّع عليه (`menu.service.ts:14-15`, `order.service.ts:170-171`, `loyalty.service.ts:99-100`, `auth.service.ts`)؛ الواجهة لا تتغيّر.
- **مزلق حاسم (عدم تطابق):** الموزّعات تتفرّع على `config.DATA_SOURCE === 'odoo'`، بينما مفاتيح `integration.enabled.{loyalty,wallet,gift,pos,delivery}` (`integration/index.ts:21-27`) **منفصلة** ولا تقرأها الموزّعات. لإحضار نظام واحد أولًا (مثلًا الولاء قبل الطلبات) يجب تعديل الموزّع ليقرأ العَلَم المعني، مثل: `loyaltyService = integration.enabled.loyalty ? liveLoyaltyService : mockLoyaltyService;` بدل `config.DATA_SOURCE`. بدون ذلك التبديل كله-أو-لا-شيء.
- **الملفات:** `packages/shared/src/config/index.ts`, `packages/shared/src/integration/index.ts:21-27`, وموزّعات الخدمات الأربعة أعلاه.
- **الجهد/الأولوية:** صغير (بعد اكتمال ما قبله) / عالية.

---

### ترتيب التنفيذ

1. **الـ BFF والناقل:** أقم بوابة `api.almond.jo`/`loyalty.almond.jo` أمام Odoo (XML-RPC server-side)، وأضِف `Idempotency-Key` + توكن جلسة إلى `apiClient.ts` (§2.1). أساس لكل شيء.
2. **الهوية + OTP:** طبّع +962، نفّذ `odooAuthService` و`find-or-create res.partner`، أعِد JWT (§2.2).
3. **مزامنة المنيو:** سكربت بذر `menu.generated → product.template/category/attributes`، ثم أعِد كتابة `menu.service.odoo.ts` على REST (§2.3).
4. **الولاء والمحفظة والهدايا:** فعّل برامج `loyalty.program` (نقاط/ewallet/gift_card)، اجعل الـ BFF يحسب بـ `@almond/shared`، ومرّر idempotency في `loyalty.service.live.ts` (§2.5, §2.6). العميل جاهز.
5. **الطلبات:** نفّذ `odooOrderService` على `sale.order` مع نافذة الإلغاء 30ث ونشر تكافئي (§2.4).
6. **POS scan:** نسّق مع فريق POS على `/pos/scan` خادم-إلى-خادم ورمز QR دوّار، وأبقِ استقصاء `scan-status` محدودًا (§2.7).
7. **الحالة الفورية:** استقصاء أولًا، ثم Webhooks موقّعة + دفع Expo (§2.8).
8. **القلب:** اضبط الأسرار، عدّل الموزّعات لقراءة `integration.enabled.*` للطرح التدريجي، ثم اقلب `DATA_SOURCE='odoo'` (§2.9).

---

## 3) موقع Next.js — SEO والأداء

> **قراءة الوضع الحالي (ما هو موجود فعلاً):** `almond-web/` يعمل على `Next.js 15.5.19 + React 19 + next-intl 3.26` (`almond-web/package.json`). التوجيه ثنائي اللغة عبر segment ديناميكي `src/app/[locale]/` مع `localePrefix: 'as-needed'` (العربية على `/` بلا بادئة، الإنجليزية على `/en`) — `src/i18n/routing.ts:7`. القائمة معروفة وقت البناء (تُقرأ متزامنة من `@almond/shared/menu` عبر `src/data/menu.ts`). 
>
> **الناقص بالكامل (هذا نطاق عملنا):** لا `metadataBase`، لا `alternates`/hreflang، لا `openGraph`، لا JSON-LD schema.org في أي صفحة، لا `sitemap.ts`/`robots.ts`/`manifest`، لا `generateStaticParams` لصفحة المنتج `[id]` (فتُصيَّر عند الطلب لا SSG)، الخطوط `.ttf` ثقيلة (~112KB لكل ملف، `src/app/fonts/*.ttf`) بلا WOFF2/`size-adjust`/preload، و`next/image` يستعمل الـ loader الافتراضي بلا loader مخصص لـ deliveryhero ولا `formats`/`deviceSizes`، ولا Lighthouse-CI. `generateMetadata` في صفحة المنتج تضبط `title` فقط (`src/app/[locale]/menu/[id]/page.tsx:8`).

---

### 3.0) قرار معماري حاكم: هدف النشر (Vercel/Node مقابل static export)

**الهدف:** حسم هذا أولاً لأنه يحدد نصف القرارات التالية.

**الطريقة المُثلى:** هناك تعارض جوهري يجب حسمه صراحة:
- **`output: 'export'` (static → GitHub Pages، كما ينشر التطبيق):** الـ **middleware لا يعمل** على استضافة ثابتة، فتوجيه اللغة القائم على `src/middleware.ts` (next-intl middleware) **يسقط**؛ ويجب توليد كل المسارات لكل لغة عبر `generateStaticParams`. كذلك **مُحسِّن الصور الافتراضي لـ `next/image` معطَّل** فيلزم `loaderFile` مخصص.
- **Vercel/Node (المُفضّل في `docs/WEBSITE-HANDOFF.md §2`):** الـ middleware ومُحسِّن الصور و ISR كلها تعمل.

**التوصية:** انشر على **Vercel/Node** لأنه يفتح ISR (لوضع `odoo`) والـ middleware و blur تلقائي. إن فُرض GitHub Pages، انتقل لملحق §3.8. **لا تترك القرار ضمنياً** — عدّل `next.config.mjs` صراحة.

**الملفات:** `almond-web/next.config.mjs`، `almond-web/src/middleware.ts`.

**المزالق:** خلط الوضعين (middleware موجود + `output:'export'`) يعطي بناءً «ناجحاً» لكن روابط اللغة تنكسر صامتة في الإنتاج.

**الجهد/الأولوية:** صغير / **P0 (حاجز)**.

---

### 3.1) استراتيجية التصيير لكل نوع صفحة (SSG/ISR/SSR)

**الهدف:** أسرع HTML ممكن للصفحات القابلة للفهرسة، مع بقاء الصفحات الشخصية ديناميكية.

**الطريقة المُثلى:** بما أن القائمة معروفة وقت البناء، اجعلها **SSG بالكامل** واستعمل ISR فقط عند تفعيل `odoo`:

| نوع الصفحة | المسار | الوضع | كيف |
|---|---|---|---|
| الرئيسية | `[locale]/page.tsx` | SSG | ثابت افتراضياً |
| القائمة | `[locale]/menu/page.tsx` | SSG | ثابت |
| المنتج | `[locale]/menu/[id]/page.tsx` | **SSG (ناقص!)** | أضِف `generateStaticParams` |
| الفروع | `[locale]/branches/page.tsx` | SSG | ثابت |
| السلة/الدفع/الحساب | `cart`, `checkout`, `account` | CSR/ديناميكي | `export const dynamic = 'force-dynamic'` أو تبقى client |

سكتش `generateStaticParams` لصفحة المنتج (يولّد 267 صفحة × لغتين، معروفة وقت البناء) — يُضاف إلى `src/app/[locale]/menu/[id]/page.tsx`:

```ts
import { getAllItems } from '@/data/menu';
import { routing } from '@/i18n/routing';

// يجعل صفحات المنتج SSG بدل on-demand.
export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    getAllItems().map((item) => ({ locale, id: item.id })),
  );
}

// مفتاح تفعيل ISR فقط عند مصدر odoo (لا أثر في mock: يبقى ثابتاً أبدياً).
export const revalidate = 900; // 15 دقيقة
```

للتحكم المركزي بـ ISR اربط `revalidate` بـ `DATA_SOURCE` (`src/lib/config.ts`): في `mock` اجعله `false` (ثابت أبدي)، في `odoo` اجعله `900`.

**الملفات:** `src/app/[locale]/menu/[id]/page.tsx`، `src/app/[locale]/menu/page.tsx`، `src/lib/config.ts`، وصفحات `cart/checkout/account`.

**المزالق:** (1) بدون `generateStaticParams` صفحة المنتج تُصيَّر عند الطلب وتنكسر تماماً تحت `output:'export'`. (2) صفحة الفروع الحالية تستدعي `useTranslations` كـ Server Component (`branches/page.tsx:2`) — سليم في next-intl، لكن `isBranchOpen` يجب أن يبقى client-only (كما هو مُوثّق في `data/branches.ts:11`) وإلا حدث hydration mismatch على الوقت.

**الجهد/الأولوية:** صغير / **P0**.

---

### 3.2) بنية الميتاداتا + hreflang (ar-JO / en-JO / x-default)

**الهدف:** canonical صحيح وبدائل لغوية سليمة لكل صفحة، وربط ملكية النطاق.

**الطريقة المُثلى:** أضِف `metadataBase` وبدائل hreflang في الجذر، ثم أنشئ مُساعِداً موحّداً `buildAlternates(locale, pathname)` يحترم `localePrefix:'as-needed'` (العربية بلا بادئة، الإنجليزية بـ `/en`، و`x-default` → جذر العربية).

في `src/app/[locale]/layout.tsx` (توسيع الكتلة `metadata` الحالية سطر 27):

```ts
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://almond.jo'),
  title: { default: 'Almond Coffee House', template: '%s · Almond Coffee House' },
  description: '…',
  openGraph: { type: 'website', siteName: 'Almond Coffee House', images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image' },
};
```

مُساعِد hreflang جديد `src/lib/seo.ts`:

```ts
import type { Metadata } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://almond.jo';

/** path مثل '' أو '/menu' أو `/menu/${id}` (بلا بادئة لغة). */
export function alternates(path: string): Metadata['alternates'] {
  const ar = `${SITE}${path}`;          // العربية على الجذر
  const en = `${SITE}/en${path}`;       // الإنجليزية على /en
  return {
    canonical: undefined,               // يُضبط لكل لغة أدناه
    languages: {
      'ar-JO': ar,
      'en-JO': en,
      'x-default': ar,                  // الافتراضي = العربية (تطابق defaultLocale)
    },
  };
}

/** canonical للغة الحالية + كل البدائل. */
export function pageMeta(locale: string, path: string, m: Metadata = {}): Metadata {
  const SITE_ = SITE;
  const self = locale === 'en' ? `${SITE_}/en${path}` : `${SITE_}${path}`;
  return { ...m, alternates: { ...alternates(path), canonical: self } };
}
```

ثم في `generateMetadata` لصفحة المنتج (استبدال المنطق الحالي في `menu/[id]/page.tsx:8`):

```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const { locale, id } = await params;
  const item = getItemById(id);
  if (!item) return {};
  const name = locale === 'ar' ? item.nameAr : item.nameEn;
  const desc = (locale === 'ar' ? item.descAr : item.descEn) ?? undefined;
  return pageMeta(locale, `/menu/${id}`, {
    title: name,
    description: desc,
    openGraph: { title: name, description: desc,
      images: item.imageUrl ? [{ url: cdnLoaderUrl(item.imageUrl, 1200) }] : [] },
  });
}
```

**الملفات:** جديد `src/lib/seo.ts`؛ تعديل `src/app/[locale]/layout.tsx`، وكل `page.tsx` (رئيسية/قائمة/منتج/فروع) لتستدعي `pageMeta`. متغير بيئة جديد `NEXT_PUBLIC_SITE_URL`.

**المزالق:** (1) **الأهم — خاص بالإصدار:** مع `localePrefix:'as-needed'` العربية على الجذر بلا `/ar`؛ لا تُصدِر `hreflang="ar-JO"` يشير إلى `/ar/...` (يعطي 404/redirect). (2) next-intl 3.x لا يحقن hreflang تلقائياً — لا تعتمد عليه، ابنِه يدوياً كما أعلاه. (3) استعمل رموز إقليمية `ar-JO`/`en-JO` لا `ar`/`en` المجردة لأن السوق أردني. (4) `metadataBase` غيابه يجعل صور OG نسبية فتنكسر عند المشاركة.

**الجهد/الأولوية:** متوسط / **P0**.

---

### 3.3) بيانات schema.org المنظّمة (JSON-LD)

**الهدف:** نتائج غنية في Google (بطاقات مطعم/قائمة/أسعار) وربط الفروع كـ LocalBusiness.

**الطريقة المُثلى:** مكوّن خادِم صغير يحقن `<script type="application/ld+json">` مع تهريب XSS، وبنّاءات لكل نوع. القيم كلها من `@almond/shared` (لا تكرار).

`src/components/seo/JsonLd.tsx`:

```tsx
export function JsonLd({ data }: { data: Record<string, unknown> | unknown[] }) {
  return (
    <script
      type="application/ld+json"
      // Next لا يهرّب JSON-LD؛ اقطع '<' لمنع حقن السكربت.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
```

**(أ) المنتج → `MenuItem` + `Offer`** (في صفحة المنتج، بعد `ItemConfigurator`):

```ts
const jsonLd = {
  '@context': 'https://schema.org', '@type': 'MenuItem',
  name: locale === 'ar' ? item.nameAr : item.nameEn,
  description: locale === 'ar' ? item.descAr : item.descEn,
  image: item.imageUrl,
  offers: item.sizes.map((s) => ({
    '@type': 'Offer', price: s.price.toFixed(3), priceCurrency: 'JOD',
    availability: item.inStock === false
      ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    name: locale === 'ar' ? s.nameAr : s.nameEn,
  })),
};
```

**(ب) صفحة القائمة → `Restaurant` + `hasMenu`/`Menu`/`MenuSection`** (بنّاء في `src/lib/jsonld.ts` يقرأ `getMenuSections()`):

```ts
{
  '@context': 'https://schema.org', '@type': 'Restaurant',
  name: 'Almond Coffee House', servesCuisine: 'Coffee & Specialty',
  priceRange: '$$', address: { '@type': 'PostalAddress', addressCountry: 'JO', addressLocality: 'Amman' },
  hasMenu: {
    '@type': 'Menu',
    hasMenuSection: sections.map((s) => ({
      '@type': 'MenuSection',
      name: locale === 'ar' ? s.category.nameAr : s.category.nameEn,
      hasMenuItem: s.items.map((i) => ({
        '@type': 'MenuItem',
        name: locale === 'ar' ? i.nameAr : i.nameEn,
        offers: { '@type': 'Offer', price: itemFromPrice(i).toFixed(3), priceCurrency: 'JOD' },
      })),
    })),
  },
}
```

**(ج) الفروع → `LocalBusiness`/`CafeOrCoffeeShop`** (لكل فرع من `getBranches()`، `data/branches.ts`؛ الحقول `lat/lng/hours` متوفرة، `hours.close:"24:00"`):

```ts
branches.map((b) => ({
  '@context': 'https://schema.org', '@type': 'CafeOrCoffeeShop',
  name: locale === 'ar' ? b.nameAr : b.nameEn,
  geo: { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng },
  address: { '@type': 'PostalAddress',
    addressLocality: locale === 'ar' ? b.areaAr : b.areaEn, addressCountry: 'JO' },
  openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification',
    opens: b.hours.open, closes: b.hours.close === '24:00' ? '23:59' : b.hours.close,
    dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] }],
}))
```

**الملفات:** جديد `src/components/seo/JsonLd.tsx`، `src/lib/jsonld.ts`؛ حقن في `menu/page.tsx`، `menu/[id]/page.tsx`، `branches/page.tsx`، و`Organization` واحد في `layout.tsx`.

**المزالق:** (1) `24:00` غير صالح في `OpeningHoursSpecification` — حوّله لـ `23:59`. (2) سعر `Offer` يجب أن يطابق السعر المرئي حرفياً (JOD بثلاث خانات، `.toFixed(3)`) وإلا حذّر Search Console. (3) لا تضع JSON-LD في Client Component — أبقِه خادِماً كي يظهر في HTML الأولي. (4) الفروع تفتقر `telephone`/`streetAddress` في `@almond/shared` — أضِفهما للـ seed لاحقاً لبطاقة LocalBusiness كاملة.

**الجهد/الأولوية:** متوسط / **P1**.

---

### 3.4) Loader مخصص لـ `next/image` لصور deliveryhero

**الهدف:** AVIF/WebP + srcset + blur، مع تقليل البايتات 70-90% كما في `almond-app/lib/cdnImage.ts`.

**الطريقة المُثلى:** الحالة الراهنة تستعمل الـ loader الافتراضي (`MenuItemCard.tsx:43`) الذي يمرّ الصور عبر مُحسِّن Next — يعمل على Vercel لكنه (أ) يُهدر مُحسِّن Next بينما الـ CDN نفسه يفاوض WebP/AVIF عبر `Accept`، و(ب) يسقط تماماً تحت `output:'export'`. الأمثل: **loader يوجّه مباشرة لـ CDN** ويستفيد من معامل `width` الذي يحترمه CDN.

`src/lib/imageLoader.ts` (يعكس `cdnImage.ts` لكن بتوقيع Next loader):

```ts
import type { ImageLoaderProps } from 'next/image';

/** يطلب من CDN عرضاً بعينه؛ CDN يفاوض WebP/AVIF عبر Accept. لغير-CDN: تمرير كما هو. */
export default function cdnLoader({ src, width }: ImageLoaderProps): string {
  if (!src.includes('images.deliveryhero.io')) return src; // شعارات محلية مثلاً
  const u = new URL(src);
  u.searchParams.set('width', String(width)); // srcset يستدعي بكل عرض من deviceSizes
  return u.toString();
}
```

وربطه في `next.config.mjs` (توسيع كتلة `images` سطر 10) + ضبط الأعرض والصيغ:

```js
images: {
  loader: 'custom',
  loaderFile: './src/lib/imageLoader.ts',
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [96, 160, 320, 640, 828, 1080, 1200],  // 96 = مقاس البطاقة المصغّرة
  imageSizes: [96, 128, 256],
  remotePatterns: [{ protocol: 'https', hostname: 'images.deliveryhero.io' }],
}
```

blur لصور بعيدة: لا يستطيع Next توليد `blurDataURL` تلقائياً لمصدر خارجي، فمرّر placeholder ثابت خفيف. أنشئ ثابتاً مشتركاً واستعمله في `MenuItemCard.tsx` وصفحة المنتج:

```tsx
const BLUR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0i…';  // shimmer 8×8 رمادي
<Image src={item.imageUrl} alt={name} fill sizes="96px"
  loader={cdnLoader} placeholder="blur" blurDataURL={BLUR}
  className="object-contain p-1.5" />
```

**الملفات:** جديد `src/lib/imageLoader.ts`، ثابت `BLUR` في `src/lib/image.ts`؛ تعديل `next.config.mjs`, `src/components/menu/MenuItemCard.tsx:43`, `home/ProductCard.tsx`, `home/FeaturedRow.tsx`, صفحة المنتج/`ItemConfigurator`.

**المزالق:** (1) عند `loader:'custom'` يجب أن يوفّر الـ loader كل الأعرض عبر `deviceSizes`؛ لا تنسَ `sizes` دقيقاً على كل `<Image>` وإلا حمّل المتصفح أكبر عرض. (2) صور الـ hero و«الطلب المعتاد» فوق الطية يجب أن تحمل `priority` (تعطّل lazy) لتحسين LCP — الحالي لا يضع `priority` في أي مكان. (3) الـ CDN يتجاهل `width` إن كان الرابط يحوي `?` مسبقاً (كما ينبّه `cdnImage.ts`) — تحقّق أن روابط `menu.generated.ts` نظيفة. (4) `object-contain p-1.5` يعني أن أبعاد الملف الأصلي أكبر من المعروض — العرض المطلوب من CDN يقلّل ذلك.

**الجهد/الأولوية:** متوسط / **P0** (أثر مباشر على LCP وعلى صلاحية static export).

---

### 3.5) استراتيجية الخط العربي WOFF2 (swap / preload / size-adjust)

**الهدف:** إزالة عبء ~336KB من TTF وتقليل CLS الناتج عن تبدّل الخط.

**الطريقة المُثلى:** الحالة: `next/font/local` مع ثلاثة ملفات `.ttf` (`layout.tsx:17-25`, `display:'swap'`). المشاكل: TTF غير مضغوط (WOFF2 يوفّر ~40-50%)، لا `preload`، لا `size-adjust`/`fallback` فيحدث layout shift عند تبديل الخط.

الخطوات:
1. **حوّل + جزّئ** الملفات الثلاثة إلى WOFF2 مع الحفاظ على المحارف العربية + اللاتينية + الأرقام + علامات JOD:

```bash
# fonttools + Brotli
pyftsubset HelveticaNeueArabic-Roman.ttf \
  --unicodes="U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF,U+0020-007E,U+00A0-00FF" \
  --layout-features='*' --flavor=woff2 --output-file=hn-arabic-roman.woff2
```

2. حدّث `next/font/local` لتشير إلى WOFF2 وأضِف `preload` + `adjustFontFallback`:

```ts
const hnArabic = localFont({
  src: [
    { path: '../fonts/hn-arabic-light.woff2', weight: '300', style: 'normal' },
    { path: '../fonts/hn-arabic-roman.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/hn-arabic-bold.woff2',  weight: '700', style: 'normal' },
  ],
  variable: '--font-hn-arabic',
  display: 'swap',
  preload: true,           // يحقن <link rel=preload> للوزن الأساسي
  fallback: ['system-ui', 'Segoe UI', 'Tahoma', 'Arial'],
  adjustFontFallback: 'Arial', // يحسب size-adjust/ascent تلقائياً ⇒ CLS≈0
});
```

3. إن تعذّر `adjustFontFallback`، اضبط يدوياً في `globals.css` عبر `@font-face` احتياطي بـ `size-adjust`/`ascent-override` لمطابقة مقاييس عربية.

**الملفات:** `src/app/fonts/*.woff2` (جديدة)، حذف `.ttf` القديمة، `src/app/[locale]/layout.tsx:17`، احتمال `src/app/globals.css`.

**المزالق:** (1) التجزئة العدوانية قد تُسقط محارف عربية نادرة أو أشكال ligature — أبقِ نطاق U+FB50-FDFF (Arabic Presentation Forms) و`--layout-features='*'` للحفاظ على تشكيل الحروف المتصلة، وإلا تظهر الكلمات مقطّعة. (2) `next/font/local` يعمل preload تلقائياً فقط للوزن الوحيد؛ مع 3 أوزان قد لا يُحمَّل الأساسي أولاً — أبقِ الأوزان الفعلية المستعملة فقط (الـ headings تستعمل Bold حسب `globals.css`). (3) `display:'swap'` صحيح لكنه يسبب FOUT قصيراً؛ `size-adjust` يمنع القفزة لا الوميض.

**الجهد/الأولوية:** صغير-متوسط / **P1**.

---

### 3.6) sitemap.ts + robots.ts + manifest + opengraph-image

**الهدف:** فهرسة كاملة للـ 267 منتجاً × لغتين + الصفحات الثابتة، وصورة مشاركة موحّدة.

**الطريقة المُثلى:** استعمل واجهات Next 15 التوليدية (Metadata Routes) لتوليد ثابت وقت البناء:

`src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next';
import { getAllItems } from '@/data/menu';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://almond.jo';
const STATIC = ['', '/menu', '/branches', '/rewards', '/gifts', '/franchise', '/careers'];

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (loc: string, p: string) => (loc === 'ar' ? `${SITE}${p}` : `${SITE}/en${p}`);
  const rows: MetadataRoute.Sitemap = [];
  for (const p of STATIC)
    rows.push({ url: url('ar', p), changeFrequency: 'weekly', priority: p === '' ? 1 : 0.7,
      alternates: { languages: { 'ar-JO': url('ar', p), 'en-JO': url('en', p) } } });
  for (const it of getAllItems())
    rows.push({ url: url('ar', `/menu/${it.id}`),
      alternates: { languages: { 'ar-JO': url('ar', `/menu/${it.id}`), 'en-JO': url('en', `/menu/${it.id}`) } } });
  return rows;
}
```

`src/app/robots.ts`: يمنع `/cart`, `/checkout`, `/account`, `/admin` ويشير إلى الـ sitemap:

```ts
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/cart', '/checkout', '/account', '/admin', '/login', '/wallet'] },
    sitemap: `${SITE}/sitemap.xml` };
}
```

أضِف كذلك `src/app/manifest.ts` (PWA/أيقونات من `public/logo/`) و`src/app/opengraph-image.tsx` (توليد ديناميكي عبر `next/og` ImageResponse — لكن ImageResponse لا يعمل تحت static export، فوفّر PNG ثابتاً في `public/` كبديل).

**الملفات:** جديد `src/app/sitemap.ts`، `src/app/robots.ts`، `src/app/manifest.ts`، `src/app/opengraph-image.tsx` (أو PNG ثابت).

**المزالق:** (1) بادئة اللغة: العربية بلا `/ar` — لا تولّد `${SITE}/ar/...`. (2) استبعِد الصفحات الشخصية من الـ sitemap ومن الفهرسة معاً. (3) `next/og` ImageResponse يتطلب runtime — إن نُشر static استعمل PNG جاهزاً. (4) صفحة `admin` يجب أن تُمنع في robots و`noindex` معاً.

**الجهد/الأولوية:** صغير / **P1**.

---

### 3.7) ميزانيات Lighthouse-CI في CI (LCP<2.5s / INP<200ms / CLS<0.1 + JS budget)

**الهدف:** منع تدهور الأداء تلقائياً في كل PR بحدود قابلة للفشل.

**الطريقة المُثلى:** أضِف `@lhci/cli` وملف تهيئة يبني الموقع، يشغّل خادماً، ويفحص مسارات ممثِّلة (رئيسية/قائمة/منتج) عربية وإنجليزية، مع assertions حاجزة.

`almond-web/lighthouserc.json`:

```json
{
  "ci": {
    "collect": {
      "startServerCommand": "npm run start",
      "url": [
        "http://localhost:3000/",
        "http://localhost:3000/menu",
        "http://localhost:3000/menu/<popular-item-id>",
        "http://localhost:3000/en/menu"
      ],
      "numberOfRuns": 3,
      "settings": { "preset": "desktop" }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "resource-summary:script:size": ["error", { "maxNumericValue": 180000 }],
        "resource-summary:font:size": ["warn", { "maxNumericValue": 180000 }],
        "unused-javascript": ["warn", { "maxNumericValue": 40000 }]
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```

خطوة CI (GitHub Actions) — `.github/workflows/web-lighthouse.yml`:

```yaml
name: web-lighthouse
on: { pull_request: { paths: ['almond-web/**', 'packages/shared/**'] } }
jobs:
  lhci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run web:build
      - run: npx --workspace almond-web @lhci/cli autorun
```

**ملاحظات خاصة بالمقاييس:** INP و CLS مقياسان ميدانيان (field) لا يقيسهما Lighthouse المخبري مباشرة؛ في المختبر استعمل **TBT** كوكيل لـ INP (كما أعلاه) و**CLS المخبري**. للـ INP الحقيقي أضِف لاحقاً تقرير حقلي عبر `web-vitals` + CrUX. حدّد `resource-summary:script` كميزانية JS (~180KB مضغوط) — Zustand + TanStack Query + lucide خفيفة، لكن راقب أن مكوّنات client لا تجرّ القائمة كاملة.

**الملفات:** `almond-web/lighthouserc.json`، `.github/workflows/web-lighthouse.yml`، `almond-web/package.json` (سكربت `lhci`).

**المزالق:** (1) استعمل معرّف منتج **حقيقي وثابت** من `menu.generated.ts` في الـ URL وإلا فشل الجمع بـ 404. (2) `numberOfRuns: 3` يقلّل التذبذب. (3) شغّل ضد بناء production (`start`) لا `dev`. (4) `INP` غير متاح مخبرياً — لا تضع assertion عليه مباشرة تفادياً لفشل زائف.

**الجهد/الأولوية:** متوسط / **P1**.

---

### 3.8) ملحق: إن فُرض النشر الثابت (GitHub Pages)

**الهدف:** توثيق التعديلات اللازمة إن حُسم §3.0 لصالح static export.

**الطريقة المُثلى:** (1) `output: 'export'` في `next.config.mjs` + `images: { unoptimized: true }` **مع الإبقاء على الـ custom loader** (يعمل ثابتاً لأنه يوجّه لـ CDN). (2) **احذف `src/middleware.ts`** (لا يعمل ثابتاً) واعتمد كلياً على `generateStaticParams` للغتين في `layout.tsx` (موجود سطر 36) وفي كل صفحة ديناميكية. (3) وجِّه اللغة الافتراضية عبر صفحة جذر تعيد التوجيه، أو ولّد نسخة عربية على الجذر ونسخة `/en`. (4) `next/og` غير متاح — PNG ثابت للـ OG. (5) `basePath` إن كان الموقع تحت مسار مشروع GitHub Pages.

**المزالق:** فقدان ISR بالكامل — كل تحديث قائمة يستلزم إعادة بناء ونشر؛ مقبول في `mock` لكنه يكسر «تحديث فوري» لوضع `odoo`. لهذا **Vercel هو المُفضّل**.

**الجهد/الأولوية:** متوسط / **P2** (فقط إن فُرض).

---

### ترتيب التنفيذ

1. **حسم §3.0 (هدف النشر: Vercel مقابل static).** يقرّر كل ما يليه؛ عدّل `next.config.mjs`/`middleware.ts` صراحة.
2. **§3.1 SSG + `generateStaticParams` لصفحة المنتج** وربط `revalidate` بـ `DATA_SOURCE`. (حاجز للـ static ومكسب أداء فوري.)
3. **§3.4 الـ image loader المخصص + `formats`/`deviceSizes` + `priority` على صور الطية + blur.** (أكبر أثر على LCP.)
4. **§3.2 بنية الميتاداتا + hreflang** (`src/lib/seo.ts`) وتمريرها على كل الصفحات القابلة للفهرسة.
5. **§3.5 تحويل الخطوط إلى WOFF2 مجزّأة + `adjustFontFallback`/preload.** (تقليل بايتات + CLS.)
6. **§3.3 JSON-LD** (Restaurant/Menu/MenuItem/Offer + LocalBusiness للفروع).
7. **§3.6 sitemap.ts / robots.ts / manifest / OG image.**
8. **§3.7 Lighthouse-CI** مع الميزانيات كحارس تراجع، وتشغيله على PRs التي تمسّ `almond-web/**` أو `packages/shared/**`.
9. **(إن static) §3.8** كطبقة أخيرة قبل النشر.

**ملاحظات خاصة بالإصدارات:** كل ما سبق مبني على `Next 15.5` (Metadata Routes API، `generateMetadata` غير المتزامن مع `params: Promise<>` كما في الكود الحالي) و`next-intl 3.26` (توليد hreflang يدوي — v4 يغيّر واجهات التوجيه؛ لا تُرقِّ أثناء هذا العمل). React 19 لا يؤثر على أيٍّ مما سبق. `localePrefix:'as-needed'` (العربية على الجذر) هو مصدر أخطاء hreflang/canonical الأكثر تكراراً — تحقّق منه في كل رابط تولّده.

---

## 4) UX والوصولية (WCAG 2.2 AA)

> جميع الإصلاحات تنزل أولًا في المصدر الوحيد `packages/shared/src/theme/index.ts`، فيرثها التطبيق عبر `almond-app/constants/theme.ts:6` (`export * from '@almond/shared/theme'`) ويرثها الموقع عبر `almond-web/src/theme/cssVars.ts` الذي يحوّل نفس التوكنات إلى CSS Variables. لا نكرّر أي قيمة hex في طبقتَي العرض.

---

### 4.1 إصلاح التباين (WCAG 2.2 AA — 1.4.3 / 1.4.11)

**الهدف:** رفع كل نص/عنصر واجهة إلى حد AA (نص عادي 4.5:1، نص كبير وعناصر UI 3:1). القيم الحالية تفشل في موضعين مؤكّدين بالحساب:

| العنصر | الموضع | النسبة الحالية | الحكم |
|---|---|---|---|
| `warmGray` = `#7A7390` (نص ثانوي) | `theme/index.ts` `greenTheme.textSecondary` | 4.48:1 على أبيض | يفشل (تحت 4.5) |
| بداية `gradients.purple` = `#C2B9DB` + نص أبيض | `theme/index.ts` `gradients.purple` | 1.87:1 | فشل جسيم |
| `secondary`/`tierBean` = `#8478C0` + نص أبيض | `colors.tierBean` | 3.87:1 | يفشل للنص العادي |

**الطريقة المُثلى (قيم بديلة محسوبة):**

1. **النص الثانوي:** استبدل `textSecondary: '#7A7390'` بـ **`#615A78`** — يعطي **6.48:1 على الأبيض** و**5.81:1 على خلفية اللافندر المقترحة** (بند 4.2)، فيبقى آمنًا فوق كلا السطحين.

2. **التدرّج البنفسجي مع نص أبيض:** المشكلة أنّ النص الأبيض يمرّ فوق أفتح نقطة في التدرّج. الحل: قصر `gradients.purple` على استخدام **نص داكن فقط**، وإضافة تدرّج جديد `purpleDeep` معتِم بما يكفي لأي نص أبيض:

```ts
// theme/index.ts — gradients
export const gradients = {
  // زخرفي فقط — نص داكن (#2E2552) إلزامي فوقه
  purple:     ['#C2B9DB', '#9DAAD1', '#7E84C8', '#6C5CB4'] as const,
  // جديد: لأي سطح يحمل نصًا أبيض (hero/CTA) — أدنى نقطة 5.42:1
  purpleDeep: ['#6A5FB0', '#5E51A0', '#4C4194', '#453B88'] as const,
};
```
النسب المحسوبة لأبيض فوق `purpleDeep`: 5.42 → 6.86 → 8.43 → 9.40 (كلها ≥ AA).

3. **الطبقة البنفسجية المتوسطة:** `#8478C0` (نص أبيض 3.87:1) يصلح للنص الكبير فقط (≥ 18.66px عريض)؛ في `TierBadge`/`tierBean` إمّا نُكبّر الخط أو نُعتِم اللون إلى `#5E51A0` (أبيض = 6.64:1). وثّق القاعدة في تعليق التوكن.

4. **حارس آلي (regression guard):** أضف اختبار عقدي في `packages/shared` يحسب التباين لكل زوج (لون نص/سطح) مستخدَم فعليًا ويفشل CI إن نزل تحت 4.5/3.0:

```ts
// packages/shared/src/theme/contrast.test.ts
const ratio = (fg: string, bg: string) => { /* WCAG relative-luminance */ };
expect(ratio(colors.warmGray, colors.background)).toBeGreaterThanOrEqual(4.5);
```

**الملفات:** `packages/shared/src/theme/index.ts` (`greenTheme.textSecondary`، `gradients`، `colors.tierBean`)؛ مستهلكو النص الأبيض فوق تدرّج: `almond-app/app/loyalty.tsx:44` (hero) و`components/ui/Gradient.tsx`؛ حارس جديد `theme/contrast.test.ts`.

**المزالق:** تدرّج بنص أبيض يجب أن يجتاز التباين عند **أفتح** نقطة يلامسها النص، لا المتوسط. الموقع يشتقّ التدرّجات من نفس التوكن في `cssVars.ts:34`، فتصحيحٌ واحد يصلح الطرفين — لكن تأكد أن `--gradient-purple-deep` أُضيف إلى `themeVars`.

**الجهد/الأولوية:** صغير (تغيير قيم) / **عالية جدًّا** — حاجز إطلاق للوصولية.

---

### 4.2 نظام ارتفاع الأسطح (Surface Elevation) عبر التوكنات

**الهدف:** حاليًا `cream` (الخلفية) و`cardBg` كلاهما `#FFFFFF` (`theme/index.ts` `greenTheme.cream`/`cardBg`)، فالبطاقة تذوب في الخلفية ولا يبقى سوى الظل للتمييز — يفشل بصريًا في وضع تقليل الشفافية/الظل الخافت. المطلوب فصل دلالي بين طبقة الخلفية وطبقة البطاقة.

**الطريقة المُثلى:** أدخل توكن خلفية لافندر خفيف واجعل البطاقة أبيض نقي فوقه، فينشأ فرق ارتفاع طبيعي دون الاعتماد على الظل وحده:

```ts
// theme/index.ts — أضف توكنات دلالية للأسطح
export const surfaces = {
  background: '#F4F1FB', // لافندر تطبيقي (كان #FFFFFF)
  card:       '#FFFFFF', // ارتفاع +1
  raised:     '#FFFFFF', // + shadow.raised للطبقة العائمة (bottom sheets)
  sunken:     '#ECE7F6', // = neutralWarm للحقول الغائرة
} as const;
```
- نص داكن `#2E2552` فوق اللافندر = **12.53:1**، والنص الثانوي البديل `#615A78` = **5.81:1** — كلاهما آمن.
- بدّل قيمة الخلفية الافتراضية في `Screen.tsx`: من `background = colors.cream` إلى `surfaces.background` (السطر ~57 و`SafeAreaView` السطر ~104).
- في الموقع: أضف `--surface-background`/`--surface-card` في `cssVars.ts` واربطهما بـ Tailwind (`bg-surface`, `bg-card`).

**الملفات:** `packages/shared/src/theme/index.ts` (توكنات `surfaces` + إبقاء `cream` كاسم متوافق مؤقتًا)؛ `almond-app/components/ui/Screen.tsx` (الافتراضي)؛ `components/ui/Card.tsx:20` (يظل `cardBg`)؛ `almond-web/src/theme/cssVars.ts` + `tailwind.config.ts`.

**المزالق:** كثير من الشاشات تمرّر `background={colors.cream}` صراحةً — ابحث `grep -rn "colors.cream" almond-app/app` وحدّثها، وإلا بقيت بيضاء. لا تغيّر `cardBg` إلى غير الأبيض وإلا انهار تباين الظل. اللافندر يجب أن يبقى فاتحًا جدًّا (L عالٍ) حتى لا يهبط تباين النص الثانوي تحت 4.5.

**الجهد/الأولوية:** متوسط / **عالية**.

---

### 4.3 صحّة RTL ونظام أرقام لاتيني موحّد

**الهدف:** توحيد الأرقام (اللاتينية) وضمان انعكاس التخطيط صحيحًا. الخلل الحالي مؤكّد في `packages/shared/src/lib/format.ts`:
- `formatJOD` يستخدم `toFixed` → أرقام **لاتينية**.
- `formatNumber` يستخدم `Intl.NumberFormat('ar-JO')` → أرقام **هندية-عربية (٠١٢٣)**.
- `formatTime`/`formatDate` (ar-JO) → أرقام هندية-عربية أيضًا.
النتيجة: النقاط تظهر «١٢٥» بينما السعر «12.500 د.أ» في نفس الشاشة (`loyalty.tsx:56` مقابل السعر).

**الطريقة المُثلى — تثبيت النظام العددي اللاتيني مع إبقاء أسماء الأشهر العربية** عبر امتداد Unicode `-u-nu-latn`:

```ts
// lib/format.ts
const numLocale = (lang: Lang) => (lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-US');

export function formatNumber(value: number, lang: Lang) {
  return new Intl.NumberFormat(numLocale(lang)).format(value);
}
export function formatTime(date, lang: Lang) {
  return new Intl.DateTimeFormat(numLocale(lang), { hour: '2-digit', minute: '2-digit' }).format(d);
}
export function formatDate(date, lang: Lang) {
  return new Intl.DateTimeFormat(numLocale(lang), { day: 'numeric', month: 'short' }).format(d);
}
```
أضف اختبار وحدة: `expect(formatNumber(1250,'ar')).toBe('1,250')` (لاتيني مع فاصل).

**صحّة RTL:**
- `Text.tsx:51` يضبط `writingDirection:'auto'` — جيد؛ أبقه.
- المزالق المكتشفة: `SearchBar.tsx:51` يثبّت `textAlign:'left'` (يجب `'auto'` أو حذفه)، و`BottomSheet.tsx:74` يستعمل `left/right` صريحة (آمن لأنه ملء كامل، لكن أي أيقونة داخله تحتاج منطق `isRTL`). النمط الصحيح موجود في `ListRow.tsx:22` (`flexDirection: isRTL ? 'row-reverse' : 'row'`) — عمّمه.
- استبدل `marginLeft/Right` و`left/right` بخصائص منطقية `marginStart/marginEnd` (RN تدعمها وتنعكس تلقائيًا مع `I18nManager`).
- على الويب (Next.js): اضبط `<html dir="rtl" lang="ar">` ديناميكيًا في `almond-web` (root layout) بدل الاعتماد على `I18nManager` غير الموجود في الويب.

**الملفات:** `packages/shared/src/lib/format.ts` (المصدر الوحيد لكل الأرقام)؛ `almond-app/components/ui/SearchBar.tsx:51`، `Stepper.tsx:57`؛ `almond-web` root layout (`dir`).

**المزالق:** `-u-nu-latn` مدعوم في Hermes/JSC الحديث و`Intl` الكامل؛ تحقّق أن `expo` مبني بـ `jsc-intl` أو Hermes مع ICU — إن ظهرت أرقام هندية رغم الامتداد فذلك مؤشّر ICU مقصوص، فعندها استخدم `numberingSystem: 'latn'` كخيار صريح (أوثق من امتداد اللغة على بعض المحركات).

**الجهد/الأولوية:** صغير / **عالية** (اتساق مرئي فوري).

---

### 4.4 اللمس الاهتزازي (Haptics) عبر `expo-haptics`

**الهدف:** ردّ فعل لمسي على الأفعال المالية والمكافآت. الحزمة **غير مثبّتة** (غائبة من `almond-app/package.json`).

**الطريقة المُثلى:** ثبّت `npx expo install expo-haptics` ثم غلّفها في مساعد آمن على الويب (لا API للاهتزاز في expo-web):

```ts
// almond-app/lib/haptics.ts
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
const on = Platform.OS !== 'web';
export const haptics = {
  tap:     () => on && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  add:     () => on && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error:   () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};
```

**أين نطلقها:**
- `+`/`−` في `Stepper.tsx:17/29` → `haptics.tap()`.
- إضافة للسلة (`MenuItemCard`/`ItemModal` زر الإضافة) → `haptics.add()`.
- **نجاح الطلب** (وصول رد POST الطلب) و**استرداد قسيمة** و**ترقّي المستوى**/اكتمال الكوب → `haptics.success()`.
- حالات الخطأ في `Screen.tsx` (فرع error) وفشل الدفع → `haptics.error()`.
- زر باركود الولاء `TabBarBarcodeButton.tsx` عند الفتح → `haptics.tap()`.

**المزالق:** لا تطلق Haptics داخل حلقة render أو تأثير يعمل كل إطار (أطلقها في معالج الحدث فقط). على أندرويد يتطلب صلاحية `VIBRATE` (يضيفها الملحق تلقائيًا). تجنّب الإفراط: فعل واحد = نبضة واحدة.

**الجهد/الأولوية:** صغير / متوسطة.

---

### 4.5 حجم الخط الديناميكي (Dynamic Type — WCAG 1.4.4 / 1.4.10)

**الهدف:** احترام تكبير خط النظام دون كسر التخطيط. `Text.tsx` لا يضبط `allowFontScaling` ولا سقفًا، والقيم في `fontSize` ثابتة (px)، فتكبير النظام إلى 200% قد يقصّ الأزرار (`Button` بارتفاع ثابت 52).

**الطريقة المُثلى:** أبقِ التكبير مفعّلًا (افتراضي RN) لكن **حدّد سقفًا** حتى لا تنهار الشبكات، واجعل الحاويات مرنة:

```ts
// Text.tsx
<RNText
  allowFontScaling
  maxFontSizeMultiplier={variant === 'caption' ? 1.6 : 1.4}
  ...
/>
```
- في `Button.tsx`: استبدل `minHeight:52` بـ `minHeight:52` **مع** `paddingVertical` بدل ارتفاع مقفول، ودع الصف يتمدد.
- لأهداف اللمس (WCAG 2.5.8 Target Size AA = 24×24 CSS): `Stepper` أزراره 36×36 ✔، لكن تحقّق أن `hitSlop` يرفع أي هدف أصغر إلى ≥ 44.
- اختبر عند «أكبر خط» على iOS و«أكبر 200%» على أندرويد لكل شاشة رئيسية.

**الملفات:** `almond-app/components/ui/Text.tsx`، `Button.tsx`، `Stepper.tsx`.

**المزالق:** لا تعطّل `allowFontScaling` عالميًا (انتهاك 1.4.4)؛ استخدم السقف فقط. الأرقام الكبيرة في `variant="display"` (36px) قد تلتف — اجعل حاوية النقاط في `loyalty.tsx` تسمح بلفّ آمن.

**الجهد/الأولوية:** متوسط / متوسطة.

---

### 4.6 كوب الولاء المتحرّك: وصولية + احترام تقليل الحركة

**الهدف:** `components/loyalty/Cup.tsx` رسم SVG متحرّك بلا أي `accessibilityLabel`/`role`، فقارئ الشاشة يتجاهل أهم مؤشّر تقدّم في المنتج؛ كما أنّ حركة الـ`Animated.spring` (السطر ~48) تتجاهل «تقليل الحركة» (WCAG 2.3.3 / 2.2.2).

**الطريقة المُثلى:** غلّف الـ`Svg` في `View` بدور شريط تقدّم مع قيمة ديناميكية، واقطع الحركة عند تفعيل reduce-motion:

```tsx
// Cup.tsx
const [reduce, setReduce] = useState(false);
useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
}, []);

useEffect(() => {
  if (reduce) { level.setValue(pct); return; }      // اقفز بلا حركة
  Animated.spring(level, { toValue: pct, friction: 7, tension: 36, useNativeDriver: false }).start();
}, [pct, reduce, level]);

return (
  <View
    accessibilityRole="progressbar"
    accessible
    accessibilityLabel={t('loyalty.cupA11y')} // «كوبك المجاني: {current} من {target} مشروبات»
    accessibilityValue={{ min: 0, max: target, now: Math.floor(current) }}
    importantForAccessibility="yes"
    style={[styles.wrap, { width: w, height: h }, nearFull && styles.glow]}
  >
    <Svg accessibilityElementsHidden importantForAccessibility="no-hide-descendants" ...>
```
أضف مفتاح ترجمة `loyalty.cupA11y` بصيغتَي AR/EN مع أرقام لاتينية (يمرّ عبر `formatNumber`).

**الملفات:** `almond-app/components/loyalty/Cup.tsx`؛ نصوص `locales/ar.json`/`en.json` (`loyalty.cupA11y`)؛ نفس النمط ينطبق على `TierProgress.tsx` (أضف `accessibilityValue` لشريط المستوى) و`components/loyalty/TierBadge`.

**المزالق:** إخفاء أبناء الـSVG عن قارئ الشاشة إلزامي (`accessibilityElementsHidden` على iOS + `importantForAccessibility="no-hide-descendants"` على أندرويد) وإلا نطق كل `Path` على حدة. عند reduce-motion لا تلغِ التحديث نفسه — فقط اقفز للقيمة النهائية (`setValue`) حتى يبقى المؤشّر صحيحًا.

**الجهد/الأولوية:** صغير-متوسط / **عالية** (عنصر محوري بلا وصولية إطلاقًا).

---

### ترتيب التنفيذ

1. **التوكنات في `@almond/shared/theme` أولًا (يوم 1):** أصلح `textSecondary → #615A78`، أضف `gradients.purpleDeep`، أعتِم `tierBean → #5E51A0`، وأضف كائن `surfaces` (خلفية لافندر `#F4F1FB`). لا تغيير سلوكي بعد — فقط قيم. (بند 4.1 + 4.2)
2. **حارس التباين (`theme/contrast.test.ts`) + ربط الموقع:** أضف الاختبار وأضف المتغيّرات الجديدة إلى `cssVars.ts`/`tailwind.config.ts` ليرث الطرفان. يفشل CI إن رجعت أي قيمة.
3. **توحيد الأرقام في `lib/format.ts`:** تحويل `formatNumber/Time/Date` إلى `ar-JO-u-nu-latn` (+ خيار `numberingSystem:'latn'` احتياطًا) مع اختبار وحدة. (بند 4.3)
4. **تفعيل الخلفية والأسطح في العرض:** حدّث `Screen.tsx` الافتراضي إلى `surfaces.background`، ونظّف `colors.cream` الصريحة في الشاشات، وأصلح `SearchBar.textAlign` والخصائص المنطقية لـRTL.
5. **وصولية الكوب والمستوى:** أضف `progressbar`+`accessibilityValue`+reduce-motion في `Cup.tsx` و`TierProgress.tsx`، ومفاتيح الترجمة. (بند 4.6)
6. **الخط الديناميكي:** أضف `maxFontSizeMultiplier` في `Text.tsx` ومرونة الارتفاع في `Button.tsx`، ثم اختبر التكبير على الشاشات الرئيسية. (بند 4.5)
7. **اللمس الاهتزازي أخيرًا:** `expo install expo-haptics`، أنشئ `lib/haptics.ts` الآمن على الويب، واربط النبضات بمعالجات الأحداث (Stepper، إضافة للسلة، نجاح الطلب، الأخطاء). (بند 4.4)
8. **قبول نهائي:** تشغيل التطبيق مع VoiceOver/TalkBack + خط 200% + تقليل الحركة + تبديل AR↔EN للتحقق من الانعكاس والأرقام اللاتينية على كل شاشة.

الأساس في الخطوات 1–3 يجعل التطبيق والموقع يرثان الإصلاحات من مصدر واحد؛ الخطوات 4–7 تلمس طبقة العرض في `almond-app` فقط، والخطوة 8 بوابة قبول WCAG 2.2 AA.

---

## 5) آليات الولاء والتحويل المتبقية

هذا القسم يغطّي المِيكانيكا المتبقية في طبقة الولاء والتحويل، مبنيّة على الكود الفعلي. المصدر الأوحد للأرقام هو `packages/shared/src/config/index.ts:5-49`، وطبقة المنطق الوهمية `almond-app/services/loyalty.service.mock.ts`. المبدأ الحاكم: **كل تعديل يجب أن يبقى خلف مفتاح `config.DATA_SOURCE` ويُطبَّق مرّة واحدة في `@almond/shared` ليشترك فيه التطبيق والموقع.**

ملاحظة أولية على الوضع الحالي دقّقتها من الكود: شاشة `almond-app/app/referral.tsx` **موصولة فعلاً** لكن فقط عبر صفٍّ عميق في `profile.tsx:83-88`، ومنطق الإحالة أحادي الجانب (المُحيل فقط) في `loyalty.service.mock.ts:392-406`، ومكافأة المُحال إليه غير موجودة إطلاقاً. وواجهة `ReferralInfo` في `packages/shared/src/types/index.ts:262-265` تحمل حقلين فقط `{ code, alreadyRewarded }`.

---

### (أ) الإحالة ثنائية الجانب مع مانع إساءة (Double-sided referral)

**الهدف:** أن يربح المُحيل (referrer) والمُحال إليه (referee) معاً، مع منع التزوير (حسابات وهمية، إحالة ذاتية، إحالات متكرّرة)، وربط المكافأة بأول شراء مؤهَّل لا بمجرّد التسجيل — وهذا هو أقوى حاجز إساءة عملي.

**الطريقة المُثلى:**

المبدأ المعتمد صناعياً (Uber/Cash App): **المُحيل لا يُكافأ عند إدخال الكود بل عند إتمام المُحال إليه لأول طلب مؤهَّل** (حدّ أدنى للقيمة). هذا يحوّل الإحالة من «تسجيل رخيص قابل للتزوير» إلى «عميل يدفع فعلاً».

1) وسّع الثوابت في `config/index.ts`:
```ts
REFERRAL: {
  referrerBeans: 100,        // للمُحيل بعد أول شراء مؤهَّل للمُحال إليه
  refereeBeans: 50,          // للمُحال إليه فوراً كترحيب قابل للاستخدام
  minRefereeOrderJOD: 3,     // حدّ أدنى يمنع طلبات وهمية بقيمة صفرية
  maxRewardedReferralsPerMonth: 5, // سقف شهري ضدّ مزارع الحسابات
  refereeWelcomeVoucherDays: 30,
} as const,
```

2) وسّع الحالة والواجهة. في `loyalty.service.mock.ts` أضف إلى `LoyaltyUser`:
```ts
referredBy?: string;                 // كود المُحيل الذي استُخدم
firstQualifiedPurchaseDone: boolean; // بوّابة إطلاق مكافأة المُحيل
rewardedReferrals: { at: number }[]; // سجل للسقف الشهري
```
ووسّع `ReferralInfo` في `types/index.ts`:
```ts
export interface ReferralInfo {
  code: string;
  alreadyRewarded: boolean;   // إبقاء للتوافق الخلفي
  successfulReferrals: number;
  pendingReferrals: number;
}
```

3) قسّم `claimReferral` أحادي الجانب الحالي (`loyalty.service.mock.ts:392-406`) إلى مرحلتين. أضف دالتين للواجهة في `loyalty.service.ts:86-87`:
```ts
applyReferralCode(refereeId: string, code: string): Promise<{ applied: boolean; refereeBeans: number }>;
// تُستدعى من داخل earn() عند أول شراء مؤهَّل — لا تُصدَّر للـUI مباشرة:
completeReferralIfPending(refereeId: string, invoiceAmount: number): Promise<void>;
```

سكيتش المنطق (وهمي، يعكس ما سيفعله الخادم):
```ts
applyReferralCode: async (refereeId, rawCode) => {
  const code = rawCode.trim().toUpperCase();
  const referee = ensureUser(refereeId);
  const referrer = [...store.entries()].find(([, u]) => u.referralCode === code)?.[1];
  // بوّابات الإساءة:
  if (!referrer) throw new Error('Invalid code');
  if (referrer.referralCode === referee.referralCode) return { applied: false, refereeBeans: 0 }; // ذاتية
  if (referee.referredBy || referee.firstQualifiedPurchaseDone) return { applied:false, refereeBeans:0 }; // ليس مستخدماً جديداً
  if (referee.phone && knownPhones.has(referee.phone)) return { applied:false, refereeBeans:0 };
  referee.referredBy = code;
  referee.points += config.REFERRAL.refereeBeans;           // المُحال إليه يربح فوراً
  referee.history.unshift(log(config.REFERRAL.refereeBeans, 'مكافأة ترحيب بدعوة صديق', 'Referral welcome'));
  return { applied: true, refereeBeans: config.REFERRAL.refereeBeans };
},
```
وداخل `earn` (بعد احتساب النقاط، عند `loyalty.service.mock.ts:211`) استدعِ الإكمال:
```ts
if (!u.firstQualifiedPurchaseDone && invoiceAmount >= config.REFERRAL.minRefereeOrderJOD) {
  u.firstQualifiedPurchaseDone = true;
  if (u.referredBy) {
    const referrer = findByCode(u.referredBy);
    const monthAgo = Date.now() - 30*86400000;
    const recent = referrer.rewardedReferrals.filter(r => r.at >= monthAgo).length;
    if (referrer && recent < config.REFERRAL.maxRewardedReferralsPerMonth
        && (!u.phone || !knownPhones.has(u.phone))) {
      referrer.points += config.REFERRAL.referrerBeans;
      referrer.rewardedReferrals.push({ at: Date.now() });
      referrer.hasReferralRewardEver = true;
      referrer.history.unshift(log(config.REFERRAL.referrerBeans, 'اكتمال دعوة صديق', 'Referral completed'));
      if (u.phone) knownPhones.add(u.phone);
    }
  }
}
```

4) واجهة المستخدم: أضف حقل إدخال كود عند التسجيل/onboarding يستدعي `applyReferralCode`، وارفع مرئيّة شاشة `referral.tsx` بوضع بطاقة مصغّرة في الصفحة الرئيسية (Home) بجانب بطاقة النقاط، لأنها اليوم مدفونة في `profile.tsx:87` فقط. حدّث `referral.tsx:43-66` ليعرض `successfulReferrals`/`pendingReferrals` بدل شارة «لم يُستخدم» الثابتة.

**الملفات:** `packages/shared/src/config/index.ts` · `packages/shared/src/types/index.ts:262` · `almond-app/services/loyalty.service.mock.ts:391-406,197-255` · `almond-app/services/loyalty.service.ts:86-94` (توسيع الواجهة + الخادم الحيّ) · `almond-app/app/referral.tsx` · شاشة الـonboarding/التسجيل · `almond-app/app/(tabs)/index.ts` (بطاقة الإحالة في Home).

**المزالق:**
- **إطلاق المكافأة عند التسجيل = تزوير مضمون.** اربطها بأول شراء مؤهَّل حصراً.
- في المخزن الوهمي `store` مفهرس بـ`userId`؛ البحث بالكود خطّي — مقبول للـmock لكن الخادم الحيّ يحتاج فهرساً `code → userId`.
- `POST` الخادم الحيّ لإكمال الإحالة **مالي فعلياً** (يمنح رصيداً) → يجب أن يحمل `Idempotency-Key` (UUID v4 من العميل) لمنع الازدواج عند إعادة المحاولة (اتفاقية Stripe/Square؛ مسودة `draft-ietf-httpapi-idempotency-key-header`). خزّن مفتاح الإكمال بصيغة `referral:{refereeId}` كـ idempotency key طبيعي.
- إبقاء `hasReferralRewardEver`/`alreadyRewarded` للتوافق مع الكود القائم بدل حذفها.

**الجهد/الأولوية:** متوسط (~1.5 يوم) · **أولوية عالية** (أقوى قناة اكتساب عضوي؛ الأثر المتوقّع: نمو مستخدمين +10–20% شهرياً مع سقف يحمي التكلفة).

---

### (ب) ترقية «الحجم الأكبر مباشرة» → «الحجم الأعلى التالي» (Next size up)

**الهدف:** رفع معدّل قبول الترقية بعرض القفزة السعرية الأصغر (M بدل L من S) بدل القفز للأكبر دائماً — القفزة الصغيرة تُقبل أكثر وترفع متوسط قيمة الطلب (AOV) تدريجياً.

**الطريقة المُثلى:** الأحجام معرّفة كـ`id: 'S' | 'M' | 'L'` (`types/index.ts:32-37`). استبدل منطق «الأكبر بالسعر» في `getSizeUpsell` (`recommendations.ts:100-106`) بترتيب رتبيّ صريح والانتقال خطوة واحدة:
```ts
const SIZE_RANK: Record<ItemSize['id'], number> = { S: 0, M: 1, L: 2 };

export function getSizeUpsell(item: MenuItem, currentSizeId: ItemSize['id']): SizeUpsell | null {
  if (item.sizes.length < 2) return null;
  const current = item.sizes.find(s => s.id === currentSizeId) ?? item.sizes[0];
  // رتّب الأحجام المتاحة فعلاً ثم خُذ الحجم الأعلى التالي مباشرة
  const sorted = [...item.sizes].sort((a, b) => SIZE_RANK[a.id] - SIZE_RANK[b.id]);
  const idx = sorted.findIndex(s => s.id === current.id);
  const next = sorted[idx + 1];
  if (!next) return null;                       // بالفعل الأكبر
  const delta = Math.max(0, next.price - current.price);
  return { size: next, delta };
}
```
لا تغيير مطلوب على المستدعِين — `ItemModal.tsx:73,182-190` و`ItemConfigurator.tsx:63,145-155` يقرآن `upsell.size`/`upsell.delta` كما هي، وضغط الترقية `setSizeId(upsell.size.id)` سيظهر تلقائياً الترقية التالية بعدها (تدرّج طبيعي S→M→L).

**الملفات:** `packages/shared/src/lib/recommendations.ts:91-106` (تغيير واحد يخدم التطبيق والموقع).

**المزالق:**
- لا تعتمد على ترتيب `item.sizes` كما ورد من المنيو (قد لا يكون مرتّباً) — استخدم `SIZE_RANK` صراحةً. لو ظهرت أحجام مستقبلية خارج S/M/L، وفّر fallback على `price` للرُتب غير المعرّفة.
- تجاهُل الأحجام غير المتوفّرة (`inStock`) ليس مطبّقاً هنا — الأحجام لا تحمل مخزوناً في `ItemSize`، فلا حاجة.
- انتبه أن الاختبارات/اللقطات التي تفترض «يقفز للأكبر» ستتغيّر؛ حدّث نصّ الترجمة إن كان يقول «تكبير» بصيغة تلمّح للأكبر.

**الجهد/الأولوية:** منخفض (~ساعتان) · **أولوية عالية** (أعلى نسبة أثر/جهد؛ رفع AOV متوقّع +3–6% على المشروبات).

---

### (ج) عرض الأسعار شاملة الضريبة (Tax-inclusive display — 16% VAT)

**الهدف:** إظهار السعر الذي يدفعه العميل فعلاً على البطاقات، لأن `TAX_RATE 0.16` تُضاف فوق المجموع الفرعي في `computeTotals` (`packages/shared/src/cart/totals.ts:50-53`) بينما أسعار البطاقات pre-tax → صدمة سعرية عند الدفع تزيد التخلّي عن السلّة. القانون الأردني للمستهلك يميل لعرض السعر النهائي شاملاً.

**التوصية:** **اعرض السعر شامل الضريبة في كل الواجهات مع إبقاء الضريبة سطراً تفصيلياً في ملخّص السلّة** («شامل ضريبة المبيعات 16%») — بدون تغيير حساب `computeTotals` كي لا يتغيّر المجموع النهائي (السعر شامل = عرضٌ فقط، لا إعادة تسعير). هذا يوازن بين الشفافية والحفاظ على مصدر الأرقام الأوحد.

**الطريقة المُثلى:** أضف مُساعِد عرض في `@almond/shared/lib/format` (بجانب `formatJOD`):
```ts
import { config } from '../config';
export const withTax = (pre: number) => pre * (1 + config.TAX_RATE);
export const formatJODIncl = (pre: number, lang: 'ar'|'en') => formatJOD(withTax(pre), lang);
```
واستخدمه على بطاقات المنيو ورأس مودال الصنف. في `Summary.tsx:21` أضف توضيح الشمول:
```tsx
<Row label={`${t('cart.tax')} (16%)`} value={formatJOD(totals.tax, lang)} />
{/* أو نمط الشمول: سطر واحد "الإجمالي شامل الضريبة" */}
```
خيار بديل أنظف طويل المدى: علم عرض `PRICES_TAX_INCLUSIVE` في `config`، والبطاقات تقرأ `formatJODIncl`، فتتبدّل الطريقتان من مفتاح واحد.

**الملفات:** `packages/shared/src/lib/format.ts` (المساعد المشترك) · `packages/shared/src/cart/totals.ts` (بلا تغيير حسابي — فقط تعليق) · `almond-app/components/cart/Summary.tsx:21` · بطاقات المنيو في التطبيق والموقع (`components/menu/*`) · نصوص i18n.

**المزالق:**
- **لا تُدخل الضريبة في `computeTotals` مرتين.** المجموع يُحسب مرّة واحدة؛ الشمول عرضٌ فقط.
- تناسق التقريب: اعرض شاملاً لكن احسب الإجمالي من pre-tax لتجنّب فروق فلسٍ بين مجموع بطاقات مُقرَّبة والمجموع الفعلي. أبقِ pre-tax مصدر الحساب.
- الخصم يُطبَّق قبل الضريبة (`totals.ts:50`) — إن عرضت شاملاً على البطاقة فتأكّد أن سطر الخصم في الملخّص يبقى pre-tax متّسقاً مع الحساب.
- RTL: علامة العملة «د.أ» بعد الرقم — `formatJOD` يتكفّل بذلك، لا تُدخِل تنسيقاً يدوياً.

**الجهد/الأولوية:** منخفض–متوسط (~نصف يوم) · **أولوية عالية** (يقلّل التخلّي عند الدفع؛ أثر متوقّع: -5–10% تخلٍّ عن السلّة).

---

### (د) إشعارات دورة الحياة (Lifecycle notifications)

**الهدف:** استرجاع السلّات المتروكة (السلّة الآن مُخزَّنة بثبات في `almond.cart` عبر `persist` في `cartStore.ts:137-154`) وتنبيه انتهاء صلاحية النقاط (`beansExpireAt` في `loyalty.service.mock.ts:120-123`)، فوق `notification.service.ts` و`lib/notifications.ts` (`expo-notifications ~56`).

**الطريقة المُثلى:** استخدم **جدولة محلية** (`Notifications.scheduleNotificationAsync`) لأنها تعمل بلا خادم — مناسبة تماماً للوضع الوهمي، ولاحقاً يستبدلها الخادم بـpush مُوجَّه. وسّع `lib/notifications.ts:55-64` بمجدوِلات محدَّدة الهوية (identifier) قابلة للإلغاء:

1) **التخلّي عن السلّة** — اربطها بتغيّر السلّة عبر اشتراك في المتجر:
```ts
// lib/lifecycle.ts
import * as Notifications from 'expo-notifications';
import { useCartStore } from '@/stores/cartStore';

const ABANDON_ID = 'cart-abandon';
export function wireCartAbandonment() {
  return useCartStore.subscribe((s) => {
    Notifications.cancelScheduledNotificationAsync(ABANDON_ID).catch(() => {});
    if (s.items.length === 0) return;
    Notifications.scheduleNotificationAsync({
      identifier: ABANDON_ID,
      content: {
        title: 'سلّتك تنتظرك ☕',
        body: `لديك ${s.items.reduce((n,l)=>n+l.qty,0)} صنف — أكمل طلبك واربح نقاطك`,
        data: { deepLink: '/(tabs)/cart' },
      },
      trigger: { seconds: 60 * 60 }, // بعد ساعة من آخر تعديل
    });
  });
}
```
استدعِ `wireCartAbandonment()` مرّة في `app/_layout.tsx`. كل تعديل سلّة يُلغي ويُعيد الجدولة (نافذة منزلقة). `clear()` عند إتمام الطلب (`cart.tsx:174`) يفرّغ العناصر فيُلغى الإشعار تلقائياً.

2) **انتهاء صلاحية النقاط** — استخدم `beansExpireAt` من الرصيد. جدْول تذكيراً قبل 7 أيام:
```ts
export async function scheduleBeansExpiryReminder(balance: LoyaltyBalance) {
  const EXP_ID = 'beans-expiry';
  await Notifications.cancelScheduledNotificationAsync(EXP_ID).catch(()=>{});
  if (!balance.beansExpireAt || balance.points <= 0) return; // Gold/Black لا تنتهي
  const fireAt = new Date(balance.beansExpireAt).getTime() - 7*86400000;
  if (fireAt <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: EXP_ID,
    content: { title: 'نقاطك على وشك الانتهاء', body: `${balance.points} نقطة تنتهي قريباً — استخدمها الآن`, data: { deepLink: '/(tabs)/rewards' } },
    trigger: { date: new Date(fireAt) },
  });
}
```
استدعِها من `hooks/useLoyalty` عند نجاح `getBalance`.

كلا الإشعارين يحترمان `NotifSettings` (`notification.service.ts:55-60`): تحقّق من `settings.promos`/`order` قبل الجدولة.

**الملفات:** `almond-app/lib/notifications.ts:55-64` (مجدولات جديدة) · `almond-app/lib/lifecycle.ts` (جديد) · `almond-app/app/_layout.tsx` (توصيل الاشتراك) · `almond-app/hooks/useLoyalty.ts` (تذكير الانتهاء) · `almond-app/stores/cartStore.ts` (subscribe موجود جاهز) · `almond-app/services/notification.service.ts` (احترام الإعدادات).

**المزالق:**
- **الويب:** `expo-notifications` لا يجدول محلياً على الويب — احرس بـ`Platform.OS !== 'web'` وإلا تفشل بصمت (الدوال في `lib/notifications.ts` مغلَّفة بـtry/catch جيّد).
- **الأذونات:** الجدولة تتطلّب إذناً مُنِح في `registerForPush` (`notifications.ts:35-40`)؛ لا تجدول قبل التأكّد.
- **إغراق:** استخدم `identifier` ثابتاً لكل نوع (إلغاء+إعادة) بدل تكديس عشرات الإشعارات. نافذة ساعة للتخلّي معقولة؛ تجنّب < 15 دقيقة (مزعج).
- **صلاحية النقاط تُحسب كسولياً** عند `buildBalance` (`loyalty.service.mock.ts:129-131`) — التذكير يعتمد قيمة `beansExpireAt` وقت القراءة، لا مؤقّتاً خادمياً؛ في الإنتاج الخادم هو من يرسل push الانتهاء.
- الاشتراك في Zustand يجب أن يُسجَّل مرّة واحدة (خارج render) لتفادي تسرّب مشتركين.

**الجهد/الأولوية:** متوسط (~1 يوم) · **أولوية عالية** (استرجاع السلّة أعلى ROI في التحويل؛ أثر متوقّع: +3–7% طلبات مسترجَعة).

---

### (هـ) توحيد وتحديد سقف مُضاعِفات الكسب (Cap & unify earn multipliers)

**الهدف:** حماية الهامش. حالياً في `earn` (`loyalty.service.mock.ts:197-255`) تتراكم المُضاعِفات بلا سقف: `walletMult(1.5)` × `bonusMult(2)` كأساس، ثم `tierBonus = base×(tier−1)` (Black = ×2)، **زائد** `fridayBonus = base×0.5` مستقلّ. لعميل Black + محفظة + يوم مضاعف + جمعة:
`base×1.5×2 = 3·base` → `tierBonus = 3·base×1 = 3·base` → `friday = 1.5·base` → الإجمالي `≈ 7.5·base = 37.5 نقطة/دينار = 0.375 د.أ استرجاع لكل دينار (~37%)`. غير مستدام، وازدواج محتمل لو ضبط المشرف «اليوم المضاعف» على الجمعة.

**الطريقة المُثلى:** أدخِل مفهوم **«المُضاعِف الفعّال» واحد مع سقف صريح**، ووحِّد الجمعة داخل نظام «اليوم المضاعف» بدل مسارٍ مستقلّ:

1) ثابت جديد في `config/index.ts`:
```ts
MAX_EARN_MULTIPLIER: 3.0, // سقف إجمالي على النقاط مقابل الأساس (حماية الهامش)
```
واحذف المسار المستقلّ للجمعة (`isFriday`/`fridayBonus`) واجعلها مجرّد يومٍ ضمن `BONUS_BEAN_DAY.weekdays` أو حملة، فلا تتضاعف مرّتين.

2) أعد صياغة الحساب ليكون مُضاعِفاً واحداً مسقوفاً:
```ts
earn: ({ userId, invoiceAmount, paidFromBalance, bonusMultiplier, comboBonusPoints }) => {
  const u = ensureUser(userId);
  const tier = tierFromSpend(rolling12mSpend(u));
  const walletMult = paidFromBalance ? config.WALLET_EARN_MULTIPLIER : 1; // 1.5
  const bonusMult  = bonusMultiplier && bonusMultiplier > 1 ? bonusMultiplier : 1; // يوم مضاعف/جمعة/حملة
  // مُضاعِف فعّال واحد = tier × wallet × bonus، مسقوفاً:
  const effective = Math.min(
    tier.multiplier * walletMult * bonusMult,
    config.MAX_EARN_MULTIPLIER,
  );
  const pointsEarned = Math.round(invoiceAmount * config.POINTS_PER_JOD * effective);
  // ... باقي المنطق (cup, spins, combo) كما هو
};
```
لاحظ التحوّل من **جمعٍ للمكافآت** (base+tierBonus+fridayBonus) إلى **ضربٍ مسقوف** — أوضح دلالياً وأسهل ضبطاً من المشرف. بالسقف 3.0، أقصى استرجاع = 15 نقطة/دينار = 0.15 د.أ/دينار (~15%) + كومبو ثابت منفصل.

3) **مزامنة التقدير المعروض** — حدّث `estimateEarnedPoints` (`lib/earnEstimate.ts:12-22`) بنفس صيغة الضرب المسقوف كي لا يعِد التقدير المعروض في `Summary` بأكثر مما يُمنح فعلاً (اليوم يستثني الجمعة/اليوم المضاعف عمداً؛ أبقِ ذلك، لكن أضِف نفس `Math.min(..., MAX_EARN_MULTIPLIER)` على `tier×wallet`).

**الملفات:** `packages/shared/src/config/index.ts:12-49` (ثابت السقف، حذف ازدواج الجمعة) · `almond-app/services/loyalty.service.mock.ts:196-255` · `almond-app/services/loyalty.service.ts:16-25` (يمكن إزالة `isFriday` من `EarnInput` بعد التوحيد) · `almond-app/lib/earnEstimate.ts:12-22` · `almond-app/app/(tabs)/cart.tsx:163-171` (لم يعد يمرّر `isFriday`).

**المزالق:**
- **الكومبو (`comboBonusPoints`) نقاطٌ ثابتة لا يُضرب** — أبقِه خارج السقف (`loyalty.service.mock.ts:242-252`) وإلا فقد معناه كحافز مستقلّ.
- تغيير من الجمع إلى الضرب يغيّر الأرقام الظاهرة للمستخدمين الحاليين؛ راجع نصوص السجلّ في `history.unshift` (`:235-240`) لتعكس المنطق الجديد.
- تعليق الكود القديم (`:202-209`) يصف السلوك القديم — حدّثه لتفادي التضليل مستقبلاً.
- تأكّد أن `WALLET_EARN_MULTIPLIER` يبقى يُطبَّق على ملء الكوب (`cupBeans`، `:218`) كما هو — السقف يخصّ النقاط لا الكوب.
- الخادم الحيّ (`loyalty.service.live`) يجب أن يطبّق **نفس السقف** خادمياً؛ العميل لا يُوثَق به في حساب النقاط.

**الجهد/الأولوية:** متوسط (~نصف–1 يوم) · **أولوية عالية** (حماية مباشرة للهامش قبل التوسّع؛ يمنع نزيفاً محتملاً 20–30% من تكلفة الولاء).

---

### ترتيب التنفيذ

1. **(ب) الترقية للحجم التالي** — تغيير ملف واحد (`recommendations.ts`)، صفر تبعيات، أعلى أثر/جهد. ابدأ به لتحقيق مكسب AOV فوري ويخدم التطبيق والموقع معاً.
2. **(هـ) سقف وتوحيد المُضاعِفات** — أنجزه قبل أي دفعٍ لآليات كسب جديدة كي لا يتراكم دَينٌ على الهامش؛ يوحّد `earn` + `earnEstimate` + `config`.
3. **(ج) عرض السعر شامل الضريبة** — مساعد `format` مشترك + `Summary`؛ يقلّل التخلّي عند الدفع ويهيّئ الأرقام قبل تفعيل استرجاع السلّة.
4. **(د) إشعارات دورة الحياة** — يعتمد على السلّة المُخزَّنة (جاهزة) و`beansExpireAt` (جاهز)؛ وصِّل `wireCartAbandonment` + تذكير الانتهاء واحترم `NotifSettings`.
5. **(أ) الإحالة ثنائية الجانب** — الأكبر والأعقد (توسيع الحالة + الواجهة + بوّابات الإساءة + ربط بأول شراء + `Idempotency-Key` على الخادم الحيّ + رفع مرئيّة `referral.tsx` إلى Home). نفّذه أخيراً وقد استقرّ منطق `earn` (لأن إكمال الإحالة يُستدعى من داخله) وجاهزية الإشعارات (لإخطار المُحيل بالاكتمال).

بعد كل بند: مرّر `npm run typecheck` على مستوى المونوريبو، وتحقّق من أن التطبيق والموقع يستوردان نفس المنطق من `@almond/shared` (لا نسخ مكرّرة)، وأن كل `POST` مالي جديد (إكمال إحالة، خصم محفظة) يحمل `Idempotency-Key` بصيغة UUID v4 من العميل في المسار الحيّ.

---

## خارطة تنفيذ متسلسلة

الخارطة تُنفَّذ على ثلاث مراحل متتابعة، بحيث يبني كل ما بعدها على أساس آمن ثابت. البنود قابلة للتنفيذ مباشرةً وكل نقطة مربوطة بقسمها المرجعي.

### المرحلة 1 — أساس آمن (Odoo + BFF + idempotency + هوية)

الهدف: إزالة كل ثقة في العميل، ونقل المال والهوية إلى الخادم قبل أي عمل تجميلي. هذه المرحلة حاجزة — لا يُطرَح نظام مالي حيّ قبل اكتمالها.

- [ ] **إخماد الأسرار (§1.1):** تدوير كل مفتاح سبق دمجه في حزمة منشورة (محروق)؛ حذف `EXPO_PUBLIC_ODOO_API_KEY`/`EXPO_PUBLIC_LOYALTY_TOKEN` من `integration.ts:36-39`؛ إضافة تدقيق CI يفشل البناء عند أي سرّ ببادئة `*_PUBLIC_` (`ODOO`/`LOYALTY`/`TOKEN`/`KEY`)؛ إدخال `BFF_BASE_URL` في `config`.
- [ ] **هيكلة خدمة BFF مستقلّة (§1.1 + §2.1):** مشروع `api.almond.jo` (Node/Fastify أو NestJS) يقرأ الأسرار من بيئة الخادم، CORS مقيّد على نطاقَي GitHub Pages والموقع، جدولا `idempotency_keys` و`outbox`، وXML-RPC server-side أمام Odoo. العميل يعرف `BFF_BASE_URL` فقط.
- [ ] **المصادقة الحقيقية + JWT (§1.4 + §2.2):** `otp/request|verify` على BFF عبر مزوّد SMS، تطبيع الهاتف إلى +962 (`libphonenumber-js`)، `find-or-create res.partner`، JWT قصير العمر (~15د، RS256) + refresh دوّار، تخزين في SecureStore/cookie `HttpOnly`، حقن `Authorization` في `apiClient`. الخادم يشتقّ `userId = jwt.sub` ويتجاهل `userId` الجسم. حذف قبول `123456` من مسار live + حارس إقلاع يمنع بقاء أي خدمة live alias للـmock.
- [ ] **بنية التفرّد (§1.3):** `lib/idempotency.ts` (UUID v4 لكل نيّة، لا لكل محاولة)، توسيع `apiClient` بترويسة `Idempotency-Key` وretry أُسّي مشروط بوجود المفتاح فقط (لا retry على 4xx)، middleware التفرّد في BFF مع `request_hash` وTTL 24h.
- [ ] **`POST /v1/checkout` الذرّي (§1.2):** saga (دفع→طلب→نقاط) بخطوات تعويض عكسية idempotent، خصم محفظة ذرّي على مستوى الصف (`WHERE balance >= :amt RETURNING`)، Transactional Outbox لمنح النقاط والإشعارات، إعادة تسعير خادمية بفلس صحيح (integer fils). إعادة كتابة `cart.tsx:121-182` إلى نداء واحد + ربط الويب `CheckoutView.tsx`.
- [ ] **تكامل Odoo الأساسي (§2.3–§2.6):** بذر المنيو (`menu.generated → product.template/attributes` بمفاتيح `default_code` idempotent) وإعادة كتابة `menu.service.odoo.ts` على REST؛ برامج `loyalty.program` (نقاط/ewallet/gift_card) مع حساب النقاط في BFF بكود `@almond/shared` (لتفادي ازدواج POS)؛ الطلبات على `sale.order` مع نافذة إلغاء 30ث؛ idempotency على كل عملية مالية في `loyalty.service.live.ts`.
- [ ] **توكن POS الموقَّع (§1.5 + §2.7):** `POST /v1/pos/token` (JWS، `jti` مرّة واحدة، ~60s)، تدوير تلقائي في `pay.tsx` عبر `useFocusEffect`، استهلاك عبر `/pos/scan` خادم-إلى-خادم، إغلاق الحلقة بـ`scanStatus`. لا `userId` خام في الـQR.
- [ ] **القلب التدريجي (§2.9):** تعديل الموزّعات لقراءة `integration.enabled.*` (لطرح نظام واحد أولًا)، ثم قلب `config.DATA_SOURCE='odoo'`؛ Webhooks موقّعة (HMAC) + دفع Expo لاحقًا كتحسين (§2.8).

**بوابة الخروج من المرحلة 1:** اختبارات تكامل تُثبت أن نفس Idempotency-Key لا يخصم مرّتين، وأن فشل الخطوة N في الـsaga يتراجع عن 1..N−1، ولا سرّ في أي حزمة، والهوية من JWT حصرًا.

### المرحلة 2 — الموقع + UX/a11y

الهدف: طرح الموقع القابل للفهرسة والأداء العالي، ورفع التطبيق والموقع إلى WCAG 2.2 AA من مصدر توكنات واحد. يمكن تنفيذها بالتوازي مع نهايات المرحلة 1 لأنها لا تلمس المسار المالي مباشرة، لكن حاجزَي التباين وهدف النشر يجب حسمهما أولًا.

- [ ] **حاجز التباين أولًا (§4.1 + §4.2):** في `@almond/shared/theme` أصلح `textSecondary → #615A78`، أضف `gradients.purpleDeep`، أعتِم `tierBean → #5E51A0`، أضف كائن `surfaces` (خلفية لافندر `#F4F1FB`)؛ حارس آلي `theme/contrast.test.ts` يفشل CI تحت 4.5/3.0؛ ربط المتغيّرات الجديدة في `cssVars.ts`/`tailwind.config.ts`.
- [ ] **توحيد الأرقام وRTL (§4.3):** `formatNumber/Time/Date → ar-JO-u-nu-latn` (+ `numberingSystem:'latn'` احتياطًا) مع اختبار وحدة؛ إصلاح `SearchBar.textAlign` والخصائص المنطقية (`marginStart/End`)؛ `<html dir="rtl">` ديناميكي على الويب.
- [ ] **حسم هدف النشر (§3.0):** قرار صريح Vercel/Node (المُفضّل — يفتح ISR وmiddleware) مقابل static export؛ تعديل `next.config.mjs`/`middleware.ts` صراحةً لتفادي كسر روابط اللغة الصامت.
- [ ] **SSG + الصور (§3.1 + §3.4):** `generateStaticParams` لصفحة المنتج (267×2) وربط `revalidate` بـ`DATA_SOURCE`؛ image loader مخصص لـdeliveryhero + `formats`/`deviceSizes` + `priority` على صور الطية + blur placeholder (أكبر أثر LCP).
- [ ] **الميتاداتا والفهرسة (§3.2 + §3.3 + §3.6):** `src/lib/seo.ts` (hreflang ar-JO/en-JO/x-default مع احترام `as-needed`)، JSON-LD (Restaurant/Menu/MenuItem/Offer + LocalBusiness للفروع)، sitemap.ts/robots.ts/manifest/OG image.
- [ ] **الخطوط والأداء (§3.5 + §3.7):** تحويل TTF → WOFF2 مجزّأة + `adjustFontFallback`/preload؛ Lighthouse-CI بميزانيات (LCP<2.5s / CLS<0.1 / TBT<200ms كوكيل INP / JS ~180KB) كحارس تراجع على PRs التي تمسّ `almond-web/**` أو `packages/shared/**`.
- [ ] **وصولية التطبيق (§4.4–§4.6):** `progressbar`+`accessibilityValue`+reduce-motion في `Cup.tsx`/`TierProgress.tsx`؛ `maxFontSizeMultiplier` ومرونة الأزرار�؛ `expo-haptics` عبر مساعد آمن على الويب مربوط بمعالجات الأحداث.

**بوابة الخروج من المرحلة 2:** Lighthouse أخضر على المسارات الممثِّلة، وقبول WCAG يدوي (VoiceOver/TalkBack + خط 200% + تقليل الحركة + تبديل AR↔EN)، وحارس التباين يمرّ في CI.

### المرحلة 3 — ولاء/تحويل

الهدف: تفعيل آليات النمو والهامش فوق أساس مالي آمن ومنطق `earn` مستقر. مرتّبة بأعلى نسبة أثر/جهد أولًا؛ الإحالة أخيرًا لأنها تعتمد على استقرار `earn` وجاهزية الإشعارات.

- [ ] **ترقية الحجم التالي (§5-ب):** تغيير ملف واحد `recommendations.ts` بترتيب رتبيّ `SIZE_RANK` والانتقال خطوة واحدة (S→M→L). صفر تبعيات، مكسب AOV فوري، يخدم التطبيق والموقع.
- [ ] **سقف وتوحيد المُضاعِفات (§5-هـ):** `MAX_EARN_MULTIPLIER=3.0`، تحويل الجمع إلى ضرب مسقوف، توحيد الجمعة داخل «اليوم المضاعف» (حذف المسار المستقلّ)، مزامنة `earnEstimate` مع `earn`، وتطبيق نفس السقف خادميًا في المسار الحيّ. أنجزه قبل أي كسب جديد لحماية الهامش.
- [ ] **عرض السعر شامل الضريبة (§5-ج):** مساعد `formatJODIncl` مشترك (عرض فقط، لا إعادة تسعير في `computeTotals`)، سطر «شامل ضريبة 16%» في `Summary`، والحساب يبقى من pre-tax لتفادي فروق التقريب.
- [ ] **إشعارات دورة الحياة (§5-د):** `wireCartAbandonment` (نافذة منزلقة ساعة، identifier ثابت) + `scheduleBeansExpiryReminder` (قبل 7 أيام)، محروسة بـ`Platform.OS!=='web'` و`NotifSettings` والأذونات.
- [ ] **الإحالة ثنائية الجانب (§5-أ):** توسيع `ReferralInfo` والحالة، فصل `applyReferralCode` (مكافأة المُحال إليه فورًا) عن `completeReferralIfPending` (مكافأة المُحيل عند أول شراء مؤهَّل ≥ الحدّ الأدنى)، بوّابات الإساءة (ذاتية/هاتف مكرّر/سقف شهري)، `Idempotency-Key` بصيغة `referral:{refereeId}` في المسار الحيّ، ورفع مرئيّة `referral.tsx` إلى Home.

**بوابة الخروج من المرحلة 3:** `npm run typecheck` على المونوريبو نظيف بعد كل بند، لا نسخ منطق مكرّرة خارج `@almond/shared`، وكل POST مالي جديد يحمل Idempotency-Key بصيغة UUID v4 من العميل.

---

## ملاحظة بحثية موثّقة

**الموضوع:** استخدام مفتاح التفرّد (Idempotency-Key) كـ UUID v4 يولّده العميل ويُمرَّر في ترويسة HTTP باسم `Idempotency-Key`، وهو النمط الذي يتكرّر في كل الأقسام المالية أعلاه (§1.2، §1.3، §2.1، §2.4، §2.6، §5-أ).

**الخلاصة:** التفرّد على مستوى الطلب هو المعيار الصناعي الراسخ لمنع الازدواج في العمليات المالية عند إعادة الإرسال (شبكة متقطّعة، مهلة، ضغط زر مزدوج). المبدأ الموحّد عبر المزوّدين الكبار ومسودة IETF: **العميل يولّد المفتاح مرّة واحدة لكل نيّة (لا لكل محاولة HTTP)، يُرسله في ترويسة، والخادم يخزّن أوّل استجابة ويعيد تشغيلها حرفيًا عند تَكرار نفس المفتاح** — بلا إعادة تنفيذ أي أثر جانبي.

**الأدلة من المزوّدين:**

| المزوّد | الترويسة | التفاصيل الموثّقة |
|---|---|---|
| **Stripe** | `Idempotency-Key` | يوصي رسميًا بـ V4 UUID كمفتاح لضمان عشوائية كافية؛ يخزّن أوّل نتيجة ويعيدها للطلبات اللاحقة بنفس المفتاح؛ مفاتيح POST تُحفَظ عادةً ~24 ساعة. |
| **Square** | `idempotency_key` (في الجسم للـAPIs المعاملية) + دعم الترويسة | يُلزم مفتاح تفرّد فريدًا لكل عملية دفع/إنشاء؛ إعادة الطلب بنفس المفتاح تُعيد النتيجة الأصلية بدل إنشاء دفعة جديدة. |
| **PayPal** | `PayPal-Request-Id` | معرّف فريد يولّده العميل لكل طلب؛ يمنع تكرار العمليات عند إعادة الإرسال. |
| **Adyen** | `Idempotency-Key` | ترويسة تحمل معرّفًا فريدًا (UUID موصى به)؛ الطلبات المكرّرة بنفس المفتاح لا تُعالَج مرّتين وتُعيد الاستجابة الأصلية. |

**مسودة IETF:** `draft-ietf-httpapi-idempotency-key-header` (عمل HTTP APIs Working Group) تقنّن ترويسة `Idempotency-Key` كآلية عامة مستقلّة عن المزوّد: العميل يرسل قيمة مفتاح تعريفية فريدة (fingerprint/UUID)، والخادم يستخدمها لاكتشاف الطلبات المعادة وإرجاع الاستجابة المحفوظة، مع تعريف حالات مثل تعارض مفتاح قيد التنفيذ (409) وسوء استخدام مفتاح لجسم مختلف. هذا يجعل النمط قابلًا للتبنّي في الـBFF الخاص بنا دون الارتباط بمزوّد بعينه.

**لماذا UUID v4 تحديدًا:** V4 عشوائي بالكامل (122 بت عشوائية) فتَصادُم مفتاحين لنيّتين مختلفتين عمليًا مستحيل، ولا يكشف معلومات زمنية/عقدية كما في v1. المصدر الصحيح للتوليد على منصّتنا: `crypto.randomUUID()` (متاح في React Native الحديث وعلى الويب) مع fallback إلى `expo-crypto`/مكتبة `uuid` عند اللزوم.

**التطبيق المعماري في هذا الدليل (مطابق للمصادر):**
- **التوليد أعلى الطبقة، عند النيّة لا عند النقل:** المفتاح يُولَّد في طبقة الخدمة/النيّة ويُعاد استخدامه عبر كل محاولات إعادة الإرسال (بما فيها إعادات TanStack Query). توليده داخل `apiClient`/`apiPost` خطأ شائع يُبطل الحماية لأنه يمنح مفتاحًا جديدًا لكل محاولة (§1.3، §2.1).
- **عقد الخادم:** فهرسة `(userId, Idempotency-Key)` في `idempotency_keys(key, user_id, request_hash, response_json, status, created_at)`؛ إعادة تشغيل الاستجابة عند `completed`، 409 عند `in_progress`، 422 عند اختلاف `request_hash` لنفس المفتاح، وTTL معقول (~24h) — مطابق لسلوك Stripe/Adyen.
- **شرط retry:** إعادة المحاولة الأُسّية مسموحة على POST **فقط** إذا حمل مفتاح تفرّد (وإلا خطر الخصم المزدوج)، وعلى 5xx/timeout لا على 4xx.
- **النطاق:** كل مسار مالي يحمل المفتاح — `/v1/checkout`، `earn`، `redeem`، `walletTopup`/`walletCharge`، `giftSend`/`giftRedeem`، وإكمال الإحالة (`referral:{refereeId}` كمفتاح طبيعي). نقاط `GET` (balance/history/wallet/scan-status) تبقى بلا مفتاح لأنها آمنة التكرار أصلًا.

**ملاحظة تحقّق:** أسماء الترويسات تختلف بين المزوّدين (`Idempotency-Key` لدى Stripe/Adyen، `PayPal-Request-Id` لدى PayPal، `idempotency_key` في جسم Square)، لكن **الآلية والدلالة واحدة**. اعتمدنا الاسم القياسي `Idempotency-Key` تماشيًا مع مسودة IETF وStripe/Adyen. التفاصيل الدقيقة (مدّة الاحتفاظ، رموز الأخطاء) يُنصَح بتثبيتها من الوثائق الرسمية الحيّة لكل مزوّد وقت التنفيذ، إذ قد تتغيّر.
