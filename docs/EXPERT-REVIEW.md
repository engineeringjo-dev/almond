# مراجعة لجنة الخبراء — ألموند كوفي هاوس (قبل الإطلاق)

> نطاق المراجعة: تطبيق React Native/Expo (الحالي)، الموقع المخطّط (Next.js)، وطبقة ربط أودو (Odoo 19 + POS). الأساس التقني منظّم بشكل لافت لمرحلة ما قبل الإطلاق (فصل نظيف بين mock/live عبر `config.DATA_SOURCE`، خريطة تكامل مركزية `constants/integration.ts`، `ErrorBoundary`، وTypeScript strict)، لكن **مسارات المال والنقاط والهوية غير جاهزة للإنتاج**.

---

## 1) ملخص تنفيذي

الحكم العام: **ليست جاهزة للإطلاق التجاري بعد.** البنية الهيكلية سليمة والفواصل (seams) نظيفة، ما يعني أن الإصلاح عمل خلفية (backend) وعقود (contracts) وليس إعادة كتابة للواجهة. أهم الاستنتاجات:

1. **مسار الدفع (checkout) هو أخطر التزام منفرد:** أربعة استدعاءات متتابعة (شحن المحفظة ← إنشاء الطلب ← منح النقاط) بلا ذرّية (atomicity)، بلا تراجع (rollback)، وبلا أي رسالة خطأ للمستخدم (`cart.tsx:100-149`). فشل جزئي = خصم مال بلا طلب، أو دفع بلا نقاط، بصمت تام.

2. **ازدواج مصدر الحقيقة للمال والنقاط:** التصميم الهدف يوزّع الحقيقة بين أودو (المنتجات/الطلبات) وخادم ولاء منفصل (المحفظة/النقاط/الهدايا) (`config.ts:7-8`). المالك يريد **أودو مصدرًا وحيدًا للحقيقة (single source of truth)** للتطبيق والموقع معًا — الوضع الحالي يضمن الانحراف (drift) بين القنوات.

3. **الهوية ليست مبنية على رقم الهاتف:** `useUserId()` يولّد معرّفًا عشوائيًا (`genId('user')`) أو `'guest'` (`authStore.ts:53`)، وخدمة أودو للمصادقة ما زالت تقبل OTP التجريبي `123456` (`auth.service.ts:12-18`). لا يوجد ربط بـ `res.partner`، فنقطة البيع (POS) لا تستطيع مطابقة الرمز الممسوح مع عميل حقيقي.

4. **حسابات المال/النقاط تُجرى على العميل (client-side) والتطبيق هو من يبادر بالمنح:** `cart.tsx:135` يرسل `invoiceAmount` والمضاعفات من الجهاز، بلا مفاتيح تفرّد (idempotency keys)، مع عميل يقطع الاتصال بعد 15 ثانية بلا إعادة محاولة آمنة — وصفة مباشرة للخصم المزدوج والنقاط المتضخّمة والقابلة للتلاعب.

5. **أسرار مميّزة في حزمة عامة:** `EXPO_PUBLIC_ODOO_API_KEY` و`EXPO_PUBLIC_LOYALTY_TOKEN` تُدمج في حزمة JS المنشورة على GitHub Pages العامة، والنقاط النهائية تثق بأي `userId` يُرسَل — أي شخص يقرأ الحزمة يشحن/يمنح نقاطًا لأي عضو.

6. **الأداء غير مضبوط للإطلاق:** حزمة ويب أحادية ~5.2MB بلا تقسيم (code-splitting)، 267 صورة CDN بحجمها الأصلي بلا WebP/تحجيم/تحميل كسول، و`FlatList` غير مضبوطة فوق 267 عنصرًا مع أنيميشن `FadeIn` لكل خلية — مؤشرات LCP/الاستجابة أدنى بكثير من مستوى ستاربكس.

7. **صفر اختبارات آلية، لا CI test gate، ولا ESLint** (سكربت "lint" يفحص الأنواع فقط) — لنظام يتعامل مع المال والنقاط، هذه أعلى فجوة من حيث النفوذ (leverage).

الخلاصة: الأساس واعد، لكن يلزم **حزمة صلابة مال/هوية + طبقة BFF تجعل أودو المرجع** قبل تفعيل أي مال حقيقي، بالتوازي مع مكاسب أداء سريعة منخفضة الجهد.

---

## 2) أبرز نقاط الضعف (مرتّبة حسب الأثر × الجهد)

