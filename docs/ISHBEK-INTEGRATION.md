# ألموند × أشبك — مقترح الربط (Loyalty ↔ Ishbek ↔ Odoo)

<div dir="rtl">

**لمن:** المالك (للاجتماع مع أشبك، 2026-09-24) وفريق أشبك الهندسيّ. **الحالة:** مقترح — لم يُتّفَق عليه بعد.

**قاعدة هذه الوثيقة:** كلّ ما وُصف بأنّه **«جاهز»** له مسار ملفّ في هذا المستودع ويمكن التحقّق منه. كلّ ما وُسِم
**«مقترحنا — يُثبَّت من وثائق أشبك»** هو اقتراحٌ منّا، لا وصفٌ لواجهات أشبك؛ **لا نعرف شكل واجهات أشبك بعد**، وكلّ ما لا
نعرفه صار سؤالاً في القسم ٦. عيّنات `docs/ishbek/*` كتبناها نحن للتوصيل، وليست مواصفة أشبك.

**قرارات المالك (2026-09-24) التي بُني عليها هذا المقترح:**

1. «الربط مع اودو سيكون عبر agrigator اسمه اشبك اصلا صابك مع اودو الان» — لا نربط أودو مباشرةً؛ **أشبك هي الجسر**.
2. «المنيو للطلب تسحب مباشرة معلوماتها من اشبك المربوط على اودو وبامكانك اطفاء الاصناف على كريم وطلبات والتطبيق من خلال كبسة واحدة من اشبك» — منيو الموقع والتطبيق **من أشبك**، وزرّ واحد في أشبك يُطفئ الصنف على كريم وطلبات **وتطبيق ألموند وموقعه** معاً.
3. في المحلّ: **باركود واحد** لكلّ عضو للكسب والصرف معاً · يستطيع العضو الكسب بإدخال **رقم هاتفه على تابلت** في المحلّ (كسبٌ فقط) · أونلاين يدفع **من المحفظة و/أو بالنقاط** · النقاط تُكسَب **بعد تأكيد الدفع** فقط · **المرتجع يعكس نقاط الجزء المُرتجَع فقط** · الضريبة **٨٪ مضمّنة** في `list_price` لأودو · طلبات التطبيق نقداً/بطاقةً تكسب **بعد تأكيد الدفع** فقط.

</div>

---

## ٠) الخلاصة في صفحة

<div dir="rtl">

**الصورة:** أودو ١٩ يبقى مصدر الحقيقة للمنيو والأسعار والمبيعات والمخزون. أشبك مربوطة بأودو أصلاً وتوزّع على كريم
وطلبات. نقترح أن تصير أشبك **الجسر الوحيد** بين أودو وكلّ ما هو خارج أودو — ومنه نظام ولاء ألموند. نظام الولاء يبقى
**مالك الأعضاء والنقاط والمحفظة** ولا يلمس أودو مباشرةً.

</div>

```
                    ┌──────────────────────── Odoo 19 (source of truth) ────────────────────────┐
                    │ menu · prices (list_price, 8% incl.) · POS orders · stock · invoices      │
                    └───────────────▲──────────────────────────────────────┬────────────────────┘
                                    │ (already connected today)            │
                             ┌──────┴──────────────── Ishbek ──────────────▼──────┐
                             │ menu feed · one-click availability · order intake  │──► Careem
                             │ POS event relay (proposed) · delivery dispatch     │──► Talabat
                             └──────▲───────────────────────────────┬─────────────┘
          HMAC webhooks (menu,      │  server-to-server, key held   │  menu feed / availability events
          availability, order       │  server-side (x-pos-key /     │  order status webhooks
          status, POS events)       │  X-Ishbek-Key)                ▼
                             ┌──────┴──────────── Almond loyalty backend (bff) ───┐
                             │ members · points (FIFO lots) · wallet · tiers     │
                             │ till API /v1/pos/* · checkout · menu cache (new)  │
                             └──────▲──────────────────────────────▲─────────────┘
                                    │ JWT                           │ JWT
                              Almond app (Expo)              Almond website (Next.js)
```

<div dir="rtl">

| الطرف | يملك | لا يملك |
|---|---|---|
| **أودو ١٩** | المنيو، الأسعار الشاملة للضريبة، طلبات الكاشير، الفواتير، المخزون | الأعضاء والنقاط والمحفظة |
| **أشبك** | الربط مع أودو، تغذية المنيو، زرّ التوفّر لكلّ القنوات، استقبال الطلبات، التوصيل عبر كريم/طلبات، (مقترح) ترحيل أحداث الكاشير إلينا | **لا تحتفظ بقاعدة أعضاء** ولا بأرصدة ولا بمفاتيح داخل أيّ تطبيق |
| **ألموند (الولاء)** | الأعضاء، النقاط، المحفظة، الفئات، رمز الباركود، قواعد الكسب والصرف | لا يكتب في أودو مباشرةً (قرار المالك) |

**التوصية في خمسة أسطر:**

1. **المنيو:** سحبٌ كامل بإصدارٍ مُخزَّن (pull + cache) للكتالوج، و**دفع فوريّ (webhook)** لحدث التوفّر؛ ومزامنة تصحيحيّة كلّ ٥ دقائق.
2. **الكاشير:** أشبك تُرحِّل أحداث الكاشير إلى واجهة الكاشير عندنا **بشروطٍ ثلاثة** (مكوّن داخل شاشة الكاشير، زمن استجابة < ١ ثانية، مفتاح على الخادم)؛ وإلّا تبقى اللحظة الحيّة عند الكاشير مباشرةً إلينا.
3. **الطلبات الأونلاين:** خادمنا يدفع الطلب **بعد تأكيد الدفع** إلى أشبك ← أودو، بمفتاح منع تكرار، وأشبك تُرجع الحالات بـwebhook موقَّع.
4. **الأمن:** كلّ المفاتيح على الخوادم، مفتاحٌ مستقلّ لكلّ طرف، HMAC بطابع زمنيّ، وبيانات الأعضاء تبقى عندنا.
5. **عند تعطّل أشبك:** المنيو من آخر نسخة سليمة، البيع في المحلّ لا يتوقّف، والكسب يُعاد لاحقاً بلا ازدواج.

</div>

---

## ١) المنيو من أشبك

<div dir="rtl">

### ١.١ كيف يُبنى المنيو اليوم (جاهز، متحقَّق)

- السكربت `scripts/odoo-menu-pull.ts` (`npm run menu:pull`) يقرأ أودو **للقراءة فقط** (`search_read`/`read`): `pos.category` ← فئات، و`product.template` حيث `available_in_pos` ← أصناف، وسمات الحجم (`Drink Size`، `Cake Size`، `Pizza Size & type`) ← أحجام، وباقي السمات ← مجموعات تخصيص؛ و`display_type = multi` يعني اختياراً متعدّداً.
- الناتج ملفٌّ مُولَّد يُرفع بـcommit: `packages/shared/src/menu/menu.generated.ts` — **373 صنفاً و44 فئة** (سُحب 2026-09-08)، و**306 صور WebP** في `almond-web/public/menu/` و`almond-app/public/menu/` (أعدتُ العدّ اليوم).
- الخادم يعيد تسعير كلّ سلّة من الملفّ نفسه (`bff/src/pricing.ts#reprice`) ويرفض الصنف المُطفأ (`inStock === false` ← 400 `out of stock`). بطاقات الموقع والتطبيق تُظهر «نفد» للحالة نفسها.
- **اليدويّ مقصود:** السحب يُنتج commit لا نشراً، كي لا يصل خطأ أودو (سعر صفر، اسم ناقص) للزبون بلا مراجعة.

