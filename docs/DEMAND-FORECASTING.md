# محرّك التنبؤ بالطلب وأتمتة طلبيات المطبخ لسلسلة Almond Coffee House (عمّان، الأردن)

## TL;DR (الخلاصة في ثلاث نقاط)
- **الطريق الموصى به**: ابدأ بخط أساس seasonal-naïve + معايرة par يدوية، ثم انتقل إلى نموذج LightGBM عالمي هرمي واحد (global model) عبر (فرع × صنف × daypart). هذا يتماشى مع نتائج مسابقة M5 حيث تفوّق LightGBM على كل الطرق الإحصائية وأبلغ عن "أداء تنبؤي أفضل من كل البدائل واستُخدم عملياً من قِبل كل المتصدّرين الخمسين الأوائل تقريباً" (Makridakis وآخرون).
- **من التنبؤ إلى الإنتاج**: حوّل التنبؤ إلى كميات تحضير عبر نموذج بائع الصحف (newsvendor) لاختيار مستوى خدمة لكل صنف حسب هامشه وقابليته للتلف؛ المخبوزات عالية الهامش (تكلفة الطعام ~12–18%) تبرّر critical ratio مرتفعاً.
- **التكامل مع Odoo 19**: Odoo يوفّر التنفيذ (Manufacturing/MRP، Inventory، Reordering Rules، MPS، Purchase) لكن تنبؤه يدوي أساساً؛ يجب بناء محرّك تنبؤ خارجي يغذّي Odoo عبر XML-RPC/JSON-RPC مع إبقاء موافقة بشرية (human-in-the-loop).

## الأهم أولاً (Bottom Line)
أدقّ وأقل مخاطرة مسار لسلسلة Almond هو **بناء نموذج LightGBM هرمي عالمي واحد** يتنبأ بالطلب لكل (فرع × صنف × daypart)، مبنيّ فوق خط أساس seasonal-naïve، ومحوّل آلياً إلى par levels عبر منطق newsvendor، ومربوط بـ Odoo 19 عبر API مع موافقة بشرية — لأن هذا يجمع بين ما أثبتته مسابقة M5 (تفوّق نماذج الأشجار المعزّزة على السلاسل الزمنية الكلاسيكية عند وجود سلاسل كثيرة مترابطة وميزات خارجية) وبين واقع أن Odoo ليس محرّك تنبؤ بل محرّك تنفيذ.

---

## النتائج الرئيسية (Key Findings)

1. **LightGBM هو المعيار الفعلي في تنبؤ التجزئة**. في مسابقة M5 (أكبر منافسة تنبؤ حديثة على بيانات Walmart: 30,490 سلسلة منتج–متجر تُجمَّع إلى 42,840 سلسلة عبر 12 مستوى تجميع)، كانت M5 أول منافسة M يتفوّق فيها التعلّم الآلي الخالص على الطرق الإحصائية البسيطة، [Statistical Modeling](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf) واستعمل LightGBM عملياً كل المتصدّرين الخمسين الأوائل تقريباً. الفائز (YeonJun Im، طالب جامعي في جامعة Kyung Hee) استخدم متوسطاً موزوناً متساوياً لنماذج LightGBM مجمّعة على مستوى المتجر/الفئة/القسم، وحسّن على أفضل benchmark (ES_bu) بنحو 22.4%. الدرس: لا حاجة لشبكات عصبية معقّدة للفوز.

2. **الشبكات العميقة (LSTM/TFT) تميل للإفراط في التخصيص (overfitting) على البيانات القليلة**. الأدبيات تُظهر أن LSTM وLightGBM يمكن أن يفرطا في التخصيص بينما تظل النماذج الجمعية الخفيفة (Prophet) أكثر استقراراً على سلاسل قصيرة؛ ونماذج RNN تعتمد بشدة على اختيار أوزان التهيئة. لسلسلة بعدد فروع محدود وتاريخ قصير، الأنسب هو نموذج عالمي (pooled) تدريبه على كل السلاسل معاً.