| # | البند | المنتج | الخطورة | الأثر | الجهد | التوصية المختصرة |
|---|-------|--------|---------|-------|-------|------------------|
| 1 | منح النقاط على العميل بلا حارس mock (`cart.tsx:135`) → مضاعفة النقاط لحظة تحويل `DATA_SOURCE='odoo'` | تطبيق | حرجة | عالٍ | منخفض | تقييد الاستدعاء بـ mock فقط؛ سطر واحد |
| 2 | حراس إقلاع مفقودة: التحويل لـ odoo يشحن OTP/دفع وهميين + قائمة مكسورة | تطبيق/أودو | حرجة | عالٍ | منخفض | رمي خطأ عند الإقلاع إذا كان أي عميل live ما زال mock alias |
| 3 | خصم ترويجي نسبي "متجمّد" يبقى ثابتًا بعد تغيّر السلة (`PromoInput.tsx:20`) | تطبيق | عالية | عالٍ | منخفض | خزّن **الكود** فقط وأعد الحساب من `subtotal` الحيّ |
| 4 | لا مفاتيح تفرّد (idempotency) على أي طفرة مال/نقاط؛ عميل 15s بلا retry | كلاهما | حرجة | عالٍ | متوسط | ترويسة `Idempotency-Key` (UUID) على كل POST مالي |
| 5 | checkout غير ذرّي بلا rollback ولا سطح خطأ (`cart.tsx:100-149`) | تطبيق | حرجة | عالٍ | متوسط | try/catch + toast، ونقطة نهاية واحدة تعاملية على الخادم |
| 6 | صور CDN بالحجم الكامل بلا WebP/تحجيم/كسول/expo-image | كلاهما | عالية | عالٍ | منخفض | `?width=320&format=webp` + `expo-image` — يقلّص البايتات 70-90% |
| 7 | خيار المحفظة قابل للاختيار مع رصيد غير كافٍ؛ mock يمنح +50% مجانًا | تطبيق | عالية | عالٍ | منخفض | تعطيل الخيار عند `balance < total`؛ تحقّق على الخادم |
| 8 | المال كأرقام عشرية عائمة (floats) بلا تقريب لفلس JOD؛ انحراف رصيد المحفظة | كلاهما | عالية | عالٍ | متوسط | تمثيل المال كأعداد فلس صحيحة (integer fils)؛ أودو المرجع |
| 9 | أسرار مميّزة في حزمة عامة + نقاط نهاية تثق بـ userId عشوائي | كلاهما | حرجة | عالٍ | متوسط | السرّ في BFF فقط؛ JWT قصير لكل شريك؛ اشتقاق userId من التوكن |
| 10 | ازدواج مصدر الحقيقة: خادم ولاء منفصل ينافس أودو على المحفظة/النقاط | أودو | حرجة | عالٍ | عالٍ | أودو المرجع الوحيد عبر `loyalty.program/card/reward`؛ الخادم الآخر BFF بلا حالة |
| 11 | الهوية معرّف عشوائي عابر لا شريك أودو مبني على الهاتف | كلاهما | حرجة | عالٍ | عالٍ | الهوية = `res.partner` مفتاحها هاتف +962 مطبّع؛ JWT موضوعه معرّف الشريك |
| 12 | حساب المال/النقاط على العميل والتطبيق يبادر بالمنح | كلاهما | حرجة | عالٍ | عالٍ | منح موثوق من الخادم (server-authoritative) بمرجع طلب فقط |
| 13 | لا اختبارات آلية، لا CI gate، لا ESLint | كلاهما | عالية | عالٍ | متوسط | Jest للدوال النقية + ESLint + وظيفة CI تحجب الدمج |
| 14 | مسح POS قد يمنح النقاط مرتين على طلب منحه التطبيق أصلًا | أودو | عالية | عالٍ | متوسط | حدث منح واحد لكل معاملة؛ QR يعرّف العضو فقط لا يمنح |
| 15 | السلة غير محفوظة — تحديث المتصفح/إغلاق التطبيق يفرغها | كلاهما | متوسطة | متوسط | منخفض | `persist()` على `cartStore` (AsyncStorage/localStorage) |
| 16 | حزمة ويب أحادية ~5.2MB بلا code-splitting | ويب | حرجة | عالٍ | متوسط | `web.output:"static"` أو `asyncRoutes`؛ CDN حقيقي |
| 17 | `FlatList` غير مضبوطة (267) + `FadeIn` لكل خلية + بطاقة بلا memo | تطبيق | عالية | عالٍ | متوسط | `React.memo` + `getItemLayout` + إزالة FadeIn؛ FlashList |
| 18 | خدمة قائمة أودو مجرد stub: بلا auth، بلا تحويل حقول، تحويل خام | تطبيق | عالية | عالٍ | عالٍ | القائمة عبر BFF مع تحويل حقيقي للمقاسات/التعديلات/اللغتين |
| 19 | الطلبات لا تصل أودو فعليًا؛ خدمة odoo تحاكي mock بصمت | أودو | عالية | عالٍ | عالٍ | `odooOrderService` حقيقي ← `sale.order`/`pos.order` + دفع الحالة |
| 20 | سحب زائد للمحفظة: تحقّق على العميل بلا قفل على الخادم | كلاهما | عالية | عالٍ | متوسط | طفرات ذرّية على الخادم (`UPDATE ... WHERE balance>=amount`) |
| 21 | كوب الولاء يمتلئ بكسور (1.5) → عدّ مربك ومشروب مجاني غير مستحق | تطبيق | متوسطة | متوسط | منخفض | قاعدة صحيحة (integer): +1 دائمًا أو ختم كامل صريح |
| 22 | تصفير النقاط الصامت مخفي داخل قراءة (`getBalance`) | تطبيق | متوسطة | متوسط | متوسط | نقل الانتهاء لعملية صريحة مسجّلة idempotent |
| 23 | 543KB `menu.generated.ts` مضمّنة في الحزمة وتُحلَّل عند الإقلاع | كلاهما | عالية | عالٍ | متوسط | تقديمها كـ JSON مضغوط عند الطلب لا كوحدة JS |
| 24 | 3.6MB صور محلية مضمّنة بلا استخدام | تطبيق | متوسطة | متوسط | منخفض | حذفها أو ربطها كـ fallback؛ تضييق `assetBundlePatterns` |
| 25 | تأخير 350ms مصطنع على كل قراءة بيانات | كلاهما | متوسطة | متوسط | منخفض | `ms=0` في الإنتاج/الويب |
| 26 | خطوط TTF 333KB تحجب أول رسم، بلا WOFF2/swap | ويب | متوسطة | متوسط | متوسط | WOFF2 مجزّأة + `font-display:swap`؛ عدم حجب الرسم على الخط |
| 27 | لا معالجة أخطاء للطفرات (redeem/topup/gift/spin) — فشل صامت | تطبيق | متوسطة | متوسط | منخفض | `onError` مع toast مترجم أو `MutationCache.onError` |
| 28 | حارس splash يتجاهل ترطيب auth → وميض ضيف + سباق userId | تطبيق | متوسطة | متوسط | منخفض | إضافة `authStore.hydrated` للحارس أو `enabled:!!userId` |
| 29 | تبديل اللغة يقلب RTL بلا reload → تخطيط مختلط الاتجاه | تطبيق | متوسطة | متوسط | متوسط | reload مُتحكَّم بعد تغيير الاتجاه (expo-updates/location.reload) |
| 30 | `ErrorBoundary` يبتلع الأخطاء لـ console — لا رصد/تقارير أعطال | تطبيق | متوسطة | متوسط | متوسط | Sentry/Crashlytics + تحليلات نجاح/فشل checkout |
| 31 | QR ثابت نصّي صريح — قابل لإعادة التشغيل (replay)، غير موقّع | كلاهما | متوسطة | متوسط | متوسط | توكن موقّع قصير العمر (~60s) يتحقق منه POS |
| 32 | النقاط تُحتسب على الإجمالي شامل الضريبة لا الصافي قبلها | تطبيق | متوسطة | متوسط | منخفض | تحديد قاعدة المنح صراحةً وتوثيقها ليتطابق POS |
| 33 | flags `enabled.*` وهمية — الولاء كله-أو-لا-شيء على DATA_SOURCE | تطبيق | عالية | متوسط | متوسط | تركيب الخدمة لكل نطاق أو حذف الأعلام وتوثيق الذرّية |
| 34 | `packages/shared` محجوب باقتران `categoryKind`/`recommendations` بـ `seed.ts` | كلاهما | متوسطة | متوسط | متوسط | تقسيم `seed.ts` لبيانات مشتركة/خاصة بالتطبيق أولًا |