**حدود النموذج الحاليّ (مقيسة اليوم من الملفّ المُولَّد):**

| الحدّ | الأثر | من يصلحه |
|---|---|---|
| المنيو **ثابت وقت البناء** — لا تحديث حيّ | إطفاء صنف في أودو/أشبك لا يصل للتطبيق حتى سحبٍ ونشرٍ جديدين | نحن (خدمة منيو حيّة — القسم ١.٤) |
| التوفّر `inStock` **عامّ لا لكلّ فرع**، ولا يُملأ من أودو أصلاً (٠ من ٣٧٣) | «نفد في خلدا» لا يمكن تمثيله | نحن (توسيع النوع) + أشبك (التغذية) |
| لوحة التحكّم تُطفئ الأصناف **في متصفّحٍ واحد** (`almond-web/src/store/menuOverlayStore.ts`، `localStorage`) | ليست مفتاح توفّرٍ حقيقيّاً | تُستبدل بحدث أشبك |
| **348 مجموعة تخصيص كلّها `multiple: true`** وصفر أحاديّة (إعادة السحب معلّقة — HANDOVER §٧) | «نوع البيغل» يُطلب بلا اختيار أو بثلاثة | إعادة سحب، أو تغذية أشبك بعلم `required` |
| النوع `CustomizationGroup` بلا حقل `required`/`min`/`max` (`packages/shared/src/types/index.ts`) | الإلزام مُستنتَج من «اختيار واحد» فقط | نحن (توسيع النوع) |
| `ItemSize.id` محصور في `'S' \| 'M' \| 'L'` — **9 كيكات كاملة لها 5 أحجام تنهار ثلاثة منها على `L`** (مثال «Carrot Cake»: `L=15`، `L=20`، `L=25`) | الخادم يلتقط أوّل `L`، فكيكة ٢٠ أو ٢٥ شخصاً **لا يمكن تسعيرها صحيحاً** | نحن (معرّفات أحجام حقيقيّة من التغذية) |
| الأوصاف: **٠ أصناف** بوصف | — | أودو/أشبك |

### ١.٢ ما نحتاجه من أشبك: تغذية منيو + حدث توفّر

**(أ) تغذية المنيو (catalog feed)** — لكلّ فرع أو للشبكة، بالحقول:

- الفئات: معرّف، اسم عربيّ وإنجليزيّ، ترتيب، الأب.
- الأصناف: معرّف أشبك **ومعرّف أودو** (`product.template` و`product.product`)، الاسمان، الوصف، الفئة، الترتيب، الصورة (رابط + تاريخ تحديث).
- الأحجام: معرّف ثابت لكلّ حجم (لا ترتيب)، الاسمان، **السعر الشامل للضريبة**.
- مجموعات التعديل: الاسمان، **اختيار واحد/متعدّد**، **إلزاميّ**، حدّ أدنى وأقصى، والخيارات بأسعارها الإضافيّة.
- التوفّر: لكلّ صنف (ويُفضَّل لكلّ خيار) **لكلّ فرع**.
- **أسعار قناة ألموند = أسعار المحلّ** (قائمة أسعار الكاشير)، لا أسعار طلبات/كريم إن اختلفت.
- رقم إصدار للمنيو يتغيّر عند أيّ تعديل.

**(ب) حدث التوفّر (availability event)** — حين يُضغط زرّ الإطفاء/التشغيل في أشبك، يصلنا حدثٌ فوراً، فيختفي الصنف (أو
يظهر «نفد») في التطبيق والموقع **ويرفضه الخادم عند الدفع** — لا مجرّد إخفاءٍ في الواجهة.

**هدفنا المقترح للزمن:** من ضغط الزرّ إلى رفض الخادم للصنف **≤ 60 ثانية** (والمعتاد ثوانٍ مع الدفع الفوريّ). يُسأل
أشبك عن زمنهم الفعليّ لكريم وطلبات للمقارنة.

### ١.٣ خياران للتسليم — والتوصية

| | الخيار ١: دفع (webhooks) | الخيار ٢: سحب مع تخزين (pull + cache) |
|---|---|---|
| كيف | أشبك تستدعي عنواناً عندنا عند كلّ تغيير (`menu.updated`، `item.availability`) | خادمنا يسحب التغذية كلّ N ثانية/دقيقة بـ`ETag`/`If-None-Match` أو رقم الإصدار |
| زمن وصول الإطفاء | ثوانٍ | حتى N (دقيقة مثلاً) |
| الحِمل على أشبك | أقلّ | طلبٌ دوريّ من كلّ بيئة |
| لو ضاع حدث | يضيع بصمت ما لم تكن هناك إعادة أو مزامنة | لا يضيع — السحب التالي يصحّحه |
| يتطلّب من أشبك | دعم webhooks بتوقيع وإعادة محاولة | واجهة قراءة للمنيو فقط |

**التوصية:** **مزيج بدورين واضحين** —

- **حدث التوفّر بالدفع (الخيار ١)** لأنّ الزرّ الواحد وعدٌ بالسرعة؛
- **الكتالوج الكامل بالسحب (الخيار ٢)** بإصدارٍ مُخزَّن: عند `menu.updated`، ومرّة كلّ ٥ دقائق **مزامنةً تصحيحيّة** تلتقط أيّ حدثٍ ضائع، وليلاً سحبٌ كامل.
- إن لم تدعم أشبك webhooks: الخيار ٢ وحده كلّ **30–60 ثانية** للتوفّر (خفيف: حقل التوفّر فقط) وكلّ ٥ دقائق للكتالوج.

**مقترحنا — يُثبَّت من وثائق أشبك** (أشكال دنيا، لا أسماء نهائيّة):

</div>

```jsonc
// GET {ISHBEK}/menu?channel=almond&branchId=khalda      (pull, with ETag)
{
  "menuVersion": "2026-09-24T10:15:00+03:00#1842",
  "currency": "JOD",
  "pricesIncludeTax": true,
  "taxRate": 0.08,
  "branchId": "khalda",
  "categories": [
    { "id": "cat_6", "odooPosCategoryId": 6, "parentId": "cat_1",
      "nameAr": "ساندويشات", "nameEn": "Sandwiches", "sort": 60 }
  ],
  "items": [
    {
      "id": "itm_812", "odooProductTemplateId": 812, "categoryId": "cat_6",
      "nameAr": "فلات وايت", "nameEn": "Flat White", "descAr": null, "descEn": null,
      "imageUrl": "https://…/812.jpg", "imageUpdatedAt": "2026-09-01T09:00:00+03:00",
      "sort": 10, "prepMinutes": 4,
      "available": true,
      "sizes": [
        { "id": "sz_455", "odooAttributeValueId": 455, "nameAr": "وسط", "nameEn": "Medium", "price": 3.400, "available": true }
      ],
      "modifierGroups": [
        { "id": "mg_77", "nameAr": "نوع الحليب", "nameEn": "Milk Type",
          "selection": "single", "required": true, "min": 1, "max": 1,
          "options": [
            { "id": "op_901", "odooAttributeValueId": 901, "nameAr": "شوفان", "nameEn": "Oat",
              "priceDelta": 0.500, "available": true }
          ] }
      ]
    }
  ]
}
```

