# افتتاح التطبيق: الشعار في الوسط وأصنافنا تتطاير — بـHiggsfield

**التاريخ:** 2026-10-16
**كتبه:** محرّر واحد جمع ثلاثة موجزات مستقلة: باحث Higgsfield، ومصمّم الحركة، وكاتب البرومبتات. وراجع المحرّر بنفسه أرقام الأصناف وصورها في بيانات المنيو، وأيقونة التطبيق، وملفات المستودع المذكورة هنا.
**الجمهور:** المالك أولاً (البرومبت الرئيسي في القسم 4.1)، ثم وكيل البرمجة (القسم 6).
**خريطة القراءة:** المالك: الأقسام 0 و3 و4 و7. المنفّذ: الأقسام 2 و6 ثم 5.
**طلب المالك اليوم:** «افتتاح تطبيق اوبن سوق بكون الشعار بالوسط والاصناف تكون متطايرة او الخدمات. اقترحلي نعمل اشي باستخدام هكسفيلد لاصنافنا. اعطيني برومبت خبير».

> **قبل أي تنفيذ:** [`almond-app/DESIGN.md`](../../almond-app/DESIGN.md) يقول اليوم «This direction adds no motion» و«Don't add decorative artwork… or new entrance motion». ويقول أيضاً «White photograph grounds are part of the owned imagery» و«Menu photo planes stay square-edged»، والافتتاح يخالف هذا أيضاً: يقصّ الأصناف من أرضيتها البيضاء ويميلها بين ±12° و±25°. فالاستثناء المطلوب استثناءان: الحركة، **والصور المقصوصة المائلة بلا أرضيتها البيضاء**. هذا الدليل **لا يغيّر شيئاً في التطبيق**. هو اقتراح، ويحتاج قرارك في القسم 7 قبل أن يلمس أحد الكود.

**وسوم التحقّق في هذا الملف:** **[رسمي]** من صفحات Higgsfield أو مستنداته · **[طرف ثالث]** من مراجعة أو دليل خارجي · **[غير متحقَّق]** لا مصدر له أو لم نستطع فتح المصدر · **[متعارض]** مصدران رسميان أو أكثر يختلفان · **[حساب منّا]** رقم حسبناه أو قسناه نحن.

---

## 0. الخلاصة

- **الفكرة:** نفس إيقاع افتتاح السوق المفتوح، لكن بأصنافنا الحقيقية: الأصناف تنطلق من خلف شعارنا الثنائي في الوسط، تتوزّع حوله، ثم تطير خارج الشاشة، ويبقى الشعار لحظة قبل الرئيسية. المدة **2.4 ث**، أي داخل الـ2.5 ث التي ينتظرها التطبيق اليوم بلا سبب.
- **داخل التطبيق:** حركة حيّة بـReanimated (مثبّتة) من صور مقصوصة لأصنافنا. **لا نضع فيديو Higgsfield داخل التطبيق:** يحتاج حزمة جديدة، ويكسر الوضع الداكن، ويثقل التحميل.
- **Higgsfield:** يولّد **حركة الأصناف وحدها** بين لقطتين نركّبهما نحن من صورنا. **الشعار الحقيقي يُوضع فوق الفيديو في المونتاج**، لأن نماذج الفيديو تشوّه الشعار والحرف العربي. الناتج لريلز العلامة والستوريز وشاشات الفروع، ولنرى الحركة قبل برمجتها. **لا يُعرض على أنه افتتاح التطبيق:** أي إعلان عن التطبيق يستعمل تسجيل شاشة للافتتاح الحقيقي (القسم 4.3).
- **البرومبت الرئيسي:** القسم **4.1** (Prompt A، على Kling 3.0 بلقطة بداية ولقطة نهاية).
- **متى يظهر في التطبيق:** ليس عند كل زيارة للكاشير. «اجمع نقاطك» تفتح وحدها عند الإطلاق لأن العضو غالباً واقف على الكاشير، فالافتتاح **لا يسبقها أبداً**. يظهر كاملاً عند أول تثبيت، وللضيف، ومرة مع كل موسم أو تغيير منيو أو تحديث للتطبيق (القسم 6).
- **قراراتك:** فتح بند «بلا حركة» للافتتاح وحده، وكم مرة يظهر، ومن يقصّ الصور، وخطة Higgsfield وترخيصه، وملف الشعار الثنائي. التفاصيل في القسم 7.

> **جرّبه اليوم في 10 دقائق (اختبار إحساس فقط، لا للنشر):**
> 1. في Higgsfield اختر فيديو، ثم **Kling 3.0**، وارفع **الصورة 2** (المخبوزات على الأبيض) **لقطة بداية فقط**، بلا لقطة نهاية. (Turbo يكفي هنا لأنه لا لقطة نهاية، ودليل Higgsfield ينصح به للمسوّدات **[رسمي]**.)
> 2. الصق البرومبت التالي كما هو. الإعدادات: 5 ث، 720p، 9:16 إن عرضتها الواجهة، **الصوت مطفأ**.
> 3. نزّل المقطع، وفي CapCut اختر **Reverse** (عكس). الانجذاب نحو المركز يصير انطلاقاً منه.
>
> **لماذا لا يُنشر:** أصناف الصورة 2 غالباً «ميني بايتس» ولم نتحقّق منها (القسم 3.1)، وفيها ظلال على الأرض، ولا منطقة فارغة للشعار. الهدف أن ترى الإحساس قبل أن تدفع وقت المصمّم. البناء الحقيقي يبدأ من القسم 3.
>
> ```text
> Vertical 9:16 product motion plate on a seamless pure white background (#FFFFFF), bright even high-key studio light. Locked-off camera: no zoom, no pan, no shake.
>
> Motion: one continuous radial implosion, no cut. Every product travels in a straight line from its position in the start frame toward the exact centre of the frame: almost still at first, then faster and faster (strong ease-in), shrinking as it goes, as if the whole arrangement is drawn into a single point behind the centre. Products nearer the edges travel faster. Each product turns by no more than 20 degrees on the way. Directional motion blur only in the last third of the clip, along each product's line of travel.
>
> HARD RULES (Almond Coffee House):
> - Use only the products in the uploaded frame(s). Do not add, remove, duplicate, merge or redesign any product.
> - Keep every product photographically identical to its reference: same shape, colour, crust, layers, toppings, fruit count, cream swirl, glass and cup.
> - Do not create any new text, letters, numbers, logos, stickers or watermarks. Graphics already printed on the cups stay exactly as they are, sharp and still on the cup surface.
> - Pure white seamless background (#FFFFFF), flat and even: no floor line, no table, no props, no gradient, no vignette.
> - No hands, no people, no crumbs, no spills, no smoke or particles unless asked for above.
> - Camera locked unless a move is asked for above. Photoreal studio product photography, true-to-life colour, no cartoon look. Silent.
> ```

---

## 1. ماذا يفعل افتتاح السوق المفتوح

قسناه من تسجيلك (5.04 ث، `1080×2340`). القياس الدقيق من فرق الحركة بين كل إطارين (366 إطاراً، حوالي 30 إطاراً في الثانية) **[حساب منّا]**، وورقة لقطات بـ6 إطارات في الثانية تتفق معه في حدود 0.2 ث (ورقة مؤقتة من جلسة 2026-10-16، لم تُحفظ في الريبو لأنها تسجيل شاشة لتطبيق منافس من هاتف المالك).

| الزمن | ماذا يحدث |
|---|---|
| 0 – 0.98 ث | شاشة النظام **بيضاء فارغة، بلا شعار** |
| 0.98 ث | تبدأ الدفعة: حوالي 12 منتجاً مقصوصاً (سمّاعة، سيارة، حقيبة، عطر، نبتة، حذاء، يد ألعاب، خلّاط، هاتف، دمبل) ومعها أيقونات صغيرة (عملات، فقاعات محادثة، ظرف) وملصقان «بيع أي شي» و«Sell Anything!». اللوحة كلها **مع الشعار** تكبر من نقطة في المركز بغباش حركة شعاعي |
| 1.15 – 1.21 ث | ذروة السرعة |
| 1.2 – 2.0 ث | تباطؤ ناعم حول الشعار الثنائي. **الأصناف لا تقف أبداً**، و«الثبات» الذي تراه آخر التباطؤ |
| 2.0 – 3.15 ث | تسارع نحو الخارج (الذروة عند 2.84 ث)، والأصناف تخرج من حواف الشاشة بغباش |
| 3.17 – 3.94 ث | الشعار وحده على الأبيض، 0.77 ث |
| 3.95 ث | انزلاق إلى هيكل الرئيسية |

الافتتاح نفسه حوالي 2.8 ث من بداية الدفعة إلى نهاية الخروج، وحوالي 3 ث مع لحظة الشعار.

**ما نأخذه:**
1. شاشة النظام لون سادة بلا شعار، والشعار يدخل مع الدفعة. هكذا لا يحدث وميض.
2. الحركة نحو الخارج متّصلة: انطلاق، تباطؤ، تسارع. **لا شيء يرجع نحو المركز.**
3. لوحة كثيفة تخرج عن حواف الشاشة، فتعطي إحساس الوفرة والعمق.
4. لحظة قصيرة للشعار وحده قبل الرئيسية.