---

## 3) تحسين الواجهة والتجربة (UI/UX)

- **السلة العابرة أكبر خطأ تجربة:** لا يوجد `persist` على `cartStore` (`cartStore.ts:54`). تحديث المتصفح أو إغلاق التطبيق يمحو السلة والفرع وخيار الدفع بلا تحذير. تطبيقات الطلب من مستوى ستاربكس تستعيد السلة دائمًا. **الحل:** `persist()` مع إعادة التحقّق من التوفّر والأسعار عند الترطيب.
- **الأخطاء الصامتة تُفقد الثقة:** فشل الدفع، عدم كفاية النقاط، أو خطأ خادم لا يُظهر شيئًا للمستخدم (`cart.tsx:109`، طفرات `useLoyalty` بلا `onError`). كل طفرة مالية تحتاج toast مترجَم وإتاحة إعادة محاولة.
- **وميض الضيف (guest flash):** المستخدم العائد يرى بيانات ضيف ثم بياناته بعد ترطيب auth (`_layout.tsx:57`). إضافة `authStore.hydrated` للحارس يزيل الوميض والجلب المزدوج.
- **اتجاه مختلط RTL/LTR:** تبديل اللغة يستدعي `forceRTL` بلا reload (`LanguageSheet.tsx:23`)، فتتناقض `isRTL` مع الاتجاه الفعلي حتى الإقلاع البارد التالي. لجمهور عربي افتراضيًا، هذا مرئي ومربك — يلزم reload مُتحكَّم.
- **اتساق الأرقام العربية:** `formatNumber` يعتمد `ar-JO` عبر Intl (`format.ts:12`)؛ على Hermes بلا ICU كامل قد يسقط لأرقام لاتينية بينما الويب يعرض ١٬٢٤٠ — مظهر غير متّسق. يلزم تثبيت نظام الأرقام صراحةً + snapshot test.
- **بحث القائمة يتجاهل `descAr`:** `searchItems` يطابق `nameAr/nameEn/descEn` فقط — استرجاع ناقص للجمهور العربي. إضافة `descAr` وتطبيع العربية (إزالة التشكيل/التطويل).
- **عرض الكوب الكسري (8.5/10):** يقرأه المستخدم كخلل. اجعله عددًا صحيحًا.