```jsonc
// POST {ALMOND}/v1/integrations/ishbek/menu-events      (push, HMAC-signed)
// headers: X-Ishbek-Timestamp: 1758700000   X-Ishbek-Signature: sha256=<hex(HMAC(secret, timestamp + "." + rawBody))>
{
  "eventId": "evt_01J8…",                 // unique — we de-duplicate on it
  "type": "item.availability",            // or "menu.updated"
  "occurredAt": "2026-09-24T12:03:11+03:00",
  "itemId": "itm_812", "odooProductTemplateId": 812,
  "optionId": null,                       // set when only one modifier/size is switched off
  "branchIds": ["khalda"],                // null = every branch
  "available": false,
  "channels": ["careem", "talabat", "almond"],
  "menuVersion": "2026-09-24T12:03:11+03:00#1843"
}
```

<div dir="rtl">

> المسار `/v1/integrations/ishbek/menu-events` **غير موجود بعد** — اسمٌ مقترح. وwebhook التوصيل الموجود
> (`almond-web/src/app/api/delivery/webhook/route.ts`) يوقّع **الجسم وحده** (`x-ishbek-signature: sha256=<hex>`)؛
> إدخال الطابع الزمنيّ في التوقيع تحسينٌ نقترحه لسدّ ثغرة إعادة الإرسال المعروفة (HANDOVER §٨).

### ١.٤ ربط الحقول بنوع `MenuItem` عندنا

المرجع: `packages/shared/src/types/index.ts`. العمود الأخير يقول ما يلزمنا تغييره (عملنا نحن، لا أشبك).

| حقل التغذية (مقترح) | عندنا اليوم | ملاحظة / تغيير لازم عندنا |
|---|---|---|
| `categories[].id` · `nameAr` · `nameEn` | `Category.id` (`cat-<pos.category id>`) · `nameAr` · `nameEn` | نحتفظ بالمعرّف المبنيّ على أودو ليبقى ثابتاً؛ `sort`/`parentId` غير موجودين في النوع |
| `items[].odooProductTemplateId` | `MenuItem.id` = `p-<product.template id>` | **لذلك نطلب معرّف أودو في التغذية**: يحفظ معرّفاتنا وسلال الأعضاء وسجلّ الطلبات |
| `nameAr` · `nameEn` · `descAr` · `descEn` | `nameAr` · `nameEn` · `descAr?` · `descEn?` | مطابق |
| `categoryId` | `categoryId` | مطابق |
| `imageUrl` | `imageUrl?` (اليوم ملفّ محلّيّ `/menu/p-<id>.webp`) | **ننسخ الصورة إلى تخزيننا** ولا نربط رابطهم مباشرةً (نفس سبب ترك CDN طلبات — رأس `scripts/odoo-menu-pull.ts`) |
| `sizes[]` (`id`, `price`) | `ItemSize { id: 'S'\|'M'\|'L', nameAr, nameEn, price }` | **نوسّع `id` إلى نصٍّ حرّ** (إصلاح انهيار أحجام الكيك الخمسة) |
| `modifierGroups[].selection` | `CustomizationGroup.multiple` | `single` ← `false`، `multi` ← `true` |
| `modifierGroups[].required` · `min` · `max` | — | **نضيف الحقول** ونفرضها في `bff/src/pricing.ts` |
| `options[].priceDelta` | `CustomizationOption.priceDelta` | مطابق (دينار، ٣ خانات، شامل الضريبة) |
| `available` (صنف/حجم/خيار، لكلّ فرع) | `MenuItem.inStock?` (عامّ فقط) | **نضيف توفّراً لكلّ فرع**، والخادم يرفض عند الدفع |
| `prepMinutes` | `prepMinutes?` | مطابق |
| `pricesIncludeTax: true`، `taxRate: 0.08` | `packages/shared/src/cart/totals.ts#applyTax` (لا يضيف فوق السعر) | **حارس:** إن جاء `pricesIncludeTax: false` نرفض الإصدار ولا ننشره |
| `menuVersion` | — | يُخزَّن مع كلّ طلب ليُعرف بأيّ منيو سُعِّر |

### ١.٥ مصير السحب اليدويّ من أودو

- **يصير احتياطاً لا مصدراً:** إن تعطّلت تغذية أشبك نخدم **آخر نسخة سليمة** مخزّنة؛ وإن لم توجد (أوّل إقلاع) فالملفّ المُولَّد `menu.generated.ts` هو الملاذ الأخير.
- **ويصير أداة تدقيق:** مقارنة دوريّة بين تغذية أشبك وأودو مباشرةً (أسعار، أصناف مفقودة، أسعار صفر) قبل أن يراها زبون.
- **قاعدةٌ لا تُكسر:** الواجهات **وخادم التسعير** (`bff/src/pricing.ts`) يقرآن **النسخة نفسها** من المنيو. لو قرأت الواجهة منيو أشبك الحيّ وسعّر الخادم من الملفّ الثابت لاختلف السعر المعروض عن المُحصَّل.
- **غير مبنيّ بعد (عملنا):** خدمة منيو في `bff` تستقبل التغذية وتخزّن الإصدارات وتخدم `/v1/menu`، وتحويل `almond-web/src/data/menu.ts` (يرمي اليوم خطأً عمداً تحت `odoo`) والتطبيق لقراءتها.

</div>

---

## ٢) الكاشير والنقاط عبر أشبك

<div dir="rtl">

### ٢.١ واجهة الكاشير عندنا

**موجودٌ ومختبَر في الخادم** (`bff/src/routes/pos.ts`، `bff/src/pos/token.ts`، `bff/src/pos/sales.ts`): كلّ المسارات تتطلّب
ترويسة `x-pos-key` = `POS_SCAN_KEY` وتُغلَق عند غيابه، وأخطاؤها رموزٌ آليّة (`pos_key_invalid`، `token_expired`،
`ticket_used`، `pos_order_conflict`، `rate_limited`…) موثّقة في `docs/INTEGRATIONS.md` §٢. **لكنّ الخادم `bff` غير
مستضاف بعد، وقاعدته غير منشأة** (HANDOVER §١.٢).

| المسار | الحالة |
|---|---|
| `POST /v1/pos/token` (تطبيق العضو يطلب رمز QR لمدّة 60 ث، أحاديّ الاستعمال) | **موجود** — لكنّ التطبيق لا يحمل JWT بعد (الدخول فيه محاكاة؛ HANDOVER §٣) |
| `POST /v1/pos/scan` | **موجود**؛ **شكله يتغيّر اليوم** (أدناه) |
| `POST /v1/pos/earn` `{earnTicket, posOrderRef, branchId, paidTotal, paidAt}` | **موجود** — منع تكرار بـ`posOrderRef`، ‏201 جديد / 200 `replay` |
| `POST /v1/pos/earn/reverse` | **موجود** بعكسٍ **كامل**؛ **العكس الجزئيّ يُضاف اليوم** |
| `POST /v1/pos/redemption/settle` | **موجود** (مسار الاستبدال بالكود — يحلّ محلّه الصرف بالباركود الواحد) |