**ما لا نأخذه:**
- **الملصقات والنصوص.** لا أحد يقرأ نصاً في ثانيتين، وأبل تنصح بعدم وضع نص في شاشة الإطلاق ([Apple HIG، Launching](https://developer.apple.com/design/human-interface-guidelines/launching)).
- **الأيقونات العامة** (عملات، فقاعات). عندنا بديل من هويتنا نفسها (القسم 2).
- **أي «خدمة» أو صنف ليس عندنا.** السوق المفتوح يعرض فئات عامة؛ نحن نعرض أصنافاً من المنيو الحالي فقط، بصورها الحقيقية.
- **فيديو السوق المفتوح كمرجع حركة.** لا نرفعه إلى Higgsfield (أداة نقل الحركة من فيديو مرجعي موجودة، لكن الشروط تحمّلنا تصفية الحقوق، §4.2(c) و§12 في [شروط Higgsfield](https://higgsfield.ai/terms-of-use-agreement)). نأخذ الفكرة فقط. ملاحظة: إطاراتهم تبدو تركيب صور مقصوصة لا توليداً **[غير متحقَّق]**.
- **المدة والانزلاق.** نضغطها إلى 2.4 ث، والتسليم تلاشٍ لا انزلاق (الانزلاق يحتاج عكساً في العربي، والرئيسية ليست شاشة مدفوعة).

---

## 2. فكرة افتتاح ألموند: «من قلب الشعار»

### المركز
الشعار الثنائي الرسمي كما في بوست الخريف: «آلموند كوفي هاوس.» ثم المربع برسوماته الأربع ثم «ALMOND COFFEE HOUSE.». هو ثنائي اللغة مثل شعار السوق المفتوح، فيصلح للغتين بلا تبديل. **نحتاجه ملفاً متجهياً من ملفات الهوية** بنسختين: أسود للفاتح وأبيض للداكن. المكوّن الموجود اليوم في التطبيق (`Logo`) يعرض المربع والإنجليزي فقط.

### الأصناف (حقيقية، من المنيو الحالي)
راجعنا كل رقم في [`packages/shared/src/menu/menu.generated.ts`](../../packages/shared/src/menu/menu.generated.ts) (سُحب من Odoo في `2026-09-25`) ونظرنا إلى صورة كل صنف في `almond-web/public/menu/`.

| الطبقة | الصنف | الرقم | آمن على الداكن؟ |
|---|---|---|---|
| أمامية (كبيرة، تقصّها الحافة) | كرواسون سادة | `p-10144` | نعم |
| أمامية | دانش فراولة | `p-10238` | نعم |
| أمامية | تارت الفراولة | `p-10237` | بعد إزالة اللوح والظل |
| وسطى | ايس سبانيش لاتيه (كوب الرسومات) | `p-10357` | يحتاج فحصاً |
| وسطى | ماتشا لاتيه مثلج (كوب الرسومات) | `p-10383` | يحتاج فحصاً |
| وسطى | كرواسون باللوز | `p-10245` | نعم |
| وسطى | قطعة كيكة سان سيباستيان | `p-10231` | بعد إزالة اللوح والظل |
| وسطى | كلاسيك ايكلير | `p-10240` | نعم |
| وسطى | قطع كيك الجزر | `p-10251` | بعد إزالة اللوح والظل |
| وسطى (الفاتح فقط) | لاتيه ساخن (كوب زجاج عليه الشعار مكتوباً) | `p-10338` | **لا**، إلا بعد قصّ احترافي |

**«الخدمات»:** نقترح رسومات المربع الأربع نفسها: الكوب بحبة القهوة، والكرواسون، والنوتة، والكتاب. تخرج مع الأصناف خطوطاً سوداء صغيرة (بيضاء في الداكن)، بدور العملات والفقاعات عند السوق المفتوح. هي حرفياً ما يعد به شعارنا: قهوة، ومخبوزات، وموسيقى، وقراءة. وليست رسماً جديداً، لكن `DESIGN.md` يمنع «decorative artwork»، فالقرار لك (القسم 7، البند 4). **لا ننصح** بأيقونات ميزات التطبيق (الباركود، النقاط): تحتاج شرحاً لا يتّسع له الافتتاح، ولون المكافأة محجوز لقيمة النقاط فقط.

### الستوري بورد (2.4 ث، داخل الـ2.5 ث الحالية)

| المقطع | الزمن | الوضع الفاتح | الوضع الداكن | التسهيل والحركة |
|---|---|---|---|---|
| 0. مطابقة | 0 – 100 ms | ورق `#FFFFFF` فارغ يطابق شاشة النظام. الصور تُحمَّل خفية | `#0F0F0F` فارغ | — |
| 1. الدفعة | 100 – 800 ms | 10 أصناف و4 رسومات تنطلق من خلف الشعار إلى أماكنها. الشعار يظهر خلال 150 ms ويكبر `0.85 → 1.0` | نفس الحركة، بلا كوب الزجاج، والشعار والرسومات بالأبيض | المسار نحو الخارج فقط بلا ارتداد: `cubic-bezier(0.16, 1, 0.3, 1)`. الحجم وحده يتجاوز قليلاً ثم يستقر (حتى `1.06` للصنف و`1.03` للشعار). دوران ابتدائي ±25° يستقر على ميل بين −12° و+12°. فرق انطلاق 0 – 40 ms بين الأصناف |
| 2. تنفّس | 800 – 1050 ms | اللوحة كاملة لكنها لا تقف: انجراف 3% للخارج ودوران ±2° | مثله | خطّي بطيء. القريب ينجرف أكثر من البعيد |
| 3. الخروج | 1050 – 1700 ms | تتسارع للخارج وتخرج من أقرب حافة، القريب أولاً، وتكبر `1.0 → 1.2`. **كل صنف يقطع مسافة خروج خاصة به** تُخرجه كاملاً من الشاشة عند 1700 ms (لا مضاعف واحد للكل)، وتنخفض شفافيته إلى 0 في آخر 80 ms احتياطاً | مثله | `cubic-bezier(0.55, 0, 1, 0.45)` |
| 4. الشعار وحده | 1700 – 2100 ms | الشعار الثنائي على الأبيض | على `#0F0F0F` | ثابت |
| 5. التسليم | 2100 – 2400 ms | تختفي الطبقة فتظهر الرئيسية جاهزة تحتها | مثله | تلاشٍ 300 ms مع تصغير `1 → 0.98` |

**تفاصيل:**
- **غباش الحركة:** مطّ خفيف للصنف على اتجاه حركته **حتى `1.08` فقط**، ولا يبدأ إلا فوق عتبة سرعة (تحتها المطّ `1.0` تماماً). المطّ الأكبر يجعل الكرواسون المصوَّر مطاطياً كرتونياً، وهذا تشويه للأكل لا غباش. إن احتجنا غباشاً أقوى: 2 – 3 نسخ شبحية خلف الصنف بشفافية 0.15 – 0.3، أو تبديل ناعم إلى نسخة مغبّشة مسبقاً من نفس الصورة عند ذروة السرعة.
- **منطقة الشعار:** حدود الشعار مع هامش 24 نقطة، ولا يدخلها صنف أبداً.
- **الحواف:** الأصناف الأمامية يُسمح لها بالخروج عن حافة الشاشة حتى 35% من حجمها.
- **تقليل الحركة:** الشعار يظهر بالتلاشي فقط، 800 ms أو أقل إجمالاً.
- **بلا صوت.** ولا يُستعمل لون المكافأة في الافتتاح إطلاقاً.

**نسخة الفيديو (للسوشال):** نفس الإيقاعات بالضبط، مركّبة من مقاطع Higgsfield في المونتاج (القسم 4.3). نسخة الفيديو بيضاء فقط؛ الوضع الداكن يخصّ التطبيق.

**مشكلة القص على الداكن، قاسها مصمّم الحركة:** قصّ ثلاث صور قصّاً آلياً ووضعها على `#0F0F0F`. الكرواسون ممتاز، وكوب اللاتيه الزجاجي يُظهر بياض الاستوديو من خلال الزجاج، والتارت يُظهر لوحه وظلّه بقعة بيضاء. (لقطة مؤقتة من الجلسة، لم تُحفظ.) النتيجة: القصّ يحتاج يد مصمّم، والداكن يستعمل الأصناف الآمنة فقط.

---

## 3. تجهيز الصور (أهم خطوة، وتسبق أي توليد)

**القاعدة:** لا نطلب من أي نموذج أن يرتّب لنا الأصناف أو يكبّر صورها. نقصّ ونرتّب بأيدينا في Figma أو Photoshop أو Canva، والنموذج يحرّك فقط.

### 3.1 مصادر الصور
- [ ] **الأفضل: الملفات الأصلية من المصوّر أو التسويق.** شبكة صورك (الصورة 1) مجمّعة من لقطات منفردة؛ كل مربع فيها حوالي 310 بكسل فقط.
- [ ] **البديل:** صور المنيو `almond-web/public/menu/p-*.webp` (مقاس `512` **[حساب منّا]**)، أو `almond-app/assets/menu/*.jpg` حيث يوجد الصنف (مقاس `1000×1000`، مثل `plain-croissant.jpg` و`strawberry-tart.jpg`).
- [ ] **لا نستعمل** صوراً في `assets/menu/` لأصناف ليست في المنيو الحالي. مثلاً `cinnamon-crunch-iced.jpg` و`cinnamon-white-mocha-frappe01.jpg` و`hot-drink-with-gingerbread.jpg`: لا صنف بهذه الأسماء في بيانات المنيو اليوم («Cinnamon» و«Gingerbread» فيها خيارات إضافة لا أصناف) **[حساب منّا]**.
- [ ] **الصورة 2 (المخبوزات على الأبيض)** تطابق مجموعة **«ميني بايتس»** (`cat-17`: ميني كرواسان عادي وباللوز وزعتر، ميني مانجو دانش وفراولة دانش، ميني تارت بلوبيري وفستق وشوكولا ومانجو وفراولة، ميني مفن، ميني كرنكل كوكي وشوكلت شيب…). هذا **استنتاج منّا من الأشكال** **[غير متحقَّق]**؛ إن صحّ فهي أصناف حقيقية، لكن نسمّيها بأسمائها «ميني» ولا نعرضها كأحجام كاملة.
- [ ] **لا تكبّر الصور بأدوات Enhance التوليدية:** تعيد رسم التفاصيل فيتغيّر المنتج.
- [ ] **يوم النشر:** تأكّد أن كل صنف ما زال في المنيو (`npm run menu:pull`)، خاصة الموسمي.

### 3.2 قواعد القصّ
- [ ] المنتج وحده إلى PNG شفاف (للتطبيق: WebP شفاف). العلامة المائية في الزاوية العليا اليسرى تختفي تلقائياً لأنها لا تلمس المنتج.
- [ ] **رسومات أكواب ألموند جزء من المنتج، فلا تمسحها.**
- [ ] احذف ظلّ الملامسة تحت كل صنف طائر، وأزل لوح الكرتون تحت الكيك والتارت إن أمكن بنظافة (اللوح الطائر يبدو صينية).
- [ ] حواف ناعمة 1 – 2 بكسل، بلا تغيير ألوان، مساحة sRGB.
- [ ] **للداكن:** أعد قصّ الزجاج يدوياً أو أسقط الكوب الزجاجي، وافحص كل صنف على `#0F0F0F`.
- [ ] **للتطبيق:** ثلاثة أضعاف حجم العرض، 40 KB أو أقل للملف، 400 KB أو أقل للمجموع (قصّة تجريبية بعرض 420 بكسل خرجت 10 – 21 KB **[حساب منّا]**).

### 3.3 لقطة النهاية `END.png` (`1080×1920`، أبيض `#FFFFFF` صافٍ)
- [ ] **منطقة الشعار فارغة:** مستطيل حوالي `860×400` في المنتصف (من x=110 إلى 970، ومن y=760 إلى 1160). هنا يجلس الشعار الثنائي لاحقاً بعرض حوالي 760 بكسل.
- [ ] **9 أصناف فقط للفيديو** (الجدول في القسم 2 بلا كوب الزجاج). النماذج تخلط الأصناف كلما زاد العدد؛ ابدأ بـ9 ونزّل إلى 6 – 8 إن اندمجت.
- [ ] **ثلاث طبقات:** أمامية 3 أصناف بين 420 و520 بكسل، **تقصّها حافة الإطار** للعمق · وسطى 6 أصناف بين 280 و360 بكسل · ويمكن تصغير كوبَي الرسومات إن تشوّهت رسوماتهما.
- [ ] **المسافة بين أي صنفين 48 بكسل على الأقل.** الدوران ±20°، ولا تقلب أي صورة.
- [ ] **الترتيب على عقارب الساعة حول الشعار:** 11 كرواسون سادة (أمامي، الحافة اليسرى) · 12 ماتشا لاتيه مثلج · 1 كرواسون باللوز · 2 – 3 ايس سبانيش لاتيه (الحافة اليمنى) · 4 قطعة سان سيباستيان · 5 كيك الجزر · 6 تارت الفراولة (أمامي، الحافة السفلى) · 7 ايكلير · 8 – 9 دانش فراولة (أمامي، الحافة اليسرى) · 10 فراغ أو صنف صغير.
- [ ] **نسختان من `END.png`:** الترتيب أعلاه للستوري وشاشات الفروع (التارت تقصّه الحافة السفلى). **وللريلز نسخة ثانية `END_reels.png`** تبقى فيها آخر 360 بكسل في الأسفل فارغة (أزرار التطبيق تغطّيها): التارت يرتفع إلى الساعة 5 فوق y=1560 وتقصّه الحافة اليمنى، وكيك الجزر ينزل إلى الساعة 6 فوق y=1560. لكل نسخة `START` خاصة بها (القسم 3.4).

### 3.4 لقطة البداية `START.png`
- [ ] انسخ `END.png` نفسه، وحرّك كل صنف نحو المنتصف إلى كتلة حوالي `600×700` خلف منطقة الشعار، وصغّره إلى 40 – 50%.
- [ ] نفس الدوران ونفس ترتيب الطبقات، وتداخل 15% أو أقل. **لا تُضف ولا تحذف صنفاً.** هكذا يبقى النموذج محصوراً في التحريك والتكبير.

### 3.5 لقطة فارغة `EMPTY.png`
- [ ] `1080×1920` أبيض صافٍ بالكامل، لبرومبت الخروج.

### 3.6 للمونتاج
- [ ] الشعار الثنائي المتجهي (القسم 2).
- [ ] الرسومات الأربع SVG من ملفات الهوية، إن وافقت عليها.
- [ ] موسيقى مرخّصة للريل (لا نستعمل صوت النموذج).

---

## 4. البرومبتات

**كيف تستعمل كل برومبت:** في Higgsfield اختر الفيديو، ثم النموذج، ثم ارفع لقطة البداية ولقطة النهاية، والصق البرومبت كما هو، واضبط الإعدادات تحت كل برومبت. أسماء الحقول في واجهة الموقع قد تختلف عن المستندات **[غير متحقَّق]**. **لم نجد حقل Negative ولا Seed موثّقاً** لهذه النماذج في مستندات Higgsfield ([Kling 3.0 Pro](https://docs.higgsfield.ai/docs/models/kling-3/pro-image-to-video)، [Seedance 2.5](https://docs.higgsfield.ai/docs/models/seedance-2-5/image-to-video)) **[رسمي]**، فوضعنا القيود داخل نص البرومبت. كل برومبت هنا أقل من 2500 حرف، وهو حدّ Kling 3.0 في مستندات الـAPI (اسمه هناك «Kling 3.0 Pro») **[رسمي]**.

### 4.1 البرومبت الرئيسي — Prompt A: الدفعة للخارج ثم الانجراف

**المدخلات:** `START.png` لقطة بداية، و`END.png` لقطة نهاية.

```text
Vertical 9:16 product motion plate for a café app opening. Seamless pure white background (#FFFFFF), flat and even, bright high-key studio light, soft light from the upper left. Locked-off camera on a tripod: no zoom, no pan, no tilt, no shake.

Start frame: the café products, small, in a tight cluster at the centre. End frame: the same products at full size, spread around the edges of the frame.

Motion: one continuous radial burst, no cut. Every product shoots out from the centre in a straight line to its own place in the end frame, growing to its final size as if flying toward the camera. Fast launch, then a long smooth ease-out. Nothing ever moves back toward the centre and nothing bounces. Products nearer the edges travel faster than those nearer the centre. Directional motion blur only during the fastest part, along each product's line of travel; crisp and sharp once it slows. For the rest of the clip every product keeps drifting outward very slowly, a few pixels, turning by no more than 5 degrees.

Fidelity: every product is a rigid, separate, solid object, like a real product photograph moving on invisible wires. Each keeps exactly the shape, colour, crust, layers, glaze, fruit and toppings shown in the frames. The black line-drawing doodles printed on the clear cups move rigidly with the cup like a decal and stay sharp. Use only the products in the frames: nothing added, removed, duplicated, merged or redesigned. After the first instant, products never touch, overlap or pass through each other.

Composition: a wide horizontal band across the middle of the frame becomes and stays completely empty pure white; a logo is added there later in editing. The background stays pure white for the whole clip: no floor line, no table, no plate, no gradient, no vignette, no cast shadows.

Do not create any text, letters, numbers, logos, stickers or watermarks. No hands, no people, no crumbs, no particles, no smoke, no confetti. Photoreal, true-to-life colour, premium bakery advertising look; no cartoon, no CGI look. Silent.
```

**مربع الكاميرا** (إن عرضته الواجهة منفصلاً):
```text
Static locked-off camera. No camera motion of any kind.
```

**Negative** (فقط إن ظهر الحقل في الواجهة):
```text
added text, captions, subtitles, floating letters, watermark, new logo, extra objects, extra food items, duplicated items, new ingredients, new garnish, crumbs, particles, confetti, sparkles, smoke, steam, splashes, hands, people, table, floor, plate, tray, surface, cast shadows, reflections, grey background, cream background, gradient background, vignette, colour shift, morphing, melting, warping, shape-shifting, items merging, blurry products, flicker, camera movement, zoom, depth of field blur, low resolution, cartoon, illustration, CGI look
```
لم نكتب «text» أو «logo» وحدهما عن قصد: قد يمسح النموذج رسومات الأكواب. الممنوع هو النص **المُضاف** والشعار **الجديد**.

**الإعدادات:**

| الإعداد | القيمة |
|---|---|
| الوضع | صورة إلى فيديو، لقطة بداية + لقطة نهاية |
| النموذج | في الموقع اختر **Kling 3.0** (بلا «Pro» في القائمة)، وارفع Start Frame وEnd Frame ([مركز المساعدة](https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-kling) **[رسمي]**). البديل Seedance 2.5 مع صورة نهاية (القسم 5). «Kling O3 First-Last Frame» اسم في مستندات الـAPI فقط؛ ظهوره في الموقع، وهل هو نفسه «Kling 3.0 Omni»، **[غير متحقَّق]**. **لا تستعمل Kling 3.0 Turbo للنهائي:** بلا لقطة نهاية **[رسمي]**، ومركز المساعدة يقول «use Turbo for drafts, Kling 3.0 for finals» |
| النسبة | 9:16. في Seedance ارفع صورة `1080×1920` لأن النسبة تتبع الصورة **[رسمي]** |
| المدة | 5 ث. الدفعة تأخذ النصف الأول تقريباً، ونسرّعها في المونتاج إلى 0.7 ث، أي حوالي 3.6 مرة. **التسريع يحذف إطارات ولا يضيف غباشاً**، فالجزء المسرَّع يتقطّع ما لم تفعّل مزج الإطارات وتضيف غباشاً اتجاهياً في المونتاج (القسم 4.3) |
| الدقة | 720p للتجارب، ثم أعد التوليد بالدقة التي تحتاجها: «Draft at 720p… then rerun the final version at the resolution you need» ([دليل Higgsfield لـKling](https://higgsfield.ai/blog/Kling-3.0-is-on-Higgsfield-User-Guide-AI-Video-Generation) **[رسمي]**). **توصيتنا 1080p للنهائي، ولا 4K:** ملف ثقيل بلا فرق على الهاتف |
| الصوت | **مطفأ** (شغّال افتراضياً في Kling 3.0 وSeedance 2.5 **[رسمي]**) |
| cfg_scale (إن ظهر) | 0.6 – 0.7 ليلتزم أكثر بالبرومبت. الافتراضي 0.5 والمدى 0 – 1 في الـAPI **[رسمي]**؛ ظهوره في الواجهة **[غير متحقَّق]** |
| النسخ | 4 نسخ لكل محاولة، واختر الأفضل. وإن ظهر حقل Seed فثبّته عند أول نسخة جيدة |

#### تنويعات Prompt A (استبدل فقرة Motion وحدها)

**A2 — طفو هادئ** (للنسخة الهادئة أو خلفية شاشة الفرع)، المدة 5 ث وتُستعمل كما هي تقريباً:
```text
Motion: the cluster at the centre gently opens like a slow breath. The products float outward slowly and weightlessly, as if in zero gravity, each drifting along a soft curved path to its place in the end frame, turning lazily by less than 10 degrees, with no motion blur. Once in place they keep drifting outward by a few pixels, out of sync with each other, calm and elegant. Nothing moves back toward the centre.
```

**A3 — انفجار سريع**، المدة 3 ث (أقل مدة في Kling):
```text
Motion: an explosive pop in the first fraction of a second. All products shoot radially outward from the centre at high speed with strong radial motion blur, then brake hard into their places in the end frame with no bounce, and hold almost still, drifting outward by a pixel or two. Nothing moves back toward the centre.
```

**A4 — بالعكس** (إن تشوّهت الأصناف في الدفعة): ارفع `END.png` لقطة **بداية** و`START.png` لقطة **نهاية**، واستبدل فقرة Motion بهذه، ثم **اعكس المقطع في المونتاج**. الفكرة أن النموذج يبدأ من الإطار الأغنى بالتفاصيل الحقيقية. هذه تقنية عامة عند المحرّرين، **وليست خاصية موثّقة في Higgsfield** **[غير متحقَّق]**:
```text
Motion: one continuous radial implosion, no cut. Every product travels in a straight line from its position in the start frame toward the exact centre of the frame: almost still at first, then faster and faster (strong ease-in), shrinking as it goes, as if the whole arrangement is drawn into a single point behind the centre. Products nearer the edges travel faster. Each product turns by no more than 20 degrees on the way. Directional motion blur only in the last third of the clip, along each product's line of travel.
```

### 4.2 Prompt B: الخروج

**المدخلات:** **آخر إطار فعلي من مقطع A المختار** لقطة بداية (صدّره من المونتاج صورةً `1080×1920`)، و`EMPTY.png` لقطة نهاية. لا ترفع `END.png` هنا: النموذج يقترب من لقطة النهاية لكنه لا يطابقها بكسلاً ببكسل، فيظهر قفز صغير في الموضع أو الحجم أو تفاصيل القشرة عند الوصل. بآخر إطار من A يكون الوصل **بأقل أثر**، ومع ذلك امزج 2 – 3 إطارات عند الوصل (Cross Dissolve). الصق «القواعد الثابتة» تحته.

```text
Vertical 9:16 product motion plate on a seamless pure white background (#FFFFFF), bright even high-key studio light. Locked-off camera: no zoom, no pan, no shake.

Start frame: café products arranged around the edges, the middle band empty. End frame: the same white background with no products at all.

Motion: one continuous radial exit, no cut. The products hold almost still for a brief moment, then accelerate hard away from the centre in straight lines (strong ease-in) and leave the frame completely through the nearest edge, growing by up to 20% as if moving toward the camera. The products nearest the edges leave first, the inner ring last, in a quick staggered wave. Motion blur grows with speed, along each product's direction of travel. Nothing moves toward the centre. No product fades, shrinks, dissolves or disappears inside the frame; each one is seen crossing the edge. Each turns by no more than 10 degrees. The clip ends on a clean, empty white frame. The middle band stays empty white throughout.
```

**القواعد الثابتة** (تُلصق في آخر B وC وD):
```text
HARD RULES (Almond Coffee House):
- Use only the products in the uploaded frame(s). Do not add, remove, duplicate, merge or redesign any product.
- Keep every product photographically identical to its reference: same shape, colour, crust, layers, toppings, fruit count, cream swirl, glass and cup.
- Do not create any new text, letters, numbers, logos, stickers or watermarks. Graphics already printed on the cups stay exactly as they are, sharp and still on the cup surface.
- Pure white seamless background (#FFFFFF), flat and even: no floor line, no table, no props, no gradient, no vignette.
- No hands, no people, no crumbs, no spills, no smoke or particles unless asked for above.
- Camera locked unless a move is asked for above. Photoreal studio product photography, true-to-life colour, no cartoon look. Silent.
```

**الإعدادات:** مثل A، والمدة 3 ث، وتُسرَّع في المونتاج إلى 0.65 ث.

**B2 — الأصناف تعبر قرب الكاميرا** (استبدل فقرة Motion):
```text
Motion: the products rush toward the camera and outward at the same time, growing quickly as they pass the edges of the frame, as if the viewer flies through them. Each one exits fully through the nearest edge; none fade inside the frame.
```

### 4.3 تركيب الافتتاحية في المونتاج (CapCut أو Premiere)

| الزمن | المصدر |
|---|---|
| 0 – 0.1 ث | أبيض `#FFFFFF` |
| 0.1 – 0.8 ث | النصف الأول من A مسرَّعاً (Speed Ramp: سريع ثم يبطئ) |
| 0.8 – 1.05 ث | بقية A، الأصناف تنجرف |
| 1.05 – 1.7 ث | B مسرَّعاً |
| 1.7 – 2.1 ث | الشعار وحده على الأبيض |
| 2.1 – 2.4 ث | تلاشٍ |

- **هذا التركيب للعلامة لا لإعلان التطبيق:** يصلح لريلز العلامة والستوريز وشاشات الفروع، ما دام لا يقول «هكذا يفتح التطبيق». **أي إعلان عن التطبيق** (تنزيل، ميزة، معاينة متجر) يكون مقطع الافتتاح فيه **تسجيل شاشة للافتتاح الحقيقي داخل التطبيق**، لأن غباش النموذج وانجراف الأصناف الصغير ليسا ما يعرضه التطبيق فعلاً، وهذا وعد صغير لا نفي به.
- **تسريع بلا تقطّع:** على الجزأين المسرَّعين (0.1 – 0.8 ث و1.05 – 1.7 ث) فعّل مزج الإطارات: في Premiere من **Time Interpolation** اختر **Frame Blending** أو **Optical Flow**؛ وخيار مكافئ للتسريع في CapCut **[غير متحقَّق]**. ثم أضف تأثير **Directional / Motion Blur** على الجزء نفسه في CapCut أو Premiere. شاهد النتيجة إطاراً إطاراً قبل التصدير.
- **الشعار الحقيقي** طبقة فوق كل ما سبق، في المنتصف بعرض حوالي 760 بكسل، يظهر خلال 0.15 ث ويكبر `0.85 → 1.0`.
- **الرسومات الأربع** (إن وافقت) طبقات SVG تخرج مع الأصناف في المونتاج، **لا تُولَّد بالنموذج**.
- **التصدير:** `1080×1920`، 30 إطاراً في الثانية، H.264، بلا صوت للافتتاح؛ والموسيقى المرخّصة تُضاف للريل.
- **نسخة 4:5 للمنشور:** قصّ `1080×1350` من المنتصف (Kling وVeo بلا خيار 4:5 **[رسمي]**).

### 4.4 Prompt C: ريل الأصناف الخريفية

**الأصناف الخريفية الحقيقية:** شبكة صورك الـ16 تطابق هذه الأصناف في المنيو، وطابقناها صورة بصورة **[حساب منّا]**:

| في الشبكة | الصنف | الرقم |
|---|---|---|
| الصف 1 | قطعة بريوش التفاح (شكلها كالمافن في ورق التوليب، لكن اسمها **بريوش التفاح**) · سلطة التفاح والفيتا · قطعة لينزار التفاح · صورة جماعية لمشروبات | `p-12160` · `p-12134` · `p-12138` |
| الصف 2 | بانوفي فرابيه · قطعة كرنشي تشوكلت · قطعة تين كيك · سلطة التين والجوز الخريفية | `p-12188` · `p-12143` · `p-12150` · `p-12131` |
| الصف 3 | ماكاديميا لاتيه مثلّج · بمكن باي لاتيه مثلّج · ماكاديميا لاتيه ساخن · قطعة تارت الفول السوداني | `p-12184` · `p-12187` · `p-12182` · `p-12157` |
| الصف 4 | باف بيستري الأجاص واللوز · دنش القرع · بمكن باي لاتيه ساخن · سلطة الكينوا والشمندر | `p-12158` · `p-12154` · `p-12185` · `p-12129` |

**التجهيز:**
- [ ] لا تستعمل بوست الخريف (الصورة 3) كما هو: أصنافه في الأسفل مقصوصة بالحافة، ونسبته 4:5.
- [ ] قصّ الأصناف ورتّبها بروح البوست نفسه (تقارب وتداخل خفيف مسموح، لأنها لن تتحرّك بالنسبة لبعضها) على `1080×1920` أبيض: الأصناف بين y=640 وy=1560، ومنطقة العنوان فارغة من y=200 إلى y=600، وآخر 360 بكسل فارغة.
- [ ] **العنوان يُكتب في المونتاج بخط الهوية، لا بالنموذج:** «غالبا أصنافنا الخريفية ما رح تحل جميع مشاكلكم بس للتأكيد:».
- [ ] لماذا تقريب الكاميرا لا الدوران؟ التقريب يقصّ الأطراف فقط؛ الدوران حول صورة مسطّحة يجبر النموذج على اختراع جوانب المنتج.

**لقطة الختام (صورة البداية فقط، تقريب بطيء):**
```text
Premium autumn bakery commercial, vertical 9:16, seamless pure white background, soft high-key daylight from the upper left, true-to-life colour.

Camera: a very slow, smooth dolly push-in toward the centre of the arrangement, about 10 percent closer over the whole clip, steady and continuous, no rotation, no shake. The arrangement moves as one flat photograph; no parallax, nothing behind another item is revealed.

One micro-motion only: a thin, soft wisp of steam rises from the lid opening of the white takeaway cup and fades. Everything else, including the chocolate and the fig slices, stays perfectly still, exactly as photographed; no added shine or wetness.

The upper part of the frame stays clean, empty white for a headline added later in editing. No autumn decorations: no leaves, no pumpkins, no cinnamon sticks.
```
ثم «القواعد الثابتة». منعنا الأوراق واليقطين صراحة: كلمة «autumn» تغري النموذج بإضافة زينة ليست من منتجاتنا. ومنعنا التزيّح (parallax) لأن الأصناف متداخلة في صورة مسطّحة، فالتزيّح يجبر النموذج على اختراع ما خلفها، وهو نفس سبب تفضيل التقريب على الدوران. وحركة دقيقة واحدة فقط (البخار): كل حركة إضافية فرصة تشوّه إضافية، ونصيحة Higgsfield نفسها حركة بسيطة. الإعدادات: لقطة بداية فقط، 9:16، 5 ث، 1080p، الصوت مطفأ.

**قائمة لقطات الريل (7.5 ث):**
```text
0.0–1.2 s  White card. The headline typed in the brand font (edit, not AI).
1.2–6.0 s  Eight autumn products pop in one by one on the beat (0.6 s each), each from its own Prompt D clip:
           Iced Pumpkin Pie Latte · Pumpkin Danish · Fig & Almond Cake Piece · Apple Linzer Cake Piece ·
           Apple & Dark Chocolate Brioche · Apple & Feta Salad · Beetroot & Quinoa Salad · Fig & Walnut Fall Salad
6.0–7.5 s  The full arrangement (closing shot above) + the real bilingual logo + one closing line approved by the owner.
```
لا سعر ولا عرض ولا جملة ختام إلا ما تعتمده أنت.

### 4.5 Prompt D: «صنف حيّ» (3 – 5 ث لكل صنف)

للستوريز وشاشات الفروع والموقع، ولقطات ريل الخريف. **لقطة بداية فقط:** صورة الصنف نفسه على الأبيض، **مع ظلّ ملامسة خفيف** (الصنف واقف لا طائر). القالب:
```text
[PRODUCT], centred on a pure white seamless background, exactly as in the start frame. [ONE MICRO-ACTION]. The camera pushes in very slowly, about 5% over the whole clip, perfectly smooth, no shake. The product itself does not rotate, deform, grow or change; only [WHAT MAY MOVE] moves. Soft studio light from the upper left and one soft natural contact shadow directly under the product; nothing else on the background. The last second settles into a calm, almost still frame suitable for a seamless loop.
```
ثم «القواعد الثابتة».

**أمثلة مملوءة:**
```text
[PRODUCT] = a plain butter croissant
[ONE MICRO-ACTION] = a soft band of warm light slowly sweeps across the croissant from left to right, revealing its flaky layers
[WHAT MAY MOVE] = the light only; no flakes or crumbs fall
```
```text
[PRODUCT] = an Iced Spanish Latte in Almond's clear plastic cup with black line-drawing doodles, a uniform beige drink exactly as in the start frame
[ONE MICRO-ACTION] = the ice settles very slightly inside the cup, and fine condensation beads appear only on the unprinted upper band of the cup and its clear rim
[WHAT MAY MOVE] = the ice and that condensation; the drink's colour stays uniform as shown, with no layers or marbling, and the printed doodles stay perfectly still, sharp and dry
```
لماذا هكذا؟ فتات يتساقط من كرواسون واقف يوحي بأنه بائت يتفتّت، وهو أشيع أعطال الجسيمات في النماذج. وايس سبانيش لاتيه في صورتنا (`p-10357`) مشروب ممزوج بلون بيج واحد؛ «القهوة تنساب في الحليب» تُظهر مشروباً بطبقات لا نقدّمه ولا صوّرناه، والتكثّف فوق الرسومات المطبوعة يشوّهها.
```text
[PRODUCT] = a Hot Pumpkin Pie Latte in a clear double-walled glass mug, topped with whipped cream and a square biscuit
[ONE MICRO-ACTION] = a thin, slow wisp of steam rises from the whipped cream and fades out above the glass
[WHAT MAY MOVE] = the steam and a faint shift of light on the cream
```
تنبيه على المثال الثالث: الكوب الزجاجي مطبوع عليه الشعار بالعربي والإنجليزي، والحرف المطبوع على زجاج متحرّك يتشوّه بسهولة. جرّبه أخيراً، وارفضه عند أول حرف يهتزّ.

**D1 — حلقة متكرّرة لبانوفي فرابيه** (`p-12188`). نفس الصورة لقطة بداية ونهاية معاً، 1:1 أو 9:16، 5 ث:
```text
Close-up product hero shot of a single iced coffee drink in a clear plastic cup with a black line-drawing doodle print, topped with whipped cream and a caramelised topping, caramel streaks inside the cup, on a seamless pure white background, soft high-key studio light, one soft contact shadow under the cup.

Motion: the cup does not move or rotate at all. A soft vertical band of highlight slowly glides across the cup from left to right and fades out at the right edge, so the clip loops seamlessly. Fine condensation beads appear only on the unprinted band of the cup, never over the printed doodles. The cream and the topping stay perfectly still.

Fidelity: the printed doodle pattern and the square logo mark on the cup stay exactly as photographed, sharp and still; the drink, cream and topping keep their exact shape and colour.

Camera: locked-off, no zoom, no pan.
```
**الكوب ثابت عمداً.** هذا الكوب يحمل الرسومات والعلامة المربعة معاً، وهما أول ما يذوب، والدوران حول صورة مسطّحة يجبر النموذج على اختراع جانب الكوب الخفي (القسم 4.4). إن أردت دوراناً فـ**6° أو أقل**، أقل من حدّ جدول الأعطال (8°). **ارفع الصورة الأصلية من المصوّر لا صورة المنيو:** صورة المنيو `512×341` فقط **[حساب منّا]**.

### 4.6 جدول الأعطال

| المشكلة | الإصلاح |
|---|---|
| الشعار أو رسومات الكوب تذوب | لا تضع الشعار في الفيديو أبداً. للأكواب: دوران 8° أو أقل (الأفضل كوب ثابت، كما في D1)، وجملة `printed pattern moves rigidly like a decal`، و**Kling 3.0** لا Turbo. وإن بقيت، صغّر الكوب إلى الطبقة الخلفية أو أخرجه |
| الكرواسون يتغيّر شكله أو تسيح طبقاته | قارب الحجم والدوران بين اللقطتين (فرق الدوران 15° أو أقل)، وأضف `rigid, no deformation`، واستعمل صورة بدقة 1000 أو الأصل. أو جرّب A4 |
| الأصناف تندمج ببعضها | مسافة 48 بكسل على الأقل في `END.png`، وتداخل أقل في `START.png`، وعدد أقل (6 – 8). هكذا ينصح Higgsfield نفسه: مقاطع قصيرة وحركة بسيطة ([مقال التشوّهات](https://higgsfield.ai/blog/how-to-avoid-distortions-ai-videos) **[رسمي]**) |
| يظهر صنف جديد أو مكرّر أو زينة | ارفض المقطع فوراً (قاعدة الصدق). خفّض العدد، وأضف `exactly the items shown, nothing added`. Seedance 2.5 يعدّل منطقة محددة ([صفحة 2.5](https://higgsfield.ai/seedance/2.5) **[رسمي]**) |
| الخلفية رمادية أو كريمية | تأكّد أن اللقطتين `#FFFFFF` تماماً بلا ظلال، وأضف `overexposed white`، ثم ثبّت الأبيض في المونتاج بأداة Levels |
| الحركة بطيئة | A3، أو مدة 3 ث، أو Speed Ramp في المونتاج |
| الحركة متقطّعة | مدة 5 – 6 ث، وأضف `smooth ease-out, continuous motion`، أو A2. وفي Higgsfield أداة تنعيم: صفحة [AI Video Upscaler](https://higgsfield.ai/ai-video-upscaler) تقول «Generate in-between frames with FPS Boost or Topaz for smoother playback, up to 60 fps» **[رسمي]**؛ أثرها على حركة سريعة مموّهة **[غير متحقَّق]**: جرّبها على لقطة واحدة |
| تقطّع بعد التسريع (المقطع سليم بسرعته الأصلية) | التسريع يحذف إطارات ولا يضيف غباشاً، والغباش الذي رسمه النموذج كان لسرعة أبطأ. في Premiere فعّل **Time Interpolation → Frame Blending** (أو Optical Flow) على الجزء المسرَّع، وأضف غباشاً اتجاهياً في CapCut أو Premiere. أو قلّل التسريع: ولّد بمدة 3 ث بدل 5، فيقلّ التسريع من حوالي 3.6 مرة إلى حوالي الضعفين **[حساب منّا]** |
| الأصناف تخرج مبكراً في A | أضف `every product comes to rest and stays in frame until the end` |
| الأصناف تتلاشى داخل الإطار في B | أضف `no fading, each product exits through the nearest edge`، أو B2 |
| الكاميرا تتحرّك رغم الطلب | كرّر `locked-off static camera` في مربع الكاميرا وفي البرومبت، وارفع cfg_scale إن ظهر |
| في الملف صوت | أطفئ الصوت قبل التوليد، أو احذف مسار الصوت قبل المونتاج |
| ومضة بين الأبيض الأول والفيديو | ابدأ المقطع من لحظة فيها الأصناف متحرّكة بغباش، وتأكّد أن الأبيض `#FFFFFF` في الطرفين |

**ارفض أي مقطع إذا:** تغيّر شكل صنف أو عدد حبّاته أو زينته · اهتزّت رسومات الكوب أو تشوّه شعاره · ظهر أي حرف · صارت الخلفية رمادية أو متدرّجة · اندمج صنفان أو ظهر صنف ليس في المرجع. **افحص إطاراً إطاراً على هاتف بحجمه الحقيقي.**

---

## 5. أيّ نموذج في Higgsfield ولماذا

**تنبيه:** صفحات التسويق في Higgsfield متأخرة عن الواقع. صفحة [`/ai-video`](https://higgsfield.ai/ai-video) و[صفحة إنشاء الفيديو](https://higgsfield.ai/create/video) ما زالتا تعرضان Sora 2، بينما [مدونة الهجرة](https://higgsfield.ai/blog/sora-api-migration-guide) (3 تشرين الأول 2026) تقول إنه أُزيل **[متعارض]**. **المرجع يوم التنفيذ هو قائمة النماذج داخل الموقع** و[سجل التغييرات](https://higgsfield.ai/creator-hub/changelog).

| النموذج | بداية + نهاية | المدة | الدقة | الصوت | لماذا ومتى | المصدر |
|---|---|---|---|---|---|---|
| **Kling 3.0** — **الاختيار الأول** (اسمه في الـAPI «Kling 3.0 Pro»؛ في الموقع «Kling 3.0» فقط) | نعم | 3 – 15 ث | 720p و1080p و4K | يُشغّل ويُطفأ، شغّال افتراضياً | أقصر مدة دنيا، والأرخص للتكرار، و9:16 مدعومة | [دليل Higgsfield](https://higgsfield.ai/blog/Kling-3.0-is-on-Higgsfield-User-Guide-AI-Video-Generation)، [مركز المساعدة](https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-kling)، [مستندات الـAPI](https://docs.higgsfield.ai/docs/models/kling-3/pro-image-to-video) **[رسمي]** |
| Kling 3.0 Turbo | **لا لقطة نهاية** | 3 – 15 ث | حتى 1080p | لا | للمسوّدات بلقطة بداية فقط؛ لا يصلح لـA وB | [مستندات Turbo](https://docs.higgsfield.ai/docs/models/kling-3/turbo-image-to-video) **[رسمي]** |
| Kling O3 First-Last Frame — **بديل في الـAPI** | نعم | 3 – 15 ث | std وpro و4k | مطفأ افتراضياً | نفس الفكرة. قائمة الموقع ([مركز المساعدة](https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-kling)) فيها Kling 3.0 وTurbo وOmni وO1 و2.6 ولا «O3»: ظهوره في الموقع، وهل هو «Kling 3.0 Omni»، **[غير متحقَّق]** | [مستندات O3](https://docs.higgsfield.ai/docs/models/kling-o3/first-last-frame) **[رسمي]** |
| **Seedance 2.5** — **البديل الثاني، والأفضل للريلز** | نعم: `end_image_url` في [الـAPI](https://docs.higgsfield.ai/docs/models/seedance-2-5/image-to-video)، ووضع Draft في الموقع منذ 22 أيلول ([سجل التغييرات](https://higgsfield.ai/creator-hub/changelog)؛ غير متاح في الولايات المتحدة)؛ عمله مع المراجع في نفس التوليد **[غير متحقَّق]** | 4 – 30 ث | 480p و720p و1080p (الـ1080p وصول مبكر لخطة Plus فما فوق، [سجل التغييرات](https://higgsfield.ai/creator-hub/changelog) 14 آب) | يُطفأ (`generate_audio`، مفعّل افتراضياً) | حتى 50 مرجعاً، وتعديل منطقة محددة، ولقطة متصلة حتى 30 ث، ويعمل داخل Cinema Studio 4.0 | [صفحة 2.5](https://higgsfield.ai/seedance/2.5)، [مدونة 2.5](https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026)، [مستندات](https://docs.higgsfield.ai/docs/models/seedance-2-5/image-to-video)، [سجل التغييرات](https://higgsfield.ai/creator-hub/changelog) **[رسمي]** |
| Veo 3.1 (Fast) — احتياطي | الصفحة تقول نعم في Fast | 4 أو 6 أو 8 ث | 720p و1080p، 24 إطاراً | نعم | 24 إطاراً تعني غباشاً أكثر | [صفحة veo3.1](https://higgsfield.ai/veo3.1) **[رسمي]**، [مستندات Google](https://ai.google.dev/gemini-api/docs/veo) |
| Kling 4.0 | حتى 10 إطارات مفتاحية | 3 – 30 ث | 720p و1080p | ؟ | أقوى على الورق، أُطلق 15 تشرين الأول | [kingy.ai](https://kingy.ai/blog/kling-4-0-product-consistency-pricing-availability/) **[طرف ثالث]**؛ وجوده على Higgsfield **[غير متحقَّق]** |
| Wan 3.0 — اقتصادي | **[غير متحقَّق]** | حتى 30 ث | حتى 1080p | يُولَّد مع الفيديو؛ إمكان إطفائه **[غير متحقَّق]** | خصم 60% في الـAPI حتى 31 تشرين الأول | [صفحة Wan 3.0](https://higgsfield.ai/wan-3-0) **[رسمي]**؛ الدقة والمدة والخصم من [سجل التغييرات](https://higgsfield.ai/creator-hub/changelog) 13 تشرين الأول **[رسمي]** |

**أشياء تحسم التصميم:**
- **لا يوجد نموذج فيديو على Higgsfield يخرج خلفية شفافة.** لا صفحة نموذج تذكر ذلك، وصفحة [Gemini Omni](https://higgsfield.ai/gemini-omni-flash) تحدّد MP4 (H.264) **[رسمي]**. إضافة [After Effects](https://higgsfield.ai/plugins/after-effects) تَعِد بـ«pure alpha channel» دون صيغة ملف **[غير متحقَّق]**، و[مغيّر الخلفية](https://higgsfield.ai/ai-video-background-changer) يقول «Results vary… fast motion… harder» **[رسمي]**، وهذه حالتنا بالضبط. لهذا الشعار يُركَّب فوق فيديو أبيض، والتطبيق يبني حركته بنفسه.
- **الشعار والنص يتشوّهان:** صفحة [فيديو المنتج](https://higgsfield.ai/ai-product-video-generator) تنصح، حين يجب أن يبقى نص الملصق مقروءاً، بصنع الإطار الأول في مولّد صور لا في نموذج الفيديو **[رسمي]**. (سطر «NO-IP: No brands, logos, readable text, or recognizable songs» في [مثال Seedance 2.5 الرسمي](https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026) استبعاد لملكية الغير، لا كلام عن جودة رسم النص، فلا نستشهد به هنا.) أن العربي أسوأ: خبرة منتجين **[غير متحقَّق]**.
- **الأصناف تتحوّل في الحركة السريعة:** اختبار مستقل على **Kling 4.0 Flash** (لا Kling 3.0)، في اختبار إطارات مفتاحية بحركة كاميرا متصلة، وجد «severe spatial warping»، وسجّل لكوب قهوة يدور «Scale and grip perspective warp during rotation» ([atlascloud](https://www.atlascloud.ai/blog/tips/kling-4-flash-vs-seedance-2.5) **[طرف ثالث]**). لا دليل مستقلاً عندنا على Kling 3.0 نفسه؛ نصيحة Higgsfield العامة: مقاطع قصيرة وحركة بسيطة ([مقال التشوّهات](https://higgsfield.ai/blog/how-to-avoid-distortions-ai-videos) **[رسمي]**). من هنا: 9 أصناف، متباعدة، حركة شعاعية، كاميرا ثابتة، ودوران قليل.
- **[Effects](https://higgsfield.ai/effects):** لا preset باسم burst أو explode أو orbit؛ الأقرب (Particles، Floating fall، Scrapbook collage) مصمَّم لأشخاص غالباً. لا ننصح بها هنا.
- **[AI Motion Design](https://higgsfield.ai/ai-motion-design)** («Edit the code, not the pixels»): يبني الحركة بالكود من شعار وSVG وصور، فقد يكون الأداة الوحيدة عندهم التي تُبقي الشعار مطابقاً. ثبات الشعار والشفافية و9:16 فيه كلها **[غير متحقَّق]**. تجربة اختيارية لريل الإعلان.

### التكلفة والخطط
صفحة الأسعار تُبنى بالجافاسكربت ولم نستطع قراءتها مباشرة؛ الأرقام كما نقلتها أطراف ثالثة بين 4 و8 تشرين الأول ([aliteq](https://aliteq.com/higgsfield-credits-explained)، [versely](https://www.versely.studio/blog/higgsfield-pricing-2026)) **[طرف ثالث]**:

| الخطة | شهري | سنوي (للشهر) | الرصيد الشهري |
|---|---|---|---|
| Starter | $19 | $19 | 270 |
| Plus | $59 | $47 | 1,200 |
| Ultra | $129 | $99 | 3,000 |

- الرصيد لا يُرحَّل. Seedance 2.5 بدقة 1080p يحتاج Plus فما فوق: «included with Plus plans and above» ([سجل التغييرات](https://higgsfield.ai/creator-hub/changelog)، 14 آب) **[رسمي]**.
- **مقطع 5 ث بدقة 1080p:** Kling 3.0 حوالي 8 رصيد **[طرف ثالث]**، أو حوالي 12.5 بقسمة السعر الرسمي 37.5 لـ15 ث (القسمة الخطية افتراض **[حساب منّا]**). Seedance 2.5 حوالي 60 بقسمة 120 رصيد لـ10 ث **[حساب منّا]**. Veo 3.1 Fast حوالي 16 لـ4 ث **[طرف ثالث]**. أثر 9:16 على السعر **[غير متحقَّق]**.
- **تقديرنا:** A وB وA4، بـ5 محاولات لكل منها و4 نسخ لكل محاولة، تعني حوالي 60 توليداً. بسعر 1080p على Kling هذا 480 – 750 رصيداً، أي فوق Starter (270) وداخل Plus (1,200) **[حساب منّا]**. تجارب 720p أرخص، وسعرها غير منشور **[غير متحقَّق]**. وريلز Seedance بدقة 1080p تحتاج Plus على أي حال.

### الترخيص
- **§4.4** من [شروط الاستخدام](https://higgsfield.ai/terms-of-use-agreement) (تحديث 26 تموز 2026، يسري على الحسابات القديمة من 27 آب): «Company does not claim ownership of any of your Inputs or Outputs, nor does it restrict your commercial use of Outputs»، والحقوق تبقى بعد إلغاء الاشتراك **[رسمي]**.
- **التدريب:** في الخطط العادية (غير Enterprise) يحق لهم تدريب نماذجهم على ما نرفعه وما يُولَّد، أي صور منتجاتنا وشعارنا. الإيقاف للمستقبل بحذف المحتوى أو الحساب **[رسمي]**. لكن **§16.5(c)** يستثني من الحذف الدائم ما استُعمل فعلاً في تدريب نماذجهم قبل الحذف «which cannot feasibly be disassociated»: ما رفعناه وتدرّبوا عليه لا يُسحب من النماذج **[رسمي]**. فكّر في هذا قبل رفع أكواب عليها شعارنا.
- **§4.2(c) و§12:** نضمن أن ما نرفعه لا يخالف حقوق الغير (§4.2(c))، ونعوّضهم عن الضرر إن خالفها (§12) **[رسمي]**. أما §13.2 فإخلاء مسؤوليتهم عن المخرجات.
- **المجانية:** [مركز المساعدة](https://higgsfield.ai/creator-hub/help-center/account/who-owns-my-generations-and-can-i-use-them-commercially) يقول إن الحقوق التجارية غير مربوطة بالخطة، والمدفوعة فقط بلا علامة مائية، بينما صفحة الأسعار كما نقلتها أطراف ثالثة تكتب للمجانية «Commercial use not included» **[متعارض]**. **إذن: خطة مدفوعة.**

### Higgsfield ومعاينة المتجر
**لا يصلح فيديو Higgsfield لمعاينة App Store:** أبل تقول «App previews must show only content within the app itself» ([Apple](https://developer.apple.com/app-store/app-previews/)). وGoogle Play يوصي بقوة، تحت «Highly recommended»: «Aim for at least 80% of the video to be representative of the user experience» و«Limit title screens, logos…» ([Google Play](https://support.google.com/googleplay/android-developer/answer/9866151)). هي توصية لا شرط عند جوجل، وشرط عند أبل. المعاينة تكون تسجيل شاشة لافتتاحنا الحقيقي داخل التطبيق.

---

## 6. كيف يدخل التطبيق

### التوصية
**حركة حيّة بـReanimated، لا فيديو.** المقارنة (أرقام الحجم قاسها مصمّم الحركة **[حساب منّا]**):

| المعيار | فيديو Higgsfield داخل التطبيق | حركة حيّة بـReanimated 4.3.1 |
|---|---|---|
| الحجم | 2.5 ث بعرض 1080: من 0.63 MB إلى 0.89 MB، وضعفها لنسخة الداكن. على الويب يُنزَّل قبل أن يشتغل | 10 أصناف WebP شفافة: حوالي 0.2 MB، نسخة واحدة للوضعين |
| الاعتماديات | `expo-video` غير مثبّت: **حزمة جديدة تحتاج موافقتك** | المكتبة مثبّتة |
| الوضع الداكن | فيديو أبيض يكسره، أو نسختان | نفس المكوّن بلونين |
| الوميض | المشغّلات غالباً تعرض إطاراً فارغاً قبل أول إطار | الإطار صفر لون سادة مطابق لشاشة النظام |
| الحدّة | 1080 مكبّر على شاشات أعرض، وعيوب ضغط في الحركة السريعة | بدقة الجهاز من الصورة الحقيقية |
| تقليل الحركة | مسار منفصل | نفس المكوّن، مسار التلاشي |
| الصدق | النموذج قد يغيّر الفراولة أو رسومات الكوب | صور المنيو نفسها |

**تنبيه:** النسخة المنشورة اليوم هي **نسخة الويب** تحت `/almond` ([`almond-app/PRODUCT.md`](../../almond-app/PRODUCT.md))، فالافتتاح يجب أن يعمل على الويب أولاً.

### القواعد
- **2.5 ث أو أقل** (الكامل 2.4 ث)، **بلا صوت.** أبل: «Launch instantly» و«If you need a splash screen, consider displaying it at the beginning of your onboarding flow» ([Apple HIG، Launching](https://developer.apple.com/design/human-interface-guidelines/launching)).
- **الفتح البارد فقط.** لا يظهر عند الرجوع للتطبيق، ولا عند الفتح من رابط أو إشعار، ولا مع قارئ الشاشة. أندرويد: «The splash screen never shows during a hot start» ([Android](https://developer.android.com/develop/ui/views/launch/splash-screen)).
- **التعارض مع «اجمع نقاطك» (قاعدتك أنت):** في 2026-10-15 قرّرت أن «اجمع نقاطك» تفتح وحدها عند الإطلاق، والسبب مكتوب في [`almond-app/lib/earnSheet.ts`](../../almond-app/lib/earnSheet.ts): «The commonest reason to open a café app is standing at the till; the code should already be on screen». عضو يزورنا مرة في اليوم يكون أول فتح بارد له في اليوم **هو** زيارة الكاشير. فلو ظهر الافتتاح «أول فتح في اليوم» لوقف 2.4 ث (منها 300 ms تسليم) أمام الباركود في كل زيارة تقريباً، والطابور ينتظر. تأخير المهمة الأساسية لحظة الضغط الاجتماعي يعلّم الضيق من العلامة، والربح على شاشة اليوم (2.5 ث) يختفي في اللحظة التي تهمّ.
- **متى بالضبط (توصيتنا):** `decideOpening` تأخذ قرار «اجمع نقاطك» مدخلاً، و**تعيد `'none'` كلما كانت `shouldAutoOpenEarnSheet` ستقول نعم**: الباركود أولاً، بلا افتتاح. ويظهر الافتتاح كاملاً في: **أول تثبيت** (قبل الترحيب) · **للضيف** في أول فتح بارد في اليوم (لا رمز عنده يُعرض على الكاشير) · **ومرة واحدة** مع كل موسم جديد أو تغيير منيو أو تحديث للتطبيق، للعضو الذي أطفأ فتح «اجمع نقاطك» التلقائي. باقي المرات تدخل الرئيسية فوراً، أي أسرع بـ2.5 ث من اليوم. البديل «أول فتح في اليوم» للجميع مشروح في القسم 7، البند 3، بثمنه.
- **التخطّي:** لمسة في أي مكان، أو زر الرجوع في أندرويد، أو Esc وEnter وSpace على الويب: قفز إلى التسليم خلال 150 ms. **اللمسة تُستهلك:** الطبقة سطح ضغط يغطّي الشاشة كلها ويمسك اللمس، فلمسة التخطّي فوق تبويب الباركود أو مربع الطلب لا تصل إلى الزر تحتها.
- **تقليل الحركة:** الشعار بالتلاشي فقط، 800 ms أو أقل ([Apple HIG، Motion](https://developer.apple.com/design/human-interface-guidelines/motion): «Make motion optional»). عبر المتجر الموجود [`almond-app/lib/reducedMotion.ts`](../../almond-app/lib/reducedMotion.ts)، لأن `useReducedMotion` في Reanimated يقرأ الإعداد مرة عند التشغيل فقط ([Reanimated](https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/)).
- **بلا وميض:** شاشة النظام لون سادة بلا شعار، مطابقة لوضع المظهر (أبل: «nearly identical to the first screen» و«Don't include logos»). اليوم `app.json` يضع `splash.backgroundColor` أبيض في الوضعين، فيحدث وميض أبيض على الهاتف الداكن قبل `#0F0F0F`. الإصلاح: إعداد إضافة `expo-splash-screen` بخلفية `#FFFFFF` ومفتاح `dark` بخلفية `#0F0F0F` ([Expo SplashScreen](https://docs.expo.dev/versions/latest/sdk/splash-screen/)).
- **ليس «شاشة إطلاق ثانية»:** جوجل توصي بعدم تكرار شاشتَي إطلاق ([Android migrate](https://developer.android.com/develop/ui/views/launch/splash-screen/migrate))؛ افتتاحنا طبقة فوق رئيسية تُحمَّل فعلاً تحته.
- **لا يفتح أي شيت إطلاق قبل التسليم:** لا «اجمع نقاطك» ولا شكر الزيارة وتقييمها. كلاهما يختاره `chooseLaunchSheet` في [`almond-app/lib/launchSheet.ts`](../../almond-app/lib/launchSheet.ts)، فالشرط هناك لا في `earnSheet.ts` وحده. (وعملياً «اجمع نقاطك» لا تلتقي بالافتتاح أصلاً، لأن الافتتاح لا يظهر حين تفتح وحدها.)
- **لا حزمة جديدة بلا موافقتك:** Reanimated 4.3.1 و`react-native-svg` و`expo-splash-screen` مثبّتة؛ `expo-video` وlottie ليستا مثبّتتين.

### موجز التنفيذ للوكيل البرمجي (لا يُنفَّذ قبل البند 1 في القسم 7)
قبل أي تعديل للواجهة: اقرأ `.claude/skills/impeccable/reference/craft-floor.md`، واستعمل مهارة `expo-animation`.

1. **`almond-app/lib/opening.ts`:** دوال صافية مختبَرة (worklet):
   - `OPENING_TIMELINE` بالحدود 0، 100، 800، 1050، 1700، 2100، 2400، و`REDUCED_TIMELINE` بإجمالي 800 ms أو أقل.
   - `radialProgress(ms)` متصاعدة دائماً: 0.10 عند 100، و1.00 عند 800، و1.03 عند 1050. **في المقطع 3 لا مضاعف عام:** كل صنف ينتقل من 1.03 من موضعه إلى `exitDistance` الخاصة به (من `layoutOpening`) بتسهيل الخروج، فيبقى التصاعد مضموناً لكل صنف. والشفافية تنزل من 1 إلى 0 بين 1620 و1700 ms احتياطاً.
   - `stretchFor(speed)`: المطّ `1.0` تماماً تحت عتبة السرعة، ولا يتجاوز `1.08` أبداً.
   - `decideOpening({onboarded, isGuest, earnSheetWillOpen, openingKey, lastShown, today, reducedMotion, screenReader, launchedFromLink})` تعيد `'full'` أو `'fade'` أو `'none'`. `earnSheetWillOpen` هو ناتج `shouldAutoOpenEarnSheet` نفسه، فإن كان `true` فالناتج `'none'`. `openingKey` يتغيّر مع الموسم أو تغيير المنيو أو نسخة التطبيق، و`lastShown` = `{key, date}` آخر عرض. و`onboarded` يحدّد الوجهة: `/onboarding` في أول تثبيت، والرئيسية بعده.
   - `layoutOpening({width, height, lockup})`: مواضع قطبية نسبية، والمقاس المرجعي لا يتجاوز 500 حتى لا تتضخّم الأصناف على الآيباد والويب، بإحداثيات `left/top` مطلقة لا start/end، فلا ينعكس التركيب بين اللغتين. ولكل صنف `exitDistance` = المسافة على شعاعه حتى أقرب حافة للشاشة الفعلية + نصف قطره (diagonal) بمقياس `1.2`، فيخرج كاملاً على أي مقاس. لماذا لا مضاعف عام (كان 2.6 عند 1700 ms)؟ على هاتف طويل `390×844` كانت الأصناف الداخلية فوق الشعار وتحته ستنتهي عند 300 – 350 نقطة من المركز، ونصف الارتفاع 422؛ وعلى ويب `1280×800` كانت الجانبية ستنتهي قرب 650 مقابل نصف عرض 640، فيبقى نصف الصنف ظاهراً ثم يختفي فجأة عند التسليم **[حساب منّا]**.
   - `OPENING_ITEMS` (الرقم، الطبقة، `darkSafe`، الزاوية، نصف القطر، الحجم، الميل) و`openingItemsFor({scheme, menuIds})` يُسقط غير الآمن على الداكن وما خرج من المنيو.
2. **`almond-app/components/opening/OpeningOverlay.tsx` و`OpeningSprite.tsx`:** قيمة زمن مشتركة واحدة من 0 إلى 2400 خطّية، وكل صنف يشتقّ منها موضعه وحجمه ودورانه ومطّه. كل الأصناف تُركَّب من الإطار صفر بشفافية 0 لتُفكّ مسبقاً. على الويب: انتظار `onLoad` لكل الصور **يُحسب داخل المقطع 0**: إن لم تكتمل عند 100 ms يُمسَك الإطار الفارغ 100 ms أخرى على الأكثر، وتُخصم من لحظة «الشعار وحده» (400 ← 300 ms)، فلا يتجاوز الإجمالي 2.4 ث. وإن لم تكتمل عند 200 ms فمسار التلاشي. **الطبقة سطح ضغط يغطّي الشاشة ويستهلك اللمس** (لا `pointerEvents: 'none'`)، فلا تصل لمسة التخطّي إلى الرئيسية تحتها.
3. **`almond-app/assets/opening/`:** الأصناف WebP شفافة بثلاثة أضعاف حجم العرض، والشعار الثنائي بنسختيه، والرسومات الأربع SVG إن وافق المالك.
4. **`almond-app/stores/openingStore.ts`** (الحالة `idle` ثم `playing` ثم `done`)، ومفتاح جديد `almond.opening` (`{key, date}`) في `almond-app/stores/appStore.ts` يُكتب عند **بداية** الافتتاح، بنمط المفاتيح الموجودة (`almond.onboarded`).
5. **`almond-app/app/index.tsx`:** احذف شريط التقدّم ومؤقّت 2500 ms. القرار عبر `decideOpening`، ثم `router.replace` فوراً إلى **الشاشة الأولى** (`/onboarding` قبل الترحيب، والرئيسية بعده، كما يفعل الملف اليوم)، والطبقة تُعرض في `app/_layout.tsx` فوق الـStack فتُركَّب الشاشة الأولى وتجلب بياناتها تحتها. إن قِيس تقطّع على الويب، أجّل تركيبها إلى 1050 ms.
6. **`almond-app/lib/launchSheet.ts`:** شرط مستقل `openingPlaying` في `chooseLaunchSheet` (يعيد `null` ما دام الافتتاح يعمل)، فيغطّي الشيتين معاً: شكر الزيارة و«اجمع نقاطك». اختبار باسمه في `almond-app/test/launchSheet.test.ts`. لا يكفي شرط في `earnSheet.ts` وحده، لأن شكر الزيارة لا يمرّ به.
7. **`almond-app/app.json`:** انقل `splash` إلى إعداد إضافة `expo-splash-screen` (`#FFFFFF` و`dark` `#0F0F0F`، بلا صورة). على الويب: لوّن خلفية HTML قبل تحميل الحزمة حسب `prefers-color-scheme`؛ الطريقة في SDK 56 مع `output: "single"` **[غير متحقَّق]**.
8. **أيقونة التطبيق:** `almond-app/assets/icon.png` **ما زالت بنفسجية** من الهوية القديمة (متوسط لونها حوالي `#7D6FBD` **[حساب منّا]**)، وهي أيضاً `favicon` الويب في `app.json`. وأندرويد 12 فما فوق يعرض أيقونة التطبيق في شاشة النظام افتراضياً («The launcher icon is the default»، [Android](https://developer.android.com/develop/ui/views/launch/splash-screen)). ظهورها فعلاً مع Expo SDK 56 بلا صورة splash **[غير متحقَّق]** على جهاز حقيقي.
9. **`almond-app/locales/ar.json` و`en.json` معاً:** `opening.skip` تسمية لسطح الضغط، لمستخدم لوحة المفاتيح على الويب (Esc وEnter وSpace) ولمسار التلاشي. **لا تَعِد بأن قارئ الشاشة يعلنها:** الافتتاح لا يظهر أصلاً مع قارئ الشاشة. انتبه: الاسم في `ar.json` «ألموند» والشعار «آلموند» (القسم 7، البند 7).
10. **`e2e/app/helpers.ts`** (جذر المستودع): يكتب `almond.opening` بالمفتاح الحالي وتاريخ اليوم إلا إذا طلب الاختبار `opening: true`، وإلا سترى كل الاختبارات الحالية الافتتاح.

**الاختبارات (`almond-app/test/opening.test.ts`):** الخط الزمني 2500 ms أو أقل ومسار تقليل الحركة 800 ms أو أقل والمقاطع متّصلة · `radialProgress` لا تنقص أبداً، يُفحص كل 1 ms (هذا «لا رجوع للداخل» المقاس عند السوق المفتوح) · كل شرط في `decideOpening` باختبار مستقل · **الافتتاح لا يسبق «اجمع نقاطك» أبداً:** لكل مدخل فيه `earnSheetWillOpen: true` الناتج `'none'` · التخطيط على `320×568` و`360×640` و`390×844` و`430×932` و`768×1024` و`1024×1366` و`1280×800`: لا صنف يدخل حدود الشعار مع هامش 24، وكل صنف أمامي ظاهر بنسبة 60% على الأقل، ولا تداخل بين الأمامية فوق 30%، و**عند 1700 ms حدود كل صنف (بمقياس 1.2) خارج الشاشة كلياً** على المقاسات السبعة · **المطّ:** لا يتجاوز `1.1` أبداً، و`1.0` تماماً تحت عتبة السرعة · **الصدق:** كل رقم في `OPENING_ITEMS` موجود في بيانات المنيو في `packages/shared` وله ملف مقصوص · **ميزانية الحجم:** 400 KB أو أقل للمجموع و40 KB أو أقل للملف · `chooseLaunchSheet` يعيد `null` ما دام `openingPlaying` (شكر الزيارة و«اجمع نقاطك» معاً، في `test/launchSheet.test.ts`) · `app/index.tsx` بلا مؤقّت 2500 ms ولا شريط تقدّم. **اكسر كل حارس عمداً، وتأكّد أن الاختبار يفشل، ثم أعده كما كان حرفياً.**

**اختبارات الواجهة (`e2e/app/opening.spec.ts`):** الفتح الأول يعرض الافتتاح ثم الشاشة الأولى خلال 2.5 ث أو أقل، والسماح لتوقيت الإطارات صريح في اسم الاختبار (مثلاً «first screen within 2500 ms: 2400 budget + 100 ms frame tolerance») · إعادة التحميل بنفس المفتاح بلا افتتاح · عضو مسجّل و«اجمع نقاطك» التلقائية مفعّلة: لا افتتاح، والباركود فوراً · اللمس يتخطّى خلال 300 ms أو أقل · **لمسة مكان تبويب الباركود أثناء الافتتاح لا تفتح Pay** · مع `reducedMotion: 'reduce'` لا أصناف متحرّكة والشاشة الأولى خلال ثانية · في الداكن الإطار الأول `#0F0F0F` · لا شيت إطلاق (شكر الزيارة أو «اجمع نقاطك») قبل اختفاء الطبقة.

**فحص على الأجهزة:** آيفون 3x فاتح وداكن · أندرويد 12 فما فوق (أيقونة شاشة النظام) · أندرويد ضعيف · كروم أندرويد وسفاري iOS · تقليل الحركة وVoiceOver وTalkBack · تسجيل 60 إطاراً والتنقّل إطاراً إطاراً عند لحظة التسليم من شاشة النظام.

**البوابة كاملة قبل الدمج:** `npm run lint`، `npm run typecheck`، اختبارات bff والتطبيق والموقع، اختبارات Python، `npm run web:build`، `CI=1 npm run test:e2e`.

**رسالة الكوميت تذكر السوابق:** «Precedent: OpenSooq opening (measured from the owner's recording); Apple HIG Launching; Android SplashScreen API».

**نصّ `DESIGN.md` المقترح** (يُضاف بعد موافقتك، في قسم الحركة):
> **Opening (owner, 2026-10-16).** The owner reopened motion for one moment only: the app opening. On first install, for a guest's first cold start of the day, and once per new season, menu change or app update, tilted cut-outs from the owned menu photography (the only place photos lose their white plane) and the badge's four drawings burst from behind the real bilingual lockup, drift, leave, and hand off to the first screen within 2.4 s. It never plays when «اجمع نقاطك» opens by itself: the till code comes first. It adds no hue (the reward colour is not used), no new artwork and no text beyond the logo. A tap skips it and does not reach the screen underneath; it never plays on resume, from a link or with a screen reader, and Reduce Motion turns it into a logo fade. Everything else keeps this direction's rules: no other entrance motion, and photo planes stay square-edged on their white ground.

ويُعدَّل بند Don't إلى: «new entrance motion (the opening above is the single exception)».

---

## 7. قرارات بانتظار المالك

1. **إعادة فتح «بلا حركة» للافتتاح وحده.** `DESIGN.md` يمنع اليوم الحركة الجديدة والرسم الزخرفي، ويجعل الأرضية البيضاء جزءاً من صورنا وحواف الصور مستقيمة. فالاستثناء يشمل أيضاً **الأصناف المقصوصة المائلة بلا أرضيتها البيضاء**، وهو المكان الوحيد الذي تفقد فيه الصور أرضيتها. موافقتك تُسجَّل بالنص المقترح في القسم 6، وتبقى بقية الواجهة بلا حركة دخول وبصور على أرضيتها.
2. **حركة حيّة أم فيديو MP4 داخل التطبيق.** توصيتنا: حيّة بـReanimated (بلا حزمة جديدة، أخفّ، تعمل في الداكن). الفيديو يحتاج `expo-video` بموافقتك، ونسختين للوضعين.
3. **كم مرة يظهر.** القاعدة التي يجب أن يحترمها أي خيار هي قاعدتك أنت (2026-10-15): «اجمع نقاطك» تفتح وحدها لأن العضو غالباً واقف على الكاشير، فالافتتاح **لا يسبقها أبداً**. توصيتنا: أول تثبيت · الضيف في أول فتح بارد في اليوم · ومرة مع كل موسم أو تغيير منيو أو تحديث للتطبيق، وليس حين تفتح «اجمع نقاطك» وحدها. **البديل: «أول فتح في اليوم» للجميع**، وثمنه صريح: يعني تقريباً كل زيارة للكاشير، 2.4 ث قبل أن يبدأ الباركود بالظهور والطابور ينتظر. ولا ننصح بـ«كل فتح بارد».
4. **«الخدمات» = رسومات المربع الأربع؟** هي من الشعار نفسه لا رسم جديد، لكن `DESIGN.md` يمنع «decorative artwork». نعم أم الأصناف وحدها؟
5. **Higgsfield:** أي خطة (خطة مدفوعة إلزامية للاستعمال التجاري؛ تقديرنا Plus، لأن جولة تجارب الافتتاح وحدها تتجاوز رصيد Starter، وريلز Seedance بدقة 1080p تحتاجها)، وهل تقبل بند التدريب على صورنا وشعارنا (الاستثناء Enterprise فقط؛ وما تدرّبوا عليه قبل الحذف لا يُسحب من نماذجهم، §16.5(c))، ومن يعمل المونتاج، وترخيص الموسيقى، وجملة الختام للريل.
6. **من يقصّ الصور ومن أين.** مصمّم يدوياً من الملفات الأصلية (نحتاجها من المصوّر أو التسويق)، و**ملف الشعار الثنائي المتجهي**. وهل نضيف مجموعة الخريف الآن؟ كل تبديل موسمي يحتاج تحديثاً للتطبيق أو نشراً للويب.
7. **الهوية العالقة:** أيقونة التطبيق وأيقونة المتصفح ما زالتا بنفسجيتين. وتوحيد «ألموند» (نص التطبيق) أو «آلموند» (الشعار).
8. **الوضع الداكن:** نُسقط كوب الزجاج من الافتتاح، أم نعيد قصّه احترافياً؟
9. **إحساس الافتتاح داخل التطبيق: دفعة أم طفو هادئ؟** الدفعة (A) أقرب للسوق المفتوح. لكن «Daylight Counter» في `DESIGN.md` أهدأ من سوق، فنعرض أيضاً نسخة **A2 الهادئة** للتطبيق نفسه: الأصناف تطفو للخارج ببطء بلا غباش ولا مطّ، بنفس المدة والقواعد. شاهد A وA2 من Higgsfield جنباً إلى جنب ثم اختر.

---

## 8. المصادر

**Higgsfield [رسمي]:**
- https://higgsfield.ai/
- https://higgsfield.ai/creator-hub/changelog
- https://higgsfield.ai/create/video
- https://higgsfield.ai/ai-video
- https://higgsfield.ai/kling-3.0
- https://higgsfield.ai/blog/Kling-3.0-is-on-Higgsfield-User-Guide-AI-Video-Generation
- https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-kling
- https://docs.higgsfield.ai/docs/models/kling-3/pro-image-to-video
- https://docs.higgsfield.ai/docs/models/kling-3/turbo-image-to-video
- https://docs.higgsfield.ai/docs/models/kling-o3/first-last-frame
- https://higgsfield.ai/seedance/2.5
- https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026
- https://docs.higgsfield.ai/docs/models/seedance-2-5/image-to-video
- https://www.higgsfield.ai/seedance/2.0
- https://higgsfield.ai/blog/cinema-studio-4-0
- https://higgsfield.ai/veo3.1
- https://higgsfield.ai/gemini-omni-flash
- https://higgsfield.ai/wan-3-0
- https://higgsfield.ai/minimax/h3
- https://higgsfield.ai/blog/sora-api-migration-guide
- https://higgsfield.ai/sora-2
- https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-dop
- https://higgsfield.ai/effects
- https://higgsfield.ai/ai-motion-design
- https://higgsfield.ai/ai-product-video-generator
- https://higgsfield.ai/blog/how-to-avoid-distortions-ai-videos
- https://higgsfield.ai/plugins/after-effects
- https://higgsfield.ai/ai-video-background-changer
- https://higgsfield.ai/ai-video-upscaler
- https://open.higgsfield.ai/pricing
- https://higgsfield.ai/terms-of-use-agreement
- https://higgsfield.ai/creator-hub/help-center/account/who-owns-my-generations-and-can-i-use-them-commercially
- https://higgsfield.ai/pricing (لم تُقرأ، تُبنى بالجافاسكربت)

**منصّات وإرشادات:**
- Apple HIG، Launching: https://developer.apple.com/design/human-interface-guidelines/launching
- Apple HIG، Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Apple، App previews: https://developer.apple.com/app-store/app-previews/
- Android، Splash screens: https://developer.android.com/develop/ui/views/launch/splash-screen
- Android، Migrate splash screen: https://developer.android.com/develop/ui/views/launch/splash-screen/migrate
- Google Play، Preview assets: https://support.google.com/googleplay/android-developer/answer/9866151
- Expo SplashScreen: https://docs.expo.dev/versions/latest/sdk/splash-screen/
- Reanimated، useReducedMotion: https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/
- Google، Veo: https://ai.google.dev/gemini-api/docs/veo

**أطراف ثالثة [طرف ثالث]:**
- https://aliteq.com/higgsfield-credits-explained
- https://www.versely.studio/blog/higgsfield-pricing-2026
- https://www.atlascloud.ai/blog/tips/kling-4-flash-vs-seedance-2.5
- https://kingy.ai/blog/kling-4-0-product-consistency-pricing-availability/
- https://x.com/Kling_ai/status/2110747537187709424
- https://techjacksolutions.com/ai-brief/openai-videos-api-sora-2-deprecated-september-2026/
- https://artlist.io/blog/negative-prompts-ai-video/ (عن حقل Negative في منصّتهم)
- https://morphlogo.com/blog/higgsfield-alternatives-for-logo-animation (منافس، منحاز)

**من المستودع ومساحة العمل:**
- [`almond-app/DESIGN.md`](../../almond-app/DESIGN.md)، [`almond-app/PRODUCT.md`](../../almond-app/PRODUCT.md)، [`almond-app/app/index.tsx`](../../almond-app/app/index.tsx)، [`almond-app/app.json`](../../almond-app/app.json)، [`almond-app/lib/earnSheet.ts`](../../almond-app/lib/earnSheet.ts)، [`almond-app/lib/launchSheet.ts`](../../almond-app/lib/launchSheet.ts)، [`packages/shared/src/menu/menu.generated.ts`](../../packages/shared/src/menu/menu.generated.ts).
- قياسات الجلسة (حركة افتتاح السوق المفتوح إطاراً إطاراً، وفحص القصّ على الداكن، ومطابقة صور الخريف والمجموعة الدائمة بأرقام المنيو) أُجريت في مساحة عمل مؤقتة لم تُحفظ في الريبو؛ نتائجها مكتوبة في القسمين 1 و2 و3.