---

## 4) الأداء والسرعة

**تشخيص الويب (حرج):** `web.output:"single"` (`app.json`) يبني حزمة JS واحدة تضم كل المسارات (~22) والمخازن والبيانات وطبقة RN-web/reanimated/gesture-handler. المتصفح يجب أن ينزّل ويحلّل ويقيّم التطبيق كاملًا قبل أول رسم — عدة ثوانٍ على هاتف عمّان متوسط عبر 4G، أدنى بكثير من هدف LCP<2.5s.

**أزمة الصور (أعلى مكسب سريع):** كل 267 صنفًا يشير إلى `images.deliveryhero.io` وتُعرض بالحجم الأصلي عند ~150px بلا `?width=`، بلا WebP، بلا تحميل كسول، بلا `expo-image`. فتح الشبكة يجلب عدة ميغابايت. نقطة نهاية deliveryhero تدعم معاملات التحويل — الإصلاح **مجاني**.

**قائمة غير مضبوطة:** `FlatList` فوق 267 عنصرًا بلا `windowSize/getItemLayout/removeClippedSubviews`، كل خلية ملفوفة بـ `FadeIn` (قيمتا Animated + timing لكل تركيب)، و`MenuItemCard` بلا `React.memo` → jank مرئي عند التمرير وإعادة رسم على كل ضغطة بحث.

| المشكلة | الأثر | الإصلاح | الجهد |
|---------|-------|---------|-------|
| صور CDN كاملة الدقة | LCP + كلفة بيانات عالية | `?width=320&format=webp` + `expo-image` (`cachePolicy`, blurhash) | منخفض |
| تأخير 350ms مصطنع (`util.ts:2`) | كمون مضمون لكل تنقّل | `ms=0` في الإنتاج | منخفض |
| `FadeIn` لكل خلية + بلا memo | jank التمرير | `React.memo` + إزالة FadeIn | منخفض |
| `FlatList` بلا افتراضية | إسقاط إطارات | props الافتراضية + `getItemLayout` أو FlashList | متوسط |
| حزمة أحادية 5.2MB | TTI بطيء | `output:"static"`/`asyncRoutes` | متوسط |
| `menu.generated.ts` 543KB مضمّنة | تحليل يحجب الرسم | JSON مضغوط عند الطلب | متوسط |
| 3.6MB صور ميتة (`assets/menu`) | حجم تثبيت منتفخ | حذف + تضييق `assetBundlePatterns` | منخفض |
| خطوط TTF 333KB تحجب الرسم | نص غير مرئي | WOFF2 + `swap` | متوسط |
| `refetchOnWindowFocus` مفعّل لقائمة ثابتة | جلب + تأخير مكرر | `staleTime:Infinity` + `refetchOnWindowFocus:false` | منخفض |
| RN-web + reanimated في حزمة الويب | وزن ميت | لا تُعِد استخدام RN-web في موقع Next.js | عالٍ |

**الموقع المخطّط (Next.js):** يجب ألا يعيد استخدام RN-web. صيّر صفحات القائمة/الأصناف بـ **ISR** (`revalidate ~3600s`) مع ترطيب جزر تفاعلية فقط (السلة/النقاط)، و`next/image` بـ remote loader لـ deliveryhero (AVIF/WebP، srcset، كسول، blur)، وتخزين JSON للقائمة على الحافة (edge). ميزانيات صريحة تُفرض في CI عبر Lighthouse: **LCP<2.5s، INP<200ms، CLS<0.1، JS أولي <170KB gzip/مسار**.

---

## 5) البيع والتحويل والولاء

الربط بأثر متوقّع على **الطلبات / متوسط قيمة السلة (AOV) / الاحتفاظ (retention)**:

| التوصية | الأثر المتوقّع |
|---------|----------------|
| **حفظ السلة (persist)** | تقليل الطلبات المهجورة عند تحديث المتصفح — أثر مباشر على **معدّل إكمال الطلب** ومن ثمّ عدد الطلبات |
| **إظهار أخطاء الدفع/الطلب** بدل الفشل الصامت | استرداد عمليات شراء كانت تُفقد بصمت — رفع **معدّل التحويل** |
| **إصلاح الخصم الترويجي المتجمّد** | حماية الثقة والهامش معًا؛ الكود المعروض يطابق المُحتسب — يقلّل النزاعات ويشجّع استخدام العروض |
| **تعطيل المحفظة عند رصيد غير كافٍ + منع +50% المجاني** | إغلاق تسريب نقاط/كوب غير مستحق يفسد اقتصاد الولاء ويشوّه AOV |
| **جعل المنح موثوقًا من الخادم** ومرجع طلب فقط | رصيد نقاط يطابق أودو للفلس — أساس برنامج ولاء موثوق يرفع **الاحتفاظ** |
| **كوب صحيح (integer)** + قاعدة منح واضحة | تجربة تقدّم مفهومة نحو المشروب المجاني — محرّك تكرار زيارة (retention) |
| **حدث منح واحد لكل معاملة** (منع مسح POS المزدوج) | حماية هامش البرنامج من نقاط مزدوجة تُصرَف لاحقًا كمشروبات مجانية |
| **قاعدة المنح: صافي أم إجمالي؟** (حاليًا شامل الضريبة → +16% نقاط) | قرار مقصود يوائم AOV الحقيقي مع كلفة المكافآت |
| **بيع تكميلي (cross-sell) مُحسَّن الأداء** (`getCartCrossSell`) | رفع **AOV** — لكن يلزم `useMemo` وخريطة `Map<itemId>` لتفادي O(n) على المسار الساخن |

توصية استراتيجية: اجعل الأصناف المميّزة (Featured) والتوصيات (`recommendations`) مدفوعة ببيانات أودو الموثوقة لاحقًا (توفّر/سعر/حملة Double-Points نشطة)، بدل منطق عميل ثابت.

---

## 6) الترافيك وSEO والنمو (الموقع)

الموقع لم يُبنَ بعد (`docs/WEBSITE-HANDOFF.md`)، وهذه فرصة لتفادي أخطاء التطبيق:

- **التصيير للـ SEO:** استخدم ISR/SSG لصفحات القائمة/الفئة/المنتج (PDP) حتى يكون الـ HTML مخزّنًا على الحافة وقابلًا للفهرسة — لا تكرّر نمط التطبيق العميل-فقط.
- **ثنائية اللغة (AR-RTL / EN-LTR):** مسارات لغوية منفصلة مع `hreflang` صحيح، `dir` و`lang` على مستوى المستند، وبيانات وصفية مترجمة — أساسي لجمهور عمّان.
- **Core Web Vitals كإشارة ترتيب:** فرض LCP<2.5s / INP<200ms / CLS<0.1 عبر Lighthouse-CI؛ `next/image` يحلّ CLS تلقائيًا بأبعاد محجوزة.
- **بيانات منظّمة (structured data):** schema.org `Restaurant/Menu/MenuItem` وأسعار وصور لكل صنف — يفتح نتائج غنية (rich results) لعمليات بحث "قهوة عمّان".
- **CDN حقيقي بدل GitHub Pages** إن نما الترافيك: أصول مجزّأة غير قابلة للتغيّر (immutable hashed) مع gzip/brotli.
- **هوية موحّدة عبر الهاتف** تربط زوّار الموقع بحساباتهم في التطبيق وPOS — أساس قياس النمو والاحتفاظ عبر القنوات.

---

## 7) ربط أودو (Odoo) — المعمارية والمخاطر

### المعمارية الهدف

- **أودو 19 هو المرجع الوحيد (single ledger).** استخدم المنظومة الأصلية:
  - `loyalty.program` بالأنواع: `loyalty` (نقاط/طبقات عبر `loyalty.card.points`)، `gift_card`، `ewallet` (قيمة مخزّنة).
  - `loyalty.reward` + `loyalty.rule` للمكافآت والقواعد.
  - `pos.order` / `sale.order` للصرف — فاسترجاع POS يعكس النقاط تلقائيًا عبر سجل الولاء في أودو.
- **طبقة BFF رقيقة بلا حالة (stateless)** بين العملاء وأودو: تترجم عقد التطبيق إلى JSON-RPC/ORM وتخزّن القراءات مؤقتًا. **لا تحمل أي رصيد موثوق.** "خادم الولاء" المنفصل يُختزل إلى هذا البروكسي أو يُحذف.
- **الهوية = `res.partner`** مفتاحها هاتف +962 مطبّع؛ OTP → JWT قصير العمر موضوعه (subject) معرّف الشريك ومرجع `loyalty.card`. `useUserId()` يعيد هذا المعرّف، وQR يشفّر توكنًا موقّعًا يُحلّ إليه.
- **المنح موثوق من الخادم:** العميل يرسل مرجع طلب/فاتورة فقط؛ أودو يعيد حساب كل شيء (بنود الطلب، الطبقة من صرف 12 شهرًا متدحرجة، علم المحفظة، حملة نشطة). المنح أثر جانبي لتأكيد أودو الطلب مدفوعًا.
- **خرائط الهوية للمنتجات:** ثبّت معرّفات Talabat كـ `ir.model.data` external ids (`'flower-cup'`, `'sec-16585334'`, `'g116886'`) ليخاطب الجميع المنتجات بمفتاح مستقر عن الـ pk الرقمي لأودو.