**يُضاف اليوم (مهندسٌ آخر يعمل عليه الآن — ليس مشحوناً بعد):**

| المسار | الطلب ← الجواب |
|---|---|
| `POST /v1/pos/scan` (مسحة واحدة) | `{token}` ← `member`، `pointsBalance`، `spendableJod`، `spendTicket` (قصير العمر، أحاديّ الاستعمال)، `earnTicket` (`null` لعضو الشركة) |
| `POST /v1/pos/points/spend` | `{spendTicket, posOrderRef, points}` ← `pointsSpent`، `valueJod` — والكاشير يضيفها **وسيلة دفع «نقاط»** |
| `POST /v1/pos/identify` | `{phone}` ← `earnTicket` فقط — **كسبٌ فقط، لا صرف بالهاتف أبداً** |
| `POST /v1/pos/earn` | `{earnTicket, posOrderRef, branchId, paidTotal (المال فقط), paidAt}` |
| `POST /v1/pos/earn/reverse` | `{posOrderRef, reason, refundRef?, refundedTotal?}` — المرتجع الجزئيّ يعكس **بالتناسب** |

### ٢.٢ من يستدعي هذه المسارات؟ خياران

**الخيار أ — أشبك تُرحِّل أحداث الكاشير:** الكاشير (أودو POS) ← أشبك ← خادمنا. أشبك تحمل مفتاح الكاشير على خادمها.

**الخيار ب — الكاشير/التابلت يستدعينا مباشرةً:** من خادم أودو عبر موديولنا `integrations/almond_loyalty_pos/`
(المفتاح في `ir.config_parameter`، لا يصل المتصفّح)، والتابلت عبر خادمٍ صغير عندنا.

| المعيار | أ: عبر أشبك | ب: مباشرة |
|---|---|---|
| يوافق قرار المالك «كلّ ربط أودو عبر أشبك» | **نعم** | لا — نصون موديول أودو بأنفسنا |
| واجهة داخل شاشة الكاشير (زرّ، قارئ، وسيلة دفع «نقاط») | **مجهول — سؤال** (هل لأشبك مكوّن داخل POS أم تستقبل الطلبات فقط؟) | مكتوبة في موديولنا، **غير مُثبَّتة ولم تعمل على أيّ أودو** |
| زمن لحظة الكاشير (المسح والصرف) | قفزة إضافيّة؛ يجب p95 < 1 ث | الأقصر |
| من يرى بيانات العضو | أشبك تمرّر رموزاً معتمة وأرقام هواتف (في `identify`) | نحن فقط |
| نقطة عطل واحدة | أشبك تتعطّل ← لا صرف نقاط في كلّ الفروع | موديولنا/خادمنا فقط |
| حدود المعدّل «لكلّ كاشير» | **تنهار**: الحدّ لكلّ عنوان IP (`RATE_POS_EARN_PER_TILL`=120/د)، فكلّ الفروع تظهر عنوانَ أشبك | تعمل كما صُمّمت |
| الصيانة عند ترقية أودو | على أشبك (يصونون ربطهم أصلاً) | علينا |

**التوصية:**

1. **أحداث ما بعد الدفع (`earn`، `earn/reverse`) عبر أشبك (الخيار أ).** غير متزامنة، منيعة التكرار بـ`posOrderRef`، وأشبك ترى طلبات أودو أصلاً — هذا هو «كلّ أودو عبر أشبك» بلا مخاطرة على الزبون أمام الكاونتر.
2. **لحظة الكاونتر (`scan`، `points/spend`، `identify`) عبر أشبك فقط إن تحقّقت ثلاثة شروط:** (أ) لأشبك مكوّنٌ داخل شاشة كاشير أودو يقرأ الباركود ويضيف وسيلة دفع «نقاط»؛ (ب) زمن الترحيل p95 < 1 ثانية مع التزام SLA؛ (ج) المفتاح على خادمها وتمرّر معرّف الكاشير (`tillId`) في كلّ طلب. **وإلّا** تبقى لحظة الكاونتر مباشرةً إلينا (الخيار ب)، ويُختصَر موديولنا إلى الزرّ والقارئ ووسيلة الدفع.
3. **التابلت (رقم الهاتف):** جهازٌ لنا، **مقترن بكاشيرٍ محدّد**، كي تصل تذكرة الكسب إلى طلب ذلك الكاشير بعينه. كيف يلتقي التابلت بطلب أودو الصحيح **سؤالٌ مفتوح** (القسم ٦).
4. **معرّف الطلب:** الصرف يحدث **قبل** الدفع، بينما `pos.order.name` في أودو ١٩ يُسنَد **عند** الدفع (README الموديول، القرار ٣). فـ`posOrderRef` يجب أن يكون معرّفاً موجوداً قبل الدفع وثابتاً عبر الصرف والكسب والمرتجع — **نقترح `pos.order.uuid`** (فريدٌ على مستوى القاعدة)، أو معرّفاً ثابتاً تحدّده أشبك.

### ٢.٣ زيارة واحدة في المحلّ — التسلسل

</div>

```
Member phone          Till (Odoo POS)           Ishbek relay (if option A)      Almond bff
────────────          ───────────────           ──────────────────────────      ──────────
shows ONE QR  ──scan──► reads token ─────────────► POST /v1/pos/scan {token} ──► verify, single-use
                        ◄── member, pointsBalance, spendableJod, spendTicket, earnTicket ──┘
                        rings the order (posOrderRef = stable id, e.g. pos.order.uuid)

member: "use 300 pts" ► POST /v1/pos/points/spend {spendTicket, posOrderRef, points:300} ──► FIFO spend
                        ◄── pointsSpent:300, valueJod ───────────────────────────────────────┘
                        adds payment line "Almond points" = valueJod   (a tender, not a discount)

                        member pays the rest in cash / card
                        order PAID  → outbox (never blocks the sale)
                        POST /v1/pos/earn {earnTicket, posOrderRef, branchId,
                             paidTotal = money only (excludes the points tender),
                             paidAt = "2026-09-24T13:06:00+03:00"} ─────────────────────► points on money only
                        ◄── 201 pointsEarned  (retry → 200 replay:true, never granted twice)

later: refund 1 of 3  ► POST /v1/pos/earn/reverse {posOrderRef, reason, refundRef,
                             refundedTotal} ─────────────────────────────────────────────► reverse the refunded
                        ◄── reversedPoints (proportional), shortfall, pointsBalance            part only

Tablet (earn only):   phone typed ► POST /v1/pos/identify {phone} ► earnTicket only — NEVER a spend
```

<div dir="rtl">

**قواعد تحكم التسلسل:**