3. **الطلب المتقطّع يحتاج طرقاً خاصة**. لأصناف بطيئة الدوران (مثلاً كيك متخصص في فرع صغير) حيث كثير من الفترات = صفر، الطرق الكلاسيكية (SES/MA) تفشل، وطرق عائلة Croston (Croston/SBA/TSB) هي الأساس. [Medium](https://medium.com/@dadhichsagar96/handling-intermittend-demand-4ea5e5c74024) TSB أفضل عند وجود تقادم/توقّف صنف لأنه يحدّث احتمال الطلب في كل فترة حتى الأصفار. [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0925527318300562)

4. **الممارسات العالمية موثّقة جزئياً**: Starbucks (Deep Brew)، Panera (تحوّل par-baked)، Pret (هدر 2.8%)، Crunchtime (suggested ordering/prep)، Lineup.ai (دقة مبيعات ضمن 2–3%). لكن كثير من أرقام "تقليل الهدر 30%" مصدرها مدوّنات مزوّدي التقنية وليست دراسات محكّمة — نميّزها صراحةً كتقديرية/تسويقية.

5. **Odoo 19 ينفّذ لكنه لا يتنبأ ذكياً**: MPS في Odoo يعتمد على إدخال يدوي للطلب المتوقّع؛ [Odoo](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/replenishment.html) Reordering Rules تعمل بـ min/max ثابتة. [Odoo](https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/inventory/warehouses_storage/replenishment/reordering_rules.html) لذا يجب أن يحسب المحرّك الخارجي الأرقام ويكتبها في Odoo.

6. **السياق الأردني حاسم كميزات**: عطلة نهاية الأسبوع جمعة–سبت، الرواتب آخر يوم عمل بالشهر (تُدفع مبكراً قبل الأعياد)، رمضان 2026 (تقديرياً 18 فبراير – 19 مارس) يقلب أنماط النهار/الليل، وفارق حرارة ~20°م بين صيف عمّان (~32–35°م) وشتائها (~14°م نهاراً).

---

## التفاصيل (Details)

### 1) طرق التنبؤ بالطلب

#### 1.1 خط الأساس والسلاسل الزمنية الكلاسيكية
- **Seasonal-naïve** (قيمة نفس اليوم/الفترة من الأسبوع الماضي) هو الأساس الإلزامي. في M5، سجّل نموذج naïve بسيط (شهر سابق ممزوج بسنة سابقة) قيمة **WRMSSE = 0.93946** بالضبط كنقطة مرجعية (بحسب تجربة Christophe Nicault المنشورة).
- **Exponential Smoothing/ETS**: مرجع قوي وسريع؛ استُخدم ETS في دراسات التجزئة كنموذج أساس للتنبؤ الهرمي (وكان أفضل benchmark في M5 هو ES bottom-up).
- **(S)ARIMA/SARIMAX**: مناسب لموسمية واضحة لكنه بطيء جداً على آلاف السلاسل وضعيف على السلاسل المتقطّعة — أحد متسابقي M5 تخلّى عن ARIMA سريعاً لهذا السبب. [Christophe Nicault](https://www.christophenicault.com/post/m5_forecasting_accuracy/) SARIMAX يسمح بإدخال متغيّرات خارجية (طقس، رمضان) كـ regressors؛ وهناك أدبيات ARIMAX مخصّصة لنمذجة "أثر رمضان". [Academia.edu](https://www.academia.edu/1126425/Calendar_variation_model_based_on_ARIMAX_for_forecasting_sales_data_with_Ramadhan_effect)
- **Prophet** (من Meta): جيّد للموسمية المتعددة والعطل، ومستقر نسبياً على بيانات قصيرة، [arXiv](https://arxiv.org/html/2510.20383v1) ويُستخدم غالباً كمولّد ميزات (trend/seasonality/holiday) تُغذّى داخل LightGBM. [Medium](https://medium.com/@tubelwj/time-series-forecasting-with-lightgbm-and-prophet-62caca1a926d)

#### 1.2 التعلّم الآلي
- **Gradient boosting (LightGBM/XGBoost)**: الأفضل عند وجود سلاسل كثيرة مترابطة وميزات خارجية متنوّعة؛ سريع، يتعامل مع فئات ومتغيّرات عددية، ويحتاج ضبط عدد قليل من المعاملات. [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0169207021001874) **متى يتفوّق**: بيانات مجمّعة عبر فروع/أصناف (نموذج عالمي). **متى يفشل**: سلسلة واحدة قصيرة جداً بلا ميزات، أو موسمية بحتة بلا covariates (حينها قد يتفوّق ARIMA). [Towards Data Science](https://towardsdatascience.com/multi-step-time-series-forecasting-with-arima-lightgbm-and-prophet-cc9e3f95dfb0/)
- **LSTM/Temporal Fusion Transformer**: قد تتفوّق مع بيانات ضخمة جداً وأنماط غير خطية معقّدة، لكنها تفرط في التخصيص [Medium](https://medium.com/data-science/multi-step-time-series-forecasting-with-arima-lightgbm-and-prophet-cc9e3f95dfb0) وتحتاج موارد حسابية وضبطاً دقيقاً؛ غير مبرّرة لسلسلة بحجم Almond في المرحلة الأولى.

#### 1.3 الطلب المتقطّع
- **Croston** (1972): يفصل حجم الطلب عن الفترة بين الطلبات ويطبّق SES على كليهما. [arxiv](https://arxiv.org/pdf/2511.12749) منحاز إيجابياً.
- **SBA (Syntetos–Boylan)**: يصحّح انحياز Croston، [MDPI](https://www.mdpi.com/2076-3417/15/22/12030) وغالباً أفضل للأصناف "الملساء/المتذبذبة". [Ersj](https://ersj.eu/journal/1723/download/Accuracy+of+Intermittent+Demand+Forecasting+Systems++in+the+Enterprise.pdf)
- **TSB (Teunter–Syntetos–Babai)**: يحدّث احتمال الطلب بدل الفترة، ويحدّثه في كل فترة (حتى الأصفار)، فيتعامل مع التقادم؛ غير منحاز نظرياً. [HAL](https://hal.science/hal-03421806/document)

#### 1.4 التنبؤ الهرمي والتوفيق (reconciliation)
هرمية Almond الطبيعية: الشبكة → الفرع → الفئة → الصنف → daypart → فترات 15/30 دقيقة.
- **Bottom-up**: يجمع من الأسفل؛ يلتقط الأنماط الدقيقة لكن السلاسل السفلية ضوضائية. [arxiv](https://arxiv.org/pdf/2301.12967)
- **Top-down**: يجزّئ من الأعلى؛ [arxiv](https://arxiv.org/pdf/2201.11964) مستقر لكنه يفقد الأنماط المحلية. [Medium](https://medium.com/@gmw172/demystifying-hierarchical-forecasting-6c0dc585ced8)
- **MinT (Minimum Trace)**: يوفّق كل المستويات معاً بتقليل تباين أخطاء التوفيق؛ [arxiv](https://arxiv.org/pdf/2211.15092) يُعدّ معياراً صناعياً وأفضل دقة إجمالية عادة. [Medium](https://medium.com/@abhishekjainindore24/time-series-20-hierarchial-forecasting-and-forecast-reconciliation-4c9900bb75dd) متاح في مكتبات Python مثل `hierarchicalforecast` من Nixtla وDarts. [Medium](https://medium.com/@gmw172/demystifying-hierarchical-forecasting-6c0dc585ced8)

### 2) الرزنامة والميزات (calendar & features)

**ميزات أساسية**: يوم الأسبوع، daypart، رقم الأسبوع/الشهر، اتجاه (trend)، عمر الصنف (lifecycle)، lag features (مبيعات أمس/الأسبوع الماضي)، متوسطات متحركة.

**التقويم الإسلامي والعطل الأردنية**:
- **عطلة نهاية الأسبوع**: جمعة–سبت رسمياً (العمل الرسمي أحد–خميس، بحسب The National). القطاع الخاص كثيراً ما يعطّل الجمعة فقط. [Atlas HXM](https://www.atlashxm.com/countries/jordan) أمسيات الخميس والجمعة هي ذروة الخروج الاجتماعي.
- **رمضان 2026**: يبدأ تقديرياً الأربعاء 18 فبراير 2026 وينتهي الخميس 19 مارس 2026 (بحسب IslamicFinder، رهناً برؤية هلال رمضان 1447هـ). ينقلب الطلب: انخفاض نهاري حاد أثناء الصيام، وذروة بعد المغرب (إفطار → سحور). يجب معاملته كـ "نظام مختلف" (regime) لا مجرد عطلة.
- **عيد الفطر 2026**: تقديرياً الجمعة 20 مارس 2026؛ **عيد الأضحى 2026**: تقديرياً ~27 مايو (مصادر متعدّدة: Islamic Relief، Muslim Pro). الدفعات الحكومية للرواتب تُقدَّم قبل العيد (Jordan Times، Roya News) [Jordan Times](https://jordantimes.com/news/local/public-sector-salaries-be-paid-eid-%E2%80%94-finance-ministry) — ما يقدّم موجة الإنفاق.
- التقويم الهجري ينزاح ~10–11 يوماً أبكر كل سنة ميلادية، [Tech-labs](https://tech-labs.me/insights/demand-forecasting-guide/) لذا لا يمكن ترميز رمضان كتاريخ ميلادي ثابت؛ الحل هو ميزة هجرية (يوم رمضان 1..30) وأعلام عيد، وهو ما تفعله أدبيات ARIMAX لأثر رمضان.

**الطقس**: عمّان تتراوح ~3°م إلى ~32°م سنوياً (Weather Spark)؛ [Weather Spark](https://weatherspark.com/y/98906/Average-Weather-in-Amman-Jordan-Year-Round) صيف (يونيو–أغسطس) ~32–35°م نهاراً، [Weather Atlas](https://www.weather-atlas.com/en/jordan/amman-climate) شتاء (يناير) ~14°م نهاراً و~5°م ليلاً. [Weather and Climate](https://weather-and-climate.com/average-monthly-min-max-Temperature,Amman,Jordan) الحرارة ترفع المشروبات الباردة؛ الأدبيات تُظهر أثراً غير متماثل: موجات الحر ترفع الطلب على المشروبات ~2.1% لكل درجة بينما موجات البرد أثرها ضئيل (ScienceDirect). **حرج**: توقّعات الطقس المستقبلية متاحة كـ future covariates (7–10 أيام)، لكن يجب استخدام التوقّع وقت اتخاذ القرار لا الفعلي (تجنّب leakage).

**الرواتب**: تُدفع آخر يوم عمل بالشهر (Payoneer، CXC، Asanify) [Payoneer](https://www.payoneer.com/resources/workforce-management/eor-country-guides/jordan/) [CXC](https://www.cxcglobal.com/global-hiring-guide/jordan/payroll-and-benefits-in-jordan/) → ذروة نهاية/بداية الشهر. أضف ميزة "أيام حول الراتب".

**الجامعات**: فصل خريفي (سبتمبر–يناير) وربيعي (فبراير–يونيو) وصيفي مختصر (جامعة الأردن)؛ الطلب الطلابي يقوى في الفصلين ويهبط في فجوات الامتحانات والصيف.

**العروض والأسعار**: أدرج العرض النشط والسعر كميزات (price elasticity)؛ حذار من leakage — لا تُدخل معلومات مستقبلية غير معروفة وقت التنبؤ.

**الأيام الشاذة (outliers)**: عالجها بأعلام (dummy) للعطل والأحداث بدل حذفها، ولا سيّما تصحيح الطلب المبتور (censored demand) في أيام نفاد المخزون.

### 3) ممارسات السلاسل العالمية الموثّقة

| السلسلة | الممارسة الموثّقة | المصدر | التصنيف |
|---|---|---|---|
| **Starbucks** | Deep Brew: كشفه الرئيس التنفيذي Kevin Johnson للمستثمرين عام 2019 على Azure؛ توصية، جدولة عمالة، تنبؤ مخزون، إعادة تزويد آلية؛ يتنبأ بالطلب لكل مكوّن لكل متجر [Aiplusinfo](https://www.aiplusinfo.com/blog/ai-data-driven-starbucks-deep-brew/) | بيانات الشركة + تغطية صحفية | موثّق (بعض الأرقام تقديرية) |
| **Starbucks** | نظام NomadGo للجرد بالرؤية الحاسوبية، "منشور عبر كل متاجر أمريكا الشمالية المُدارة ذاتياً بحلول سبتمبر 2025"، يوفّر "2 إلى 3 ساعات جرد يدوي أسبوعياً لكل متجر" (aiplusinfo.com) | تغطية تقنية | موثّق نسبياً |
| **Panera** | تحوّل من fresh-dough إلى par-baked/frozen يُنهى خبزه بالمتجر طوال اليوم؛ [Restaurant Business Online](https://www.restaurantbusinessonline.com/operations/panera-bread-close-all-remaining-fresh-dough-facilities-over-next-two-years) أعلن الرئيس التنفيذي Paul Carbone في 30 أبريل 2025 إغلاق كل مصانع العجين التسعة المتبقية خلال سنتين (هبوطاً من 24 مصنعاً في 2016) | Nation's Restaurant News, Restaurant Business | موثّق (صحفي) |
| **Pret A Manger** | خبز طازج يومي، صلاحية ساعتين لبعض المخبوزات، وبحسب مديرة الاستدامة Nicky Fisher "يحقّق هدراً بنسبة 2.8% فقط، وهو ممتاز مقارنة بالمتوسط البريطاني ~30%"؛ تبرّع بالفائض + Too Good To Go | Foodservice Footprint | موثّق (رقم الهدر من الشركة) |
| **Crunchtime** | suggested ordering (par − on-hand)، suggested prep، [Crunchtime](https://www.crunchtime.com/blog/benefits-of-recommended-orders) تنبؤ بفترات 15 دقيقة، [Crunchtime](https://www.crunchtime.com/inventory-management/sales-forecasting) وحدة commissary لتخطيط الإنتاج المركزي [Crunchtime](https://crunchtime.com/crunchtime-blog/blog/food-safety-compliance-and-best-practice) (عملاء: Chipotle، Domino's، Dunkin'، Five Guys) | Crunchtime.com | موثّق (ادّعاء مزوّد) |
| **Lineup.ai** | تنبؤ مبيعات/أصناف، شهادة عميل (Cabo Bob's) بدقة "ضمن 2% أو 3% من المبيعات الفعلية" | Lineup.ai | موثّق كشهادة عميل (غير مستقل) |

**تنبيه المصداقية**: أرقام مثل "تقليل الهدر 30–40%" [SynergySuite](https://www.synergysuite.com/blog/ai-demand-forecasting-for-multi-unit-restaurants/) أو "تحسين الدقة 27%" [Crunchtime](https://www.crunchtime.com/blog/how-to-translate-restaurant-sales-forecasts-into-better-prep-ordering-and-labor-planning) أو إيرادات Deep Brew المنسوبة (~2.5 مليار دولار عبر رفع المبيعات 15% ومتوسط الطلب 12%، aiplusinfo.com) — تقديرية/مملوكة أو تسويقية، ليست دراسات محكّمة.

منصّات أخرى مذكورة في المصادر: Restaurant365، Fourth/HotSchedules، MarginEdge، MarketMan، 7shifts، ClearCOGS، Blue Yonder، RELEX، Oracle MICROS/Simphony، Nory. (لم أتمكّن من التحقّق المستقل من ادّعاءات كل منها ضمن هذا البحث؛ أذكرها كخيارات سوقية.)

### 4) من التنبؤ إلى كميات التحضير

#### 4.1 نموذج بائع الصحف (newsvendor) — مثال رقمي بالدينار
الصيغة: **Critical Ratio (CR) = Cu / (Cu + Co)**، حيث Cu = تكلفة النقص (الربح الضائع)، Co = تكلفة الفائض (تكلفة الهالك). [MetricGate](https://metricgate.com/docs/newsvendor-model/)

**مثال — كرواسون في فرع Almond**:
- سعر البيع = 2.50 دينار، تكلفة الإنتاج ≈ 0.40 دينار (تكلفة طعام ~16%، متسقة مع مرجع 12–18% للمخبوزات). [Vellin](https://vellinapp.com/blog/bakery-food-cost-percentage)
- Cu (نقص) = السعر − التكلفة = 2.50 − 0.40 = **2.10 دينار** ربح ضائع لكل قطعة لم تُنتَج.
- Co (فائض) = التكلفة − قيمة الإنقاذ. إذا كان الهالك كاملاً (salvage = 0) → Co = **0.40 دينار**.
- **CR = 2.10 / (2.10 + 0.40) = 0.84** → مستوى خدمة مستهدف 84%.
- إذا كان الطلب اليومي في daypart الصباح ~ توزيع طبيعي بمتوسط μ=40 وانحراف σ=12:
  - z(0.84) ≈ 0.994
  - **الكمية المثلى Q\*** = μ + z·σ = 40 + 0.994×12 ≈ **52 كرواسون**.

هذا يوضّح جوهر النموذج: الأصناف عالية الهامش/قابلة التلف الجزئي (كرواسون) تبرّر مستوى خدمة عالياً لأن تكلفة خسارة بيع أكبر بكثير من تكلفة رمي قطعة. لو كان الصنف باهظ التكلفة وسريع التلف (مثلاً كيك بقيمة إنقاذ صفر وتكلفة عالية)، ينخفض CR ويقترب Q من "بِع كل المخزون". [Stitchfix](https://multithreaded.stitchfix.com/blog/2019/11/21/newsvendor-model/)

#### 4.2 par levels وsafety stock
- **Par level** لكل (فرع × صنف × daypart) = الطلب المتوقّع + مخزون أمان.
- **Safety stock** = z × σ_demand × √(lead time) [NetSuite](https://www.netsuite.com/portal/resource/articles/inventory-management/safety-stock.shtml) (صيغة أساسية عند ثبات lead time). للتحضير الداخلي (خبز فوري) lead time قصير جداً، فالتباين يأتي أساساً من الطلب.
- **Reorder point** = (متوسط الطلب اليومي × lead time) + safety stock. [Eoxs](https://eoxs.com/new_blog/safety-stock-and-reorder-point-determination/)
- قيود: **shelf-life** (رمي نهاية الفترة)، **minimum batch size** (لا تخبز نصف صينية)، وأوراق تحضير (prep sheets) لكل daypart مع **الخبز على موجات** (batch waves) لإبقاء منتج طازج بعد الظهر بدل تحميل اليوم كله صباحاً. [Brik](https://www.brik.ly/blog/cutting-end-of-day-waste-cafe-bakery-production-planning/)

#### 4.3 lead time، الموردين، المحمصة/المطبخ المركزي
- طلبيات المخزون: min/max، reorder point، مراجعة دورية (periodic review).
- المحمصة/المطبخ المركزي (commissary): يخطّط الإنتاج بتجميع تنبؤات الفروع، ثم يوزّع؛ عند نقص الإنتاج استخدم **allocation/fair-share** (توزيع نسبي حسب التنبؤ).
- **BoM explosion**: حوّل تنبؤ الأصناف النهائية إلى احتياجات مكوّنات عبر قوائم المواد ونسب الهالك/العائد (yield). Odoo يدعم ذلك عبر MRP/BoM.

### 5) الأتمتة وحلقة إغلاق البيانات

- **POS depletion**: خصم آلي للمخزون من المبيعات (Crunchtime يفعل هذا).
- **auto-suggested orders**: النظام يحسب (par − on-hand − pending) ويقترح؛ [Crunchtime](https://www.crunchtime.com/blog/benefits-of-recommended-orders) مع **human-in-the-loop** (موافقة المدير) في البداية.
- **Cold start**: لصنف/فرع جديد بلا تاريخ، استخدم نموذجاً عالمياً (global/pooled) ينقل التعلّم من أصناف/فروع مشابهة (transfer learning — أثبتت أبحاث M5 خفض زمن التدريب ~25% مع الحفاظ على الدقة)، [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0169207021001606) أو استخدم صنفاً مشابهاً كوكيل (proxy) حتى تتراكم البيانات.
- **Odoo 19**: الوحدات ذات الصلة: Manufacturing/MRP (BoM، MO)، Inventory (Reordering Rules، Replenishment report، horizon/visibility days)، MPS (تخطيط طويل المدى بإدخال يدوي)، Purchase (RFQ)، Quality. **حدود Odoo**: MPS يعتمد إدخالاً يدوياً للطلب المتوقّع، [Odoo](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/replenishment.html) [Odoo](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/manufacturing/workflows/use_mps.html) وReordering Rules تستخدم min/max ثابتة [Odoo](https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/inventory/warehouses_storage/replenishment/reordering_rules.html) — لا يوجد محرّك ML أصيل. **الحل**: محرّك خارجي يحسب par/forecast ويكتبه في Odoo عبر XML-RPC/JSON-RPC (Odoo 19 Enterprise يدعم الثلاثة: XML-RPC، JSON-RPC، REST؛ ومفاتيح API بدل كلمة المرور منذ Odoo 13). [ECOSIRE](https://ecosire.com/blog/odoo-api-integration-development)

### 6) المعايرة وقياس الدقة

**المقاييس**:
- **WMAPE/WAPE**: عملي ومفهوم تجارياً؛ أفضل من MAPE عند وجود أصفار.
- **MASE**: مقياس غير معتمد على المقياس، يقارن بـ naïve؛ MASE<1 يعني تفوّقاً على seasonal-naïve. مناسب للأصناف المختلفة المقاييس.
- **RMSSE/WRMSSE**: مقياس M5 الرسمي؛ يتعامل مع الطلب المتقطّع بأمان لأنه لا يقسم على قيم قد تساوي صفراً. [Statistical Modeling](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- **Pinball loss**: للتنبؤ الاحتمالي/الكمّي (quantile) — مهم لأن par level هو أساساً كمّية (quantile) من توزيع الطلب.
- **تحذير**: MAE/MAPE غير مناسبة للطلب شديد التقطّع (الحل الصفري قد يبدو "أفضل" لأن الصفر هو الوسيط الشرطي) [arxiv](https://arxiv.org/pdf/2204.08283) — استخدم RMSSE + الانحياز.
- **الانحياز (bias/tracking signal)**، **مستوى الخدمة المحقّق**، و**نسبة الهدر** مقاييس تشغيلية إلزامية.

**Backtesting**: rolling-origin / time-series cross-validation (ليس تقسيماً عشوائياً)، إعادة معايرة دورية، مراقبة drift.

**FVA (Forecast Value Added)**: قِس هل كل خطوة (إحصائي ثم ML ثم تعديل بشري) تضيف قيمة مقابل naïve. تقرير Newell Rubbermaid الشهير (منقول في أدبيات Gilliland) أظهر أن التعديل البشري أحياناً يعطي **قيمة سالبة**: الـ naïve حقّق دقة 60%، والإحصائي رفعها إلى 65% (+5%)، لكن "التعديل الإداري" خفضها إلى 62% (−3% مقابل الإحصائي). استخدم FVA لتقرير متى تتدخّل يدوياً.

**معايير مرجعية للهدر**: Pret 2.8% (ممتاز)، متوسط بريطاني ~30% (المصدر نفسه)؛ دراسة جامعة أريزونا 2005: الهدر ~9.55% في الوجبات السريعة و3.11% في الخدمة الكاملة (أمريكا). [Proformative](https://www.proformative.com/questions/what-normal-range-food-waste-percentage-food-purchases/) هذه أرقام قديمة/سياقية، استخدمها كدلالة لا كهدف صارم.

---

## التوصية العملية المرحلية لـ Almond (القسم الأهم)

### مخطط البيانات (Data Schema) الذي يجب تسجيله الآن
لكل **بند طلب (order line)** سجّل:
- `event_time_utc` (تخزين UTC) + `event_time_amman` (عرض Asia/Amman) — **حرج**: خزّن UTC واعرض محلياً لتجنّب أخطاء التوقيت الصيفي.
- `branch_id`, `channel` (app/web/cashier/delivery), `daypart`, `item_id`, `qty`, `unit_price`, `active_promo_id`.
- `stockout_flag` (هل كان الصنف نافداً؟) — **حرج لتصحيح censored demand**؛ بدونه ستتعلّم النماذج طلباً أقل من الحقيقي.
- `weather_snapshot` (حرارة/مطر متوقّعة ذلك اليوم) و`weather_actual`.
- أعلام رزنامة: `dow`, `is_weekend` (جمعة/سبت), `hijri_day`, `is_ramadan`, `ramadan_day` (1..30), `is_eid`, `days_to_payday`, `is_university_session`.

### الجدول الزمني المرحلي

**المرحلة 0 — التأسيس (أسابيع 0–6)**
- تفعيل تسجيل الـ schema أعلاه من التطبيق/الموقع/BFF/POS.
- بناء seasonal-naïve baseline + par يدوية (متوسط متحرك 4 أسابيع لكل فرع×صنف×daypart).
- **الحد الأدنى للبيانات للانتقال**: على الأقل تسجيل نظيف يبدأ الآن؛ للانتقال للمرحلة 1 يُفضّل **8–13 أسبوعاً** لالتقاط نمط أسبوعي مستقر.

**المرحلة 1 — نموذج إحصائي + par آلية (أشهر 2–4)**
- ETS/Prophet لكل فرع×فئة + Croston/TSB للأصناف المتقطّعة.
- حساب par آلياً عبر newsvendor؛ prep sheets تُطبع لكل daypart.
- **الحد الأدنى**: ~3 أشهر بيانات.

**المرحلة 2 — LightGBM هرمي عالمي (أشهر 4–9)**
- نموذج LightGBM عالمي واحد على كل السلاسل + ميزات الرزنامة/الطقس/الرواتب + توفيق MinT.
- **الحد الأدنى الموصى به**: **~12 شهراً** لالتقاط دورة سنوية كاملة (خصوصاً رمضان الذي يتحرّك) — قبلها استخدم أعلام رمضان الصريحة كتعويض.

**المرحلة 3 — أتمتة مغلقة + احتمالي (أشهر 9+)**
- تنبؤ كمّي (quantile) لتغذية par مباشرة؛ auto-suggested orders في Odoo مع موافقة.
- تنبؤ احتمالي مقيّم بـ pinball loss.

### خوارزمية par level (شبه-كود قابل للتنفيذ)

```
FUNCTION compute_par(branch, item, daypart, date):
    # 1) تنبؤ الطلب (نموذج عالمي) + توزيعه
    mu, sigma = forecast_demand(branch, item, daypart, date, features)

    # 2) تصحيح الطلب المبتور في الأيام السابقة (censored demand)
    mu = adjust_for_stockouts(mu, historical_stockout_flags)

    # 3) اقتصاديات الصنف
    Cu = price[item] - cost[item]              # تكلفة النقص
    Co = cost[item] - salvage[item]            # تكلفة الفائض (salvage=0 للمخبوزات عادة)
    CR = Cu / (Cu + Co)                        # critical ratio
    CR = clip(CR, 0.50, 0.98)                  # حدود عملية لمستوى الخدمة

    # 4) الكمية المثلى (newsvendor، افتراض طبيعي؛ أو استخدم الكمّية التجريبية)
    z = inverse_normal_cdf(CR)
    Q_star = mu + z * sigma

    # 5) قيود التشغيل
    Q = round_up_to_batch(Q_star, min_batch[item])   # حجم الدفعة الأدنى
    Q = apply_shelf_life_cap(Q, shelf_life[item], remaining_dayparts)
    par = max(Q, min_display[item])            # حد أدنى للعرض/التقديم

    RETURN par

# التحويل إلى طلبية:
suggested_order = max(0, par - on_hand - pending_incoming)
# ثم يُكتب في Odoo عبر XML-RPC كـ MO/PO مقترح ينتظر موافقة
```

### خطة أتمتة طلبيات المطبخ والربط بـ Odoo
1. المحرّك الخارجي يحسب forecast + par يومياً/لكل daypart.
2. يكتب `Forecasted Demand` في MPS أو يحدّث min/max في Reordering Rules عبر XML-RPC/JSON-RPC.
3. Odoo يولّد MO (تصنيع/خبز) أو PO/RFQ (شراء) [Odoo](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/replenishment/reordering_rules.html) — **مقترحة** لا مؤكّدة.
4. المدير يوافق (human-in-the-loop) → تنفيذ → POS depletion يخصم آلياً → البيانات تعود لإعادة المعايرة.

### مؤشرات الأداء (KPIs) لكل مرحلة
- **الدقة**: WMAPE، MASE، RMSSE، الانحياز (bias). الهدف: MASE < 1 (تفوّق على naïve).
- **التشغيل**: نسبة الهدر (%) (استهدف اتجاهاً نحو خانة أحادية مثل Pret 2.8%)، مستوى الخدمة المحقّق (% أيام بلا نفاد)، معدّل نفاد الأصناف عالية الطلب.
- **الحوكمة**: FVA (هل تعديل المدير يضيف قيمة؟).

### المخاطر الشائعة وتجنّبها
- **censored demand**: بدون stockout_flag ستقلّل النماذج التنبؤ باستمرار → سجّل النفاد وصحّح.
- **data leakage**: استخدم توقّع الطقس المتاح وقت القرار لا الفعلي.
- **رمضان المتحرّك**: لا تُرمّزه كتاريخ ميلادي ثابت → استخدم ميزات هجرية.
- **الإفراط في الأتمتة**: قصة Starbucks تحذّر — Deep Brew حسّن الأرقام على الورق لكنه أرهق الباريستا (حتى التزم الرئيس التنفيذي الجديد Brian Niccol عام 2025 بإنفاق نصف مليار دولار لتوظيف بشر إضافيين)؛ أبقِ الإنسان في الحلقة.
- **overfitting بنموذج معقّد مبكراً**: ابدأ بسيطاً (naïve/ETS) وارتقِ فقط عند إثبات FVA موجب.

---

## التوصيات (Recommendations)
1. **الآن (0–6 أسابيع)**: فعّل schema التسجيل الكامل (خاصة stockout_flag، UTC+Amman، أعلام الرزنامة الهجرية). ابنِ seasonal-naïve + par يدوية. **عتبة الانتقال**: 8–13 أسبوع بيانات نظيفة.
2. **قصير المدى (2–4 أشهر)**: ETS/Prophet + Croston/TSB للمتقطّع، وحساب par آلي عبر newsvendor. راقب WMAPE وMASE ونسبة الهدر.
3. **متوسط المدى (4–9 أشهر)**: انتقل إلى LightGBM عالمي هرمي + MinT عند توفّر ~12 شهراً. أدخل الطقس كـ future covariate والرواتب/الجامعات/رمضان كميزات.
4. **طويل المدى (9+ أشهر)**: تنبؤ كمّي (pinball) + أتمتة مغلقة مع Odoo وموافقة بشرية.
5. **عتبات تغيّر القرار**: إذا كان MASE ≥ 1 (لا يتفوّق النموذج على naïve) لا تنشر النموذج المعقّد؛ إذا أعطى التعديل البشري FVA سالباً، قلّل التدخّل اليدوي؛ إذا تجاوز الهدر ~10% راجع مستويات الخدمة تنازلياً للأصناف منخفضة الهامش.

## التحفّظات (Caveats)
- كثير من أرقام تقليل الهدر/تحسين الدقة (30–40%، 27%) وإيرادات Deep Brew المنسوبة **تقديرية/تسويقية** من مزوّدي التقنية، ليست محكّمة.
- تفاصيل Deep Brew وأنظمة السلاسل **مملوكة (proprietary)**؛ المتاح عام/صحفي وقد يبالغ.
- تواريخ 2026 الإسلامية **تقديرية** (رؤية هلال، ±يوم)؛ رمضان يبدأ تقديرياً 18 فبراير 2026 وعيد الفطر 20 مارس 2026.
- لم أتمكّن من التحقّق المستقل من ادّعاءات كل منصّة تجارية، ولا من أرقام هامش/تكلفة Almond الفعلية (استخدمت افتراضات معقولة في المثال الرقمي — عايرها ببياناتك الحقيقية).
- تعذّر استخراج التواريخ اليومية الدقيقة لتقويم جامعة الأردن 2025/2026 من البوابة الرسمية؛ النوافذ الفصلية العامة موثوقة لكن يُنصح بالتحقّق من بوابة التسجيل الرسمية.