### عقود الـAPI (المبادئ)

- **`Idempotency-Key` (UUID) إلزامي** على كل POST مالي (earn/charge/topup/redeem/order)؛ مفتاح مكرّر يعيد النتيجة الأصلية ولا ينفّذ ثانيةً. يُولَّد مرة لكل نيّة مستخدم لا لكل محاولة HTTP.
- **checkout نداء خادم واحد تعاملي:** يدفع/يشحن المحفظة، ينشئ الطلب، ويمنح النقاط في معاملة DB واحدة، ويعيد الطلب المؤكَّد + الرصيد الجديد. العميل يتوقّف عن تنسيق المال.
- **طفرات الرصيد ذرّية على الخادم** (`ewallet` مع قفل صف / `UPDATE ... WHERE balance>=amount RETURNING`)؛ رفض عند `affected-rows=0`.
- **المال كأعداد فلس صحيحة (JOD×1000)** على السلك وفي الدفتر؛ Decimal أودو هو الحقيقة والعميل يهيّئ للعرض فقط.
- **الحالة تُدفع من أودو للتطبيق** عبر webhook→FCM أو SSE، مع GET-poll احتياطيًا. مهلة الإلغاء 30s قاعدة يفرضها الخادم لا مؤقّت عميل.

### أهم المخاطر التي يجب تجنّبها

1. **ازدواج مصدر الحقيقة** (خادم ولاء + أودو) → انحراف المحفظة والنقاط. **تجنّبه بجعل أودو المرجع الوحيد.**
2. **تحويل `DATA_SOURCE='odoo'` اليوم يشحن إنتاجًا معطوبًا:** OTP وهمي مقبول، دفع وهمي ناجح، طلبات لا تصل المطبخ، قائمة مكسورة، مع ولاء حقيقي فوقها. **أضف حراس إقلاع تمنع ذلك.**
3. **الخصم/المنح المزدوج** بين checkout التطبيق ومسح POS. **حدّد حدث منح واحدًا لكل معاملة اقتصادية.**
4. **أسرار في حزمة عامة + ثقة بـ userId المُرسَل** → أي شخص يشحن/يمنح لأي عضو. **السرّ في BFF فقط، اشتق userId من التوكن.**
5. **checkout غير ذرّي** → مال مخصوم بلا طلب. **معاملة خادم واحدة + تعويض (compensation).**
6. **أعلام `enabled.*` وهمية** توحي بطرح تدريجي غير موجود → قد تشحن محفظة live بينما تمنح على mock. **حقّق التركيب لكل نطاق أو احذف الأعلام.**

---

## 8) جودة الكود والموثوقية + قائمة تحقق ما قبل الإطلاق

**نقاط القوة:** فصل mock/live نظيف، خريطة تكامل مركزية، `ErrorBoundary`، TypeScript strict — تنظيم لافت لمرحلة مبكّرة.

**الفجوات الجوهرية:** صفر اختبارات، لا CI test gate، ولا ESLint (سكربت "lint" = `tsc --noEmit` فقط رغم تعليقات `eslint-disable`). دوال نقية عالية الخطورة بلا تغطية: `computeTotals`, `earn`, `tierFromSpend`, `comboPairs`, `validatePromo`, `pickWeightedPrize`, `isBranchOpen`. أخطاء صحّة محدّدة: خصم متجمّد، كوب كسري، تصفير نقاط داخل قراءة، `isBranchOpen` ينكسر لأي إغلاق بعد منتصف الليل (`util.ts:23`)، `genId` قابل للتصادم بعد reload.

### قائمة تحقق ما قبل الإطلاق