- **الكسب على المال فقط:** `paidTotal` = مجموع وسائل الدفع النقديّة/البطاقة **بلا** سطر «نقاط»، شاملاً الضريبة. عضو الشركة لا يكسب (`earnTicket = null`).
- **النقاط بعد الدفع:** لا `earn` قبل أن يصير الطلب مدفوعاً.
- **فشل الربط لا يوقف البيع:** الكسب في طابور (outbox) يُعاد؛ التذكرة تعيش **7 أيّام**، لكنّ `paidAt` يجب أن يقع ضمن **[المسح − 30 دقيقة، المسح + 6 ساعات]** — فأرسلوا دائماً وقت الدفع الفعليّ لا وقت الإرسال.
- **الصرف يفشل بأمان:** إن تعذّر `points/spend` يدفع العضو مالاً ولا يخسر شيئاً.
- **مفتوحٌ مع مهندس الخادم (لا نفترض جوابه):** ماذا يحدث لنقاطٍ صُرفت على طلبٍ **أُلغي قبل الدفع**؟ وهل يُعاد جزء «النقاط» عند المرتجع الجزئيّ (قرار سابق في README الموديول، القرار ٥: الاستبدال المُرتجَع لا يُعاد)؟ — يُحسم قبل الإطلاق.
- **محاسبيّاً (معلّق للمالية — HANDOVER §٧):** «النقاط» وسيلة دفع على حساب التزام الولاء لا خصم مبيعات؛ ومعالجة JoFotara لهذه الوسيلة سؤال للمحاسب.

### ٢.٤ ما يبقى مفيداً من موديول أودو `almond_loyalty_pos`

القرار «كلّ ربط أودو عبر أشبك» **يُرجِّح أنّ الموديول لن يُثبَّت كما هو**. نقولها بصدق: الموديول **هيكلٌ لم يعمل على أيّ
أودو**، ومبنيّ على العقد **القديم** (مسحتان لزيارة الاستبدال، عكسٌ كامل). ما يبقى قيّماً — لنا أو لأشبك:

- **سياسة الأخطاء** (`models/almond_loyalty_policy.py#classify`): أيّ ردٍّ يُعاد وأيّ ردٍّ يُفشِل نهائيّاً — تصلح مواصفةً لترحيل أشبك.
- **نمط الطابور** (outbox داخل savepoint، لا يُفشِل البيع، إعادة بتراجعٍ زمنيّ حتى 6 ساعات).
- **قاعدة `paidAt`**: وقت الدفع الفعليّ بإزاحةٍ صريحة، لا وقت الإرسال.
- **محاكي الخادم** `mock/almond_bff_mock.py` و**40 اختبار وحدة** للعميل — أداة اختبارٍ جاهزة لأشبك قبل الاتّصال بنا.
- **قرار «الاستبدال = وسيلة دفع»** وما حوله من أسئلة محاسبيّة.
- **الموديول نفسه** يبقى الخطّة البديلة لـ«لحظة الكاونتر» إن لم يكن لأشبك مكوّن داخل POS (التوصية ٢ أعلاه).

</div>

---

## ٣) الطلبات الأونلاين والتوصيل

<div dir="rtl">

### ٣.١ الواقع اليوم (متحقَّق)

- **الطلب يُحفظ في قاعدتنا فقط:** `POST /v1/checkout` (`bff/src/routes/checkout.ts`) يعيد التسعير على الخادم ويحفظ الطلب — **ولا شيء يدفعه إلى أودو** (محوّل أودو `bff/src/backend/odoo.ts` يرمي خطأً عمداً).
- **الدفع:** المحفظة تُخصَم على الخادم؛ البطاقة **فقط** بنيّة دفع مقبوضة (وإلّا 402)؛ النقد يُنشأ طلباً **بصفر نقاط**. لا بوّابة دفع متعاقدة بعد، ولا مزوّد SMS (HANDOVER §٢).
- **الدفع بالنقاط أونلاين غير مبنيّ:** `/v1/checkout` يمرّر `pointsRedeemed: 0` صراحةً — لا حقل نقاط ولا دفع مقسوم «محفظة + نقاط». قرار المالك يتطلّب بناءه (عملنا).
- **التوصيل:** مسارات خادم الموقع (`almond-web/src/app/api/delivery/{quote,dispatch,cancel,status,webhook}`) تستدعي أشبك **مباشرةً** بمفتاح خادم (`ISHBEK_KEY`)، والإرسال الحيّ محروسٌ بجلسة الأدمن لأنّ الموقع لا يملك بعد جلسة عضو ولا دفعاً مؤكَّداً. **أجسام الطلبات عيّنة من طرفنا** (`docs/ishbek/*`).

### ٣.٢ المقترح: الطلب إلى أودو عبر أشبك

</div>

```
member ─► app/web ─► bff /v1/checkout  (re-price from the SAME menu version; wallet/card captured)
                        │  order stored + outbox row  (Idempotency-Key = our order id)
                        ▼
                   POST {ISHBEK}/orders  ───────────►  Ishbek ─► Odoo (branch POS/KDS)
                        │                                   └─► delivery? dispatch Careem / Talabat
                        ◄──── webhook order.status (accepted / preparing / ready / picked_up / delivered / cancelled)
                        ◄──── webhook order.paid   (cash on pickup/delivery confirmed by the branch)
                   earn points  (card/wallet: at checkout · cash: on order.paid only)
```

<div dir="rtl">

**مقترحنا — يُثبَّت من وثائق أشبك:**

| البند | الاقتراح |
|---|---|
| **دفع الطلب** | خادمنا يدفع الطلب **بعد** تأكيد الدفع (أو فوراً إن كان نقداً عند الاستلام)، من طابور مع إعادة؛ لا تدفعه الواجهة أبداً |
| **منع التكرار** | ترويسة `Idempotency-Key` = معرّف طلبنا؛ نفس المفتاح بجسمٍ آخر ← رفض؛ أشبك تُرجع معرّف طلب أودو ونحفظه |
| **الأسطر** | معرّف أودو للصنف والحجم وكلّ خيار + الاسم + الكمّيّة + **سعر الوحدة الشامل للضريبة** + `menuVersion` |
| **الضريبة** | **8٪ مضمّنة** في `list_price` — لا يضيف أحدٌ ضريبةً فوقها. العيّنة `docs/ishbek/3.dispatch.request.json` تحمل `tax 16%` قديمة ومصحَّحة في رأس `docs/ishbek/README.md`. رسوم التوصيل: منتج أودو «Delivery Careem» بضريبة 16٪ — **كيف تُفوتَر؟ سؤال** |
| **الأوقات** | كلّ طابع ISO-8601 بإزاحة **`+03:00`** صريحة (`toAmmanISO()` في `packages/shared/src/lib/format.ts`)؛ webhook بلا إزاحة يُرفض 422 (مبنيّ اليوم في مسار webhook التوصيل) |
| **webhooks** | موقَّعة HMAC-SHA256 على الجسم الخام + طابع زمنيّ ضمن نافذة 5 دقائق + `eventId` فريد؛ إعادة بتراجعٍ زمنيّ عند غير 2xx |
| **الحالات** | قائمة مغلقة تُتّفق عليها؛ اليوم عندنا للتوصيل: `assigned · picked_up · on_the_way · delivered · cancelled` (`almond-web/src/lib/delivery-types.ts`) |
| **النقاط** | البطاقة/المحفظة: عند إنشاء الطلب (الدفع مؤكَّد). **النقد:** فقط عند حدث `order.paid` من الفرع عبر أشبك. **الإلغاء/المرتجع:** حدثٌ يعكس النقاط (كليّاً أو بالتناسب) |
| **كريم وطلبات** | الإرسال للأسطول **منتجٌ قائم عند أشبك**؛ نطلب فقط: تسعيرة (رسم + زمن) قبل الدفع، وحالة الكابتن ورابط التتبّع في webhook |

