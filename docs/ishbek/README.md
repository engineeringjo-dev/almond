# Almond × Ishbek — عقد التكامل (Careem / Talabat)

عيّنة العقد وملفات JSON لتكامل التوصيل عبر **Ishbek** (يوزّع على أسطولَي **كريم**
و**طلبات**). مبنية على أنواع `@almond/shared` والـ seam في
`almond-web/src/data/delivery.ts`. للمعمارية الكاملة راجع
[`../DELIVERY-INTEGRATION.md`](../DELIVERY-INTEGRATION.md).

> ⚠️ أسماء الحقول النهائية تُثبَّت من **وثائق Ishbek الرسمية** عند استلام الحساب.
> هذه عيّنة توضيحية من طرف Almond، وليست مواصفة Ishbek.

## الملفات

| الملف | الوصف |
|---|---|
| `sample.ts` | سكربت يشرح التوقيت + الموديفايرز + اختيار الأسطول حسب العميل (مجرّب) |
| `1.quote.request.json` / `2.quote.response.json` | تسعيرة: فرع → عنوان الزبون |
| `3.dispatch.request.json` / `4.dispatch.response.json` | طلب كابتن (توقيت + موديفايرز) + تأكيد |
| `5.status.webhook.json` | تحديث الحالة من Ishbek → Odoo → التطبيق |
| `6.cancel.request.json` / `7.cancel.response.json` | إلغاء التوصيل |

## المعايير (إلزامية)

- **التوقيت:** كل طابع زمني ISO-8601 مع offset صريح **`+03:00` (Asia/Amman)** —
  **ممنوع** `Z` مجرّد أو وقت بدون offset. هذا كان سبب عدم انعكاس الأوردرات على
  نقطة البيع. استخدم `toAmmanISO()` من `@almond/shared/lib/format`.
- **العملة:** JOD بصيغة `X.XXX`. الضريبة 16%. `subtotal = Σ(unitPrice × qty)`.
- **Auth:** المفتاح **server-side فقط** (`ISHBEK_KEY`) — لا يُوضع في متغيّر
  `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` لأنه ينكشف في bundle العميل.
- **أمان الـ webhook:** التحقق من توقيع **HMAC** قبل تعديل حالة أي أوردر.
- **اختيار الأسطول:** التغطية أولاً، ثم الأرخص وعند التعادل الأسرع.