- [ ] **حراس إقلاع:** رمي خطأ إن كان `DATA_SOURCE='odoo'` وأي عميل live (auth/payment/order/menu) ما زال mock alias.
- [ ] **تقييد المنح على العميل بـ mock فقط** (`cart.tsx:135`) لمنع المضاعفة عند التحويل.
- [ ] **`try/catch` حول `placeOrder`** + toast مترجم على الفشل.
- [ ] **مفاتيح تفرّد (idempotency)** على كل طفرة مال/نقاط + retry بتراجع أُسّي للنداءات الآمنة فقط.
- [ ] **تمثيل المال كأعداد فلس صحيحة** + مساعد تقريب على الحدود.
- [ ] **إصلاح الخصم الترويجي:** تخزين الكود وإعادة الحساب من `subtotal` الحيّ.
- [ ] **تعطيل المحفظة عند رصيد غير كافٍ** + `paidFromBalance:true` فقط عند تسوية فعلية ناجحة.
- [ ] **حفظ السلة (`persist`)** مع إعادة تحقّق عند الترطيب.
- [ ] **`authStore.hydrated` في حارس splash** أو `enabled:!!userId`.
- [ ] **نقل السرّ خارج `EXPO_PUBLIC_*`** إلى BFF؛ إضافة ترويسة auth لخدمة قائمة أودو.
- [ ] **Jest + أول جناح** للدوال النقية (مال/نقاط/طبقات/combo/promo/spin).
- [ ] **ESLint (`eslint-config-expo`) + وظيفة CI** تشغّل `tsc + lint + tests` وتحجب الدمج.
- [ ] **رصد أعطال (Sentry/Crashlytics)** موصول بـ `componentDidCatch` و`MutationCache.onError` + تحليلات نجاح/فشل checkout.
- [ ] **`onError` مترجم** لكل طفرة (redeem/topup/gift/spin).
- [ ] **قرار reload عند تبديل اللغة** لتفادي التخطيط المختلط.
- [ ] **تثبيت ICU/أرقام** + snapshot test للتنسيق.
- [ ] **معالجة `isBranchOpen`** لحالة عبور منتصف الليل + اختبارات حدود.
- [ ] **`genId` → UUID** (`expo-crypto`)؛ إضافة `descAr` للبحث.

---

## 9) خارطة الطريق

### الآن (0–2 أسبوع) — إغلاق الأقفال المالية والمكاسب المجانية

**صلابة المال/الهوية (منخفض الجهد، حرج):**
- تقييد المنح على العميل بـ mock (سطر واحد) + حراس إقلاع للتحويل لـ odoo.
- `try/catch` + toast على `placeOrder`؛ `onError` لكل الطفرات.
- إصلاح الخصم الترويجي المتجمّد؛ تعطيل المحفظة عند رصيد غير كافٍ ومنع +50% المجاني.
- مساعد تقريب المال (3 فلوس) + بداية تمثيل الفلس الصحيح.
- `persist` للسلة؛ `authStore.hydrated` في الحارس.

**مكاسب أداء مجانية (منخفض الجهد، عالي الأثر):**
- `?width=320&format=webp` + `expo-image` للصور.
- `delay ms=0` في الإنتاج؛ إزالة `FadeIn` + `React.memo`؛ props افتراضية للقوائم.
- حذف `assets/menu` (3.6MB) وتضييق `assetBundlePatterns`؛ إزالة تبعيات الخطوط غير المستخدمة.
- `refetchOnWindowFocus:false` + `staleTime:Infinity` للقائمة.

**أساس الجودة:** ESLint + وظيفة CI (`tsc + lint`)؛ أول جناح Jest للدوال النقية.

### التالي (2–6 أسابيع) — جعل أودو المرجع

- بناء **طبقة BFF بلا حالة**؛ نقل سرّ أودو إليها؛ JWT قصير لكل شريك.
- **الهوية المبنية على الهاتف:** OTP → `res.partner`؛ `useUserId()`/QR من معرّف الشريك؛ هجرة المعرّفات العشوائية عند أول تسجيل دخول.
- **مفاتيح التفرّد** في `apiClient` عبر كل الطفرات؛ **checkout نداء تعاملي واحد** بتعويض.
- **المنح موثوق من الخادم** بمرجع طلب فقط؛ حدث منح واحد لكل معاملة (منع مسح POS المزدوج).
- **طفرات رصيد ذرّية**؛ حدّ سحب زائد على الخادم.
- **`odooMenuService` و`odooOrderService` حقيقيان** عبر BFF (تحويل مقاسات/تعديلات/لغتين، `sale.order`/`pos.order`، دفع الحالة).
- تثبيت external ids لمعرّفات Talabat + وظيفة مزامنة idempotent.
- Sentry موصول؛ قرار reload للغة؛ إصلاح `isBranchOpen` + كوب صحيح.

### لاحقًا — النمو والموقع

- **موقع Next.js** بـ ISR + `next/image` + edge CDN + ميزانيات CWV مفروضة في CI.
- تقسيم `seed.ts` وبناء `packages/shared` منطق-فقط (بلا RN-web) يستهلكه التطبيق والموقع.
- **QR موقّع قصير العمر** يتحقق منه POS؛ نقل انتهاء النقاط لعملية مسجّلة idempotent.
- توسّع الاختبارات (property-based للمال)، وبيانات schema.org، وتوحيد التحليلات عبر القنوات.

---

## 10) برومبتات بحوث معمّقة (جاهزة للنسخ)

**1) أداء Expo Router على الويب**
> For an Expo SDK 56 / Expo Router app with 22 routes, compare `web.output` "single" vs "static" vs `experiments.asyncRoutes`: measured effects on initial JS chunk size, FCP, LCP and TTI. How to code-split a 543KB inlined data module out of the initial chunk, serve hashed immutable assets, and enable gzip/brotli from GitHub Pages vs Cloudflare/Vercel.