</div>

---

## ٤) الأمن والمفاتيح

<div dir="rtl">

| القاعدة | الوضع عندنا اليوم |
|---|---|
| **كلّ المفاتيح على الخوادم فقط** — لا مفتاح في التطبيق ولا في المتصفّح ولا في أيّ متغيّر `NEXT_PUBLIC_*`/`EXPO_PUBLIC_*` | `ISHBEK_KEY` و`ISHBEK_WEBHOOK_SECRET` يُقرآن في `almond-web/src/server/ishbek.ts` (خادم فقط). ⚠️ لكنّ `packages/shared/src/integration/index.ts` ما زال يقبل `EXPO_PUBLIC_ISHBEK_KEY` احتياطاً — **يجب ألّا يُضبط أبداً، ويُزال** |
| **مفتاحٌ مستقلّ لكلّ طرف** | اليوم **مفتاح كاشير واحد** `POS_SCAN_KEY` لكلّ السلسلة. مقترح: مفتاحٌ خاصّ بأشبك يُسحب وحده دون المساس بغيره (تغييرٌ عندنا) |
| **HMAC على كلّ webhook**، مقارنة ثابتة الزمن، على الجسم الخام | مبنيّ للتوصيل (`verifyWebhookSignature`، `timingSafeEqual`)؛ **الطابع الزمنيّ ضدّ الإعادة غير مبنيّ** (HANDOVER §٨) |
| **التدوير** | مقترح: مفتاحان صالحان معاً أثناء فترة انتقال (مثلاً 7 أيّام)، ثمّ يُسحب القديم؛ تدويرٌ فوريّ عند أيّ تسريب |
| **حدود المعدّل** | الكاشير: الكسب/العكس 120/د لكلّ كاشير و1200/د لكلّ مفتاح، والتسوية 60/300 (`bff/src/config.ts`). **«لكلّ كاشير» = عنوان IP** — ترحيل أشبك يحتاج معرّف كاشير في الطلب أو حدوداً مخصّصة لمفتاحها |
| **قائمة عناوين مسموحة / mTLS** | مقترح لطلبات أشبك إلينا وإليهم |
| **HTTPS فقط**، ولا أسرار أو رموز أعضاء في السجلّات | الموديول والخادم يلتزمان بها (README الموديول) |

**ما لا يجوز لأشبك أبداً:**

1. وضع أيّ مفتاح (مفتاح الكاشير، مفتاح أشبك، سرّ webhook) داخل تطبيق جوّال أو صفحة ويب أو جهاز كاشير في المتصفّح.
2. تخزين رموز QR أو تذاكر الكسب/الصرف أو أرقام هواتف الأعضاء بعد انتهاء الطلب، أو استعمالها لغير الطلب نفسه.
3. استدعاء **الصرف برقم هاتف** — الهاتف للكسب فقط، بقرار المالك.
4. إعادة إرسال `earn` بمرجع طلبٍ مختلف لنفس البيع، أو تغيير `paidAt` إلى وقت الإرسال.
5. بناء قاعدة أعضاء موازية أو مزامنة بيانات أعضائنا إلى أيّ طرف (قانون حماية البيانات الشخصيّة الأردنيّ رقم 24 لسنة 2023 — HANDOVER §٢، البند ٩).

</div>

---

## ٥) الجاهز عندنا ↔ المطلوب منهم

<div dir="rtl">

### ٥.١ جاهز عندنا اليوم (متحقَّق في المستودع)

| # | الجاهز | المسار | الحدّ الصادق |
|---|---|---|---|
| 1 | واجهة الكاشير: رمز، مسح، كسب، عكس، تسوية — برموز أخطاء آليّة ومنع تكرار وحدود معدّل | `bff/src/routes/pos.ts` · `bff/src/pos/token.ts` · `bff/src/pos/sales.ts` | الخادم **غير مستضاف**، والقاعدة **غير منشأة** |
| 2 | عقد الكاشير الموثَّق | `docs/INTEGRATIONS.md` §٢ | لا يتضمّن بعد مسارات اليوم (صرف، هاتف، عكس جزئيّ) |
| 3 | عميل أشبك للخادم + مسارات التوصيل + تحقّق HMAC + حارس `+03:00` | `almond-web/src/server/ishbek.ts` · `almond-web/src/app/api/delivery/*` | الأجسام **عيّنة منّا**؛ ربط الحالة بأودو `TODO` |
| 4 | عيّنات JSON للتوصيل | `docs/ishbek/*` | ليست مواصفة أشبك؛ الضريبة فيها 16٪ قديمة |
| 5 | نموذج المنيو + منيو حقيقيّ: 373 صنفاً، 44 فئة، 306 صور | `packages/shared/src/types/index.ts` · `packages/shared/src/menu/menu.generated.ts` | ثابت وقت البناء؛ حدود النوع في §١.١ |
| 6 | سحب المنيو من أودو للقراءة فقط | `scripts/odoo-menu-pull.ts` | يدويّ |
| 7 | إعادة التسعير على الخادم ورفض الصنف المُطفأ | `bff/src/pricing.ts` | يقرأ الملفّ الثابت |
| 8 | الطلب بمفتاح منع تكرار + نيّة دفع مؤكَّدة | `bff/src/routes/checkout.ts` · `bff/src/plugins/idempotency.ts` · `bff/src/payments/*` | لا بوّابة متعاقدة؛ لا دفع بالنقاط أونلاين |
| 9 | الضريبة 8٪ مضمّنة وحارسها | `packages/shared/src/cart/totals.ts` · `bff/test/tax.test.ts` | — |
| 10 | أداة الوقت بإزاحة `+03:00` | `packages/shared/src/lib/format.ts#toAmmanISO` | — |
| 11 | موديول أودو للكاشير + محاكي الخادم + 40 اختبار للعميل | `integrations/almond_loyalty_pos/` | **غير مُثبَّت**، على العقد القديم |
| 12 | قياس الحِمل على Postgres 16 بمليون طلب: كتابة طلب 386/ث (p99 199 مللي ث)، رمز الكاشير 10,691/ث | `docs/LOAD-BASELINE.md` | نسخة واحدة؛ لا يقيس `scan`/`earn` |

**غير جاهز عندنا (نقوله قبل أن يُسأل):** تسجيل الدخول في التطبيق والموقع محاكاة · `bff` غير مستضاف · لا SMS · لا بوّابة دفع ·
لا دفع للطلبات إلى أودو · لا خدمة منيو حيّة · لا توفّر لكلّ فرع · لا دفع بالنقاط أونلاين · لا تابلت · مسارات اليوم قيد الكتابة.

### ٥.٢ المطلوب من أشبك (قائمة التسليم)

1. **وثائق الواجهات الرسميّة** (منيو، توفّر، طلبات، حالات، توصيل، وأيّ أحداث كاشير) بأمثلة طلب/جواب ورموز أخطاء.
2. **بيئة تجريبيّة (sandbox)** مربوطة بنسخة أودو تجريبيّة (`dev-almond` أو ما يقابلها)، لا بالإنتاج.
3. **مفاتيح منفصلة** لكلّ بيئة (تجريبيّ/إنتاج)، وآلية تدوير.
4. **سرّ توقيع الـwebhooks** وطريقة التوقيع بالتحديد (ما الذي يُوقَّع، الترويسات، الطابع الزمنيّ).
5. **تغذية المنيو** بحقول §١.٢ — بمعرّفات أودو، اختيار واحد/متعدّد، إلزاميّ، أسعار شاملة، صور، لكلّ فرع، وأسعار قناة ألموند = أسعار المحلّ.
6. **حدث التوفّر** (صنف/حجم/خيار، لكلّ فرع) بزمنٍ مُلتزَم به.
7. **ترحيل أحداث الكاشير** (`scan`، `points/spend`، `identify`، `earn`، `earn/reverse`) بمعرّف طلبٍ ثابت ومعرّف كاشير — أو إعلانٌ صريح أنّهم لا يغطّون الكاشير.
8. **استقبال الطلبات** (إنشاء في أودو، منع تكرار، معرّف أودو راجع) و**webhooks الحالة** بما فيها «مدفوع» للنقد.
9. **مطابقة معرّفات الفروع** بين أودو وأشبك وعندنا (قائمتنا في `packages/shared/src/menu/seed.ts` بـ8 فروع ولا تضمّ شارع المدينة).
10. **اتّفاقيّة مستوى خدمة (SLA)**: التوفّر الشهريّ، زمن الاستجابة p95، الإبلاغ عن الأعطال، صفحة حالة.
11. **جهة دعم فنّيّ** مسمّاة وقناة طوارئ.
12. **اتّفاقيّة معالجة بيانات** (DPA) تنصّ أنّ بيانات أعضائنا لنا ولا تُخزَّن.

</div>

---

## ٦) أسئلة للاجتماع

<div dir="rtl">

1. **المنيو:** هل تعطوننا مجموعات التعديل بعلم **اختيار واحد/متعدّد** و**إلزاميّ** وحدّ أدنى/أقصى؟ وهل تعطون **معرّفات أودو** (القالب والمتغيّر وقيمة السمة) مع كلّ صنف وخيار؟
2. **الزرّ الواحد:** كم يستغرق من الضغط حتى يصل لكريم وطلبات اليوم؟ وهل تدفعونه لنا **webhook** أم نسحبه؟ وهل هو **لكلّ فرع** ولكلّ خيار (مثل «حليب الشوفان نفد»)؟
3. **الأسعار:** هل تغذية قناة ألموند بـ**أسعار المحلّ** (قائمة أسعار الكاشير) لا أسعار طلبات/كريم؟ وهل كلّ الأسعار شاملة 8٪؟
4. **الكاشير:** هل لديكم مكوّنٌ **داخل شاشة كاشير أودو** (زرّ، قارئ باركود، وسيلة دفع مخصّصة)؟ أم تغطّون **طلبات التوصيل فقط**؟
5. **أحداث الكاشير:** هل تستطيعون إرسال حدث «طلب كاشير مدفوع» و«مرتجع» (مع المبلغ المُرتجَع ومرجع المرتجع) لطلبات **المحلّ**، لا طلبات التوصيل فقط؟ وما معرّف الطلب الثابت الذي ترسلونه قبل الدفع وبعده؟
6. **الزمن:** ما زمن الاستجابة p95 لو رحّلتم مسح الباركود وصرف النقاط أمام الزبون؟ هل تلتزمون بأقلّ من ثانية؟
7. **التابلت:** كيف يصل رقم الهاتف المُدخَل على تابلت إلى **طلب الكاشير الصحيح**؟ هل يدعم أودو/أشبك ربط شاشة زبون بكاشير؟
8. **الطلبات الأونلاين:** كيف ندفع طلباً إلى أودو عبركم، وكيف يظهر في الفرع (كاشير/شاشة مطبخ)؟ وهل ترسلون حدث «مدفوع» للطلب النقديّ؟ وكيف تُفوتَر رسوم التوصيل (منتج 16٪)؟
9. **المفاتيح والأمن:** مفتاحٌ لكلّ بيئة؟ توقيع HMAC بطابع زمنيّ؟ قائمة عناوين؟ كيف ندوّر المفتاح بلا انقطاع؟
10. **البيئة التجريبيّة:** متى نحصل على sandbox ووثائق؟ وهل مربوطة بأودو تجريبيّ؟
11. **الاستضافة:** من يستضيف ماذا؟ هل تتوقّعون استضافة شيءٍ من خادمنا عندكم؟ — ⚠️ وثائقنا (`docs/HANDOVER.md`، `docs/INTEGRATIONS.md`) موجّهة إلى «أشبك — الفريق الذي سيأخذ المشروع إلى الإنتاج»: **هل أشبك مزوّد ربطٍ فقط، أم أيضاً فريق تنفيذ لهذا المستودع؟**
12. **البيانات:** هل تخزّنون أيّ بيانات أعضاء (هاتف، اسم) تمرّ عبركم؟ أين تُستضاف خوادمكم؟ هل توقّعون اتّفاقيّة معالجة بيانات وفق القانون الأردنيّ 24/2023؟
13. **حدود المعدّل:** كم طلباً في الدقيقة تسمحون لنا؟ وكم ترسلون إلينا في الذروة؟
14. **SLA والأعطال:** ما نسبة التوفّر المُلتزَم بها؟ ماذا يحدث عند تعطّلكم — هل تُخزَّن الأحداث وتُعاد بالترتيب؟ من نتّصل به ليلاً؟
15. **التسعير التجاريّ:** ما نموذج التسعير (رسم شهريّ، لكلّ طلب، لكلّ توصيل، لكلّ حدث كاشير)؟ وهل ترحيل الكاشير والمنيو ضمن الاشتراك الحاليّ؟

</div>

---

## ٧) مخاطر ونقاط انتباه

<div dir="rtl">