**2) معاملات CDN صور deliveryhero/Talabat**
> Full list of supported transformation query params for `images.deliveryhero.io/image/...` (width, height, quality, format=webp/avif, dpr), caching/edge behavior, and best-practice responsive srcset patterns for a menu grid at 160px tiles on 1x/2x/3x screens.

**3) قوائم React Native عالية الأداء**
> RN FlatList vs @shopify/flash-list for a 2-column, 267-item image grid: getItemLayout for fixed-aspect cells, windowSize/initialNumToRender tuning, removeClippedSubviews caveats on RN-web, and measured jank/FPS/memory. Can per-cell entrance animations be kept without breaking cell recycling?

**4) منظومة ولاء أودو 19 الأصلية**
> Model earn-per-currency points, spend-based rolling-12-month tiers, a free-drink "cup", stored-value e-wallet, and gift cards using Odoo 19 `loyalty.program` (types loyalty/gift_card/ewallet), `loyalty.card`, `loyalty.rule`, `loyalty.reward`. Exact fields, how points post from pos.order and sale.order, whether one loyalty.card can back both points and ewallet, refund/reversal behavior, and JSON-RPC calls to read/earn/redeem/charge atomically with row-level locking.

**5) مال ونقاط موثوقة من الخادم عبر BFF**
> Design a transactional, idempotent checkout+loyalty flow between a React Native/Next.js client and Odoo 19 via a thin BFF: idempotency-key design for non-repeatable POSTs (earn/charge/topup/redeem/order), safe retry with exponential backoff, saga/compensation for split payment-gateway + wallet + order + earn, and webhook-vs-polling for Odoo order/POS status pushed to FCM/SSE. Provide endpoint contracts and sequence diagrams.

**6) تحويل قائمة Talabat إلى منتجات أودو**
> Map a DeliveryHero-shaped menu export (categories, items, S/M/L sizes, modifier groups with per-option price deltas, CDN photos, bilingual AR+EN names/descriptions) into Odoo 19: product.template vs product.product variants vs product.attribute for sizes, optional products / POS combos for modifiers, pinning source ids as ir.model.data external identifiers, translated fields via lang contexts, and a repeatable idempotent upsert+soft-delete sync on product write.

**7) هوية واحدة مبنية على الهاتف عبر القنوات**
> One phone-based customer identity across a mobile app, e-commerce website, and Odoo 19 POS: OTP login resolving to res.partner, issuing short-lived rotating/refreshable per-partner JWTs so no long-lived secret ships in a public web/Expo bundle, deriving userId from the token subject and rejecting client-supplied ids, signed short-TTL QR tokens the POS validates, and migrating anonymous/guest client-random ids to canonical partner ids at first login.

**8) تمثيل المال في JS لعملة 3-عشرية**
> Best practices for money in a TypeScript/React Native app for a 3-decimal currency (JOD/fils): integer-minor-unit storage vs decimal libraries, rounding at boundaries, tax computation, and property-based tests guaranteeing displayed totals equal charged totals across many transactions.

**9) موقع Next.js ثنائي اللغة RTL للتجارة الإلكترونية**
> Next.js 14/15 for a bilingual (Arabic-RTL/English-LTR) coffee e-commerce menu: ISR vs SSG vs streaming SSR for a ~267-item catalog sharing a phone-based account with a React Native app; next/image remote loader for a third-party CDN; edge caching of menu JSON; hreflang/dir/lang setup; schema.org Restaurant/Menu markup; and Core Web Vitals budgets (LCP/INP/CLS) with Lighthouse-CI enforcement.

**10) حزمة TypeScript مشتركة بلا تسريب RN-web**
> Architect a shared TS package consumed by BOTH an Expo/RN-web app and a Next.js DOM web app without leaking react-native-web/reanimated into the web bundle: what belongs in shared (types, tokens, locales, pure logic like categoryKind/formatting) vs platform-specific, decoupling from an app-only seed.ts, path-alias/workspace setup, avoiding import cycles, and keeping a large generated menu module out of the initial web bundle.

**11) تبديل RTL/LTR وقت التشغيل في Expo**
> Reliable RTL/LTR runtime language switching in Expo SDK 56 (I18nManager + Expo Router) shared with a Next.js web app: when a reload is required, avoiding mixed-direction layouts, and keeping Intl digit/number/date formatting (Arabic-Indic vs Latin) consistent between Hermes (with/without full ICU) and web ICU.

**12) رصد وموثوقية ما قبل الإطلاق لتطبيق يتعامل مع المال**
> Pre-launch reliability setup for a money-handling Expo app: Sentry/Crashlytics for RN + Expo web, wiring componentDidCatch and TanStack Query QueryCache/MutationCache onError, checkout success/failure analytics, and a CI gate (tsc + ESLint + Jest) that blocks merge — with a first test suite targeting pure money/points/tier/combo/promo functions.