| الخطر | الأثر | التخفيف المقترح |
|---|---|---|
| **نقطة عطل واحدة**: أشبك تحمل المنيو والطلبات والكاشير معاً | تعطّلها يوقف الطلب الأونلاين وصرف النقاط في كلّ الفروع | المنيو من آخر نسخة سليمة؛ البيع في المحلّ لا يتوقّف أبداً والكسب في طابور يُعاد (التذكرة 7 أيّام)؛ الصرف يفشل بأمان (يدفع العضو مالاً)؛ SLA مكتوب |
| **توفّرٌ قديم أثناء الانقطاع** | بيع صنفٍ مُطفأ | إن مرّ أكثر من N دقائق بلا مزامنة: تنبيه، وتأكيد الفرع للطلب قبل التحضير |
| **بيانات الأعضاء** تمرّ عبر طرفٍ ثالث | مخاطرة قانونيّة (قانون 24/2023) | أشبك تمرّر رموزاً معتمة فقط؛ الهاتف (في `identify`) يُفضَّل أن يأتينا مباشرةً من التابلت؛ اتّفاقيّة معالجة بيانات |
| **الضريبة والتقريب** | فرق فلسات بين التطبيق والكاشير، أو إضافة ضريبة مرّتين | الأسعار شاملة 8٪ في كلّ الأطراف، ثلاث خانات عشريّة، حارس `bff/test/tax.test.ts`، ورفض أيّ تغذية `pricesIncludeTax: false` |
| **تطابق السعر مع المحلّ** | سعر التطبيق ≠ سعر الكاونتر، أو يأخذ أسعار طلبات المرفوعة | تغذية قناة ألموند = قائمة أسعار الكاشير؛ تدقيق دوريّ مقابل أودو مباشرةً (السحب اليدويّ صار أداة تدقيق) |
| **الواجهة والخادم يقرآن منيوين مختلفين** | السعر المعروض ≠ المُحصَّل | نسخة منيو واحدة يقرؤها الاثنان، و`menuVersion` مع كلّ طلب |
| **معرّف الطلب قبل الدفع** (`pos.order.name` يُسند عند الدفع) | صرفٌ لا يلتقي بكسبه أو بمرتجعه | معرّف ثابت (`pos.order.uuid` أو معرّف أشبك) عبر الصرف والكسب والمرتجع |
| **حدود المعدّل «لكلّ كاشير» تنهار عبر الترحيل** | كلّ الفروع تتقاسم حدّاً واحداً (120/د) | معرّف كاشير في الطلب، أو حدود خاصّة بمفتاح أشبك |
| **الاعتماد على كود لم يعمل** | موديول الكاشير لم يُثبَّت؛ مسارات اليوم قيد الكتابة؛ `bff` غير مستضاف | لا وعود إطلاق قبل: استضافة `bff` + قاعدة + sandbox أشبك + تجربة كاملة على `dev-almond` |
| **ازدواج نقاط** | منح مرّتين عند إعادة المحاولة | منع التكرار بـ`posOrderRef` (مبنيّ: 200 `replay`) و`Idempotency-Key` للطلبات و`eventId` للأحداث |
| **صرف نقاط على طلبٍ أُلغي قبل الدفع** | العضو يخسر نقاطاً بلا مقابل | يُحسم مع مهندس الخادم (إلغاء صرفٍ معلّق أو انتهاء تلقائيّ) قبل الإطلاق |

</div>

---

## English executive summary (for Ishbek's engineers)

**Status: proposal for discussion, 2026-09-24.** Everything labelled *ready* is verifiable in this repo at the path given; everything labelled *proposal* is ours and must be reconciled with Ishbek's actual API docs, which we have not seen. `docs/ishbek/*` is our own sample contract for delivery, not Ishbek's specification.

**Roles.** Odoo 19 stays the source of truth for menu, prices (`list_price`, 8 % VAT included) and sales. Ishbek, already connected to Odoo and dispatching Careem/Talabat, becomes the single bridge between Odoo and the outside world — including Almond's loyalty backend (`bff`). The loyalty backend owns members, points (FIFO lots), wallet and tiers, and never writes to Odoo directly. Ishbek holds no member database.

**1. Menu.** Today the menu is a manual, read-only pull from Odoo (`scripts/odoo-menu-pull.ts`) committed as `packages/shared/src/menu/menu.generated.ts` (373 items, 44 categories, 306 photos); the server re-prices every basket from that file (`bff/src/pricing.ts`) and rejects `inStock === false`. We ask Ishbek for (a) a catalog feed with Odoo ids, tax-inclusive shop prices, sizes with stable ids, modifier groups with single/multi + required + min/max, photos, Arabic/English names and per-branch availability; and (b) an availability event fired by the one-click switch. **Recommendation:** availability by signed push webhook (target ≤ 60 s to server-side rejection), catalog by versioned pull with a 5-minute reconciliation; the manual Odoo pull becomes the fallback and an audit tool. Front ends and the pricing server must read the same menu version. Our side must widen `ItemSize.id` (nine 5-size cakes currently collapse onto `L`), add `required/min/max`, and add per-branch availability.

**2. Till & points.** Till API in `bff/src/routes/pos.ts` (header `x-pos-key`, fail-closed, machine error codes, idempotent by `posOrderRef`). Being added today, not shipped: one-scan `/v1/pos/scan` → `member, pointsBalance, spendableJod, spendTicket, earnTicket`; `/v1/pos/points/spend {spendTicket, posOrderRef, points}` → `pointsSpent, valueJod` (added as a "points" tender); `/v1/pos/identify {phone}` → earn ticket only (never spend by phone); `/v1/pos/earn {earnTicket, posOrderRef, branchId, paidTotal (money only), paidAt}`; `/v1/pos/earn/reverse {posOrderRef, reason, refundRef?, refundedTotal?}` with proportional reversal. **Recommendation:** Ishbek relays the asynchronous post-payment events (earn, reverse). The at-counter calls (scan, spend, identify) go through Ishbek only if Ishbek has a component inside the Odoo POS screen, commits to p95 < 1 s, holds the key server-side and forwards a till id (our per-till rate limit is per source IP); otherwise the till calls us directly and our Odoo addon `integrations/almond_loyalty_pos` (written, never installed, built on the previous contract) is reduced to that UI. `posOrderRef` must exist before payment and stay stable through spend/earn/refund — we propose `pos.order.uuid`, since `pos.order.name` is assigned at payment.

**3. Online orders.** Today `/v1/checkout` stores orders only in our DB; nothing pushes to Odoo (`bff/src/backend/odoo.ts` throws deliberately), points cannot yet be spent online (`pointsRedeemed: 0`), and the website calls Ishbek directly for delivery behind an admin session. **Proposal:** our server pushes paid orders to Ishbek → Odoo from an outbox with `Idempotency-Key` = our order id; lines carry Odoo ids and tax-inclusive prices; every timestamp is ISO-8601 with an explicit `+03:00`; Ishbek sends HMAC-signed status webhooks (with timestamp and `eventId`), including an `order.paid` event for cash orders, which is when those orders earn points.

**4. Security.** Keys server-side only (never in apps or `NEXT_PUBLIC_*`/`EXPO_PUBLIC_*`; the shared config still accepts `EXPO_PUBLIC_ISHBEK_KEY` as a fallback and must not be set); a separate key per party with overlapping rotation; HMAC over the raw body plus a timestamp window (our delivery webhook verifies the body today but has no replay window); IP allowlist; no storage of member tokens, tickets or phone numbers; Jordanian PDPL (Law 24/2023) data-processing agreement.

**5. What we need from Ishbek:** API docs; a sandbox wired to a test Odoo; per-environment keys and a webhook signing secret; the menu feed; availability events; POS event relay (or a clear "not supported"); order intake and status webhooks; branch-id mapping; SLA/uptime; a named support contact; a DPA.

**Honest limits on our side:** member login in app and website is still simulated; `bff` is not hosted and its database not created; no SMS provider or payment gateway yet; the new till endpoints are being written today.
