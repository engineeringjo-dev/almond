# صور القائمة: التغطية والناقص

> قِيس من القائمة المسحوبة من أودو (`packages/shared/src/menu/menu.generated.ts`، آخر سحب 2026-09-25). المبيعات من `menu.insights.generated.ts` (طلبات أودو المدفوعة في 45 يوماً).

## الأرقام

- **375** صنفاً في القائمة، لها صورة **308** (82%).
- بلا صورة **67** صنفاً، منها **41** صنفاً لها طلبات فعلية.
- **33** صنفاً بلا اسم عربي في أودو (يظهر اسمها الإنجليزي في التطبيق العربي).

## كيف تصل الصور

1. الصورة تُرفع على **المنتج نفسه في أودو** (حقل الصورة).
2. السحب اليومي (`.github/workflows/menu-sync.yml`، كل يوم 02:30 UTC) ينزّلها ويحوّلها إلى WebP بعرض 512 بكسل في `almond-app/public/menu/` و`almond-web/public/menu/`، وتصل التطبيق والموقع بلا إصدار جديد.
3. **السحب اليومي متوقّف الآن:** أسرار المستودع الأربعة غير مضبوطة — `ODOO_URL` و`ODOO_DB` و`ODOO_LOGIN` و`ODOO_API_KEY` (GitHub → Settings → Secrets and variables → Actions). يُفضَّل مستخدم أودو مخصّص للقراءة فقط.

**أفضل صورة:** المنتج وحده على خلفية بيضاء، مربّعة، بالكوب المطبوع بشعار ألموند — مثل 306 من الصور الحالية. التطبيق يضعها على لوح أبيض في الوضعين الفاتح والداكن.

## الأصناف بلا صورة (الأكثر طلباً أولاً داخل كل فئة)

### ساوردو (Sourdough) — 7

| الصنف | Item | الطلبات في 45 يوماً |
|---|---|---|
| ساوردو مع جبنة الشيدر | Chedder Sourdough | 95 |
| Salmon Cheese Sourdough | Salmon Cheese Sourdough | 55 |
| ساوردو مع أومليت و3 أنواع جبن | 3 Cheese Omelette Sourdough | 52 |
| Omelette Cheese Sourdough | Omelette Cheese Sourdough | 46 |
| ساوردو مع أفوكادو وشرائح بيض | Avocado Egg Sourdough | 37 |
| Egg Cheese Sourdough | Egg Cheese Sourdough | 21 |
| Cream Cheese Sourdough | Cream Cheese Sourdough | 17 |

### قهوة مختصة مثلجة (Iced Specialty Coffee) — 2

| الصنف | Item | الطلبات في 45 يوماً |
|---|---|---|
| Iced Cappuccino Cold Foam | Iced Cappuccino Cold Foam | 35 |
| Iced Americano Cold Foam | Iced Americano Cold Foam | 16 |

### ميني بايتس (Mini Bites) — 52

| الصنف | Item | الطلبات في 45 يوماً |
|---|---|---|
| ميني بلوبيري تشيز كيك | Mini Blueberry Cheesecake | 3 |
| ميني براونيز | Mini Brownie | 3 |
| ميني حلوم ساندويش | Mini Halloumi Sandwich | 3 |
| ميني مانجو تارت | Mini Mango Tart | 3 |
| ميني روست بيف ساندويش | Mini Roast Beef Sandwich | 3 |
| ميني تارت الفراولة | Mini Strawberry Tart | 3 |
| ميني تيراميسو | Mini Tiramisu Cup | 3 |
| ميني الفريدو ساندوش | Mini Alfredo Chicken Sandwich | 2 |
| ميني كاروت كيك | Mini Carrot Cake | 2 |
| ميني شوكلت مفن | Mini Chocolate Muffin | 2 |
| ميني حلوم بيجل | Mini Halloum Bagel | 2 |
| ميني مانجو دانش | Mini Mango Danish | 2 |
| ميني سلطة كينوا | Mini Quinoa Salad | 2 |
| ميني فراولة دانش | Mini Strawberry Danish | 2 |
| ميني تيركي كرواسان | Mini Turkey Croissant | 2 |
| ميني زعتر كرواسان | Mini Zatar Croissant | 2 |
| ميني الموند كرواسان | Mini Almond Croissant | 1 |
| ميني بلوبيري مفن | Mini Blueberry Muffin | 1 |
| ميني كرواسان جبنة | Mini Cheese Croissant | 1 |
| ميني تشاينيز ساندويش | Mini Chinese Chicken Sandwich | 1 |
| ميني كرنكل كوكي | Mini Crinkle Cookie | 1 |
| ميني كاسترد ايكلير | Mini Custard Eclair | 1 |
| ميني ماسترد ساندويش | Mini Honey Mustard Chicken Sandwich | 1 |
| ميني ليمون بوبي سيد كيك | Mini Lemon Poppyseed Cake | 1 |
| ميني نوتيلا مفن | Mini Nutella Muffin | 1 |
| ميني رمان تشيز كيك | Mini Pomegranate Cheesecake | 1 |
| ميني سالمون بيغل | Mini Salmon Bagel | 1 |
| ميني تيركي تشيز بيجل | Mini Turkey Cheese Bagel | 1 |
| Fruit Salad Cup | Fruit Salad Cup | 0 |
| ميني بلوبيري تارت | Mini Blueberry Tart | 0 |
| ميني بلوبيري مفن كاسة | Mini Blueberry Trifle | 0 |
| ميني بافلو ساندويش | Mini Bufallo Chicken Sandwich | 0 |
| ميني كابريس سلطة | Mini Caprese Salad Skewer | 0 |
| ميني سلطة سيزر | Mini Chicken Ceaser Salad | 0 |
| ميني سلطة باستا | Mini Chicken Pasta Salad | 0 |
| ميني تشايف دانش | Mini Chives Cheese Danish | 0 |
| ميني شوكلت شيب كوكي | Mini Chocolate Chip Cookie | 0 |
| ميني شوكلت ايكلير | Mini Chocolate Eclair | 0 |
| ميني شوكلت موس | Mini Chocolate Mousse Cup | 0 |
| ميني شوكلت تارت | Mini Chocolate Tart | 0 |
| ميني كردتس | Mini Crudits | 0 |
| ميني ليمون تشيز كيك | Mini Lemon Cheesecake | 0 |
| ميني ميكسيكان ساندويش | Mini Mexican Checken Sandwich | 0 |
| MINI MILLE FEUILLE VANILLE | Mini Mille Feuille Vanille | 0 |
| ميني سلطة ناتشوز | Mini Nachos Salad | 0 |
| ميني اكلير بيستاشيو | Mini Pistachio Eclair | 0 |
| ميني بيستاشيو تارت | Mini Pistachio Tart | 0 |
| ميني كرواسان عادي | Mini Plain Croissant | 0 |
| ميني رازبيري بانا كوتا | Mini Raspberry Panna Cotta | 0 |
| ميني روست بيف بيجل | Mini Roast Beef Bagel | 0 |
| ميني سلطة روكا | Mini Rocca Salad | 0 |
| ميني تيركي ساندويش | Mini Turkey Sandwich | 0 |

### كيك كامل خالٍ من الجلوتين (Gluten-free Full Cake) — 4

| الصنف | Item | الطلبات في 45 يوماً |
|---|---|---|
| قالب شوكولاتة بالبندق كيتو | Keto Chocolate Hazelnut Full Cake | 5 |
| قالب بيكان تشيز كيك كيتو | Keto Pecan Full Cheesecake | 1 |
| قالب كيك ماربل كيتو | Keto Marble Full Cake | 0 |
| قالب كيك شوكولاتة بالموز كيتو | Sugar Free Banana Chocolate Full Cake | 0 |

### شاي (Tea) — 1

| الصنف | Item | الطلبات في 45 يوماً |
|---|---|---|
| شاي احمد | Ahmad Tea | 5 |

### بينتو كيك (Bento Cake) — 1

| الصنف | Item | الطلبات في 45 يوماً |
|---|---|---|
| كيكة بينتو ليمون | Bento Lemon Cake | 1 |

## الأصناف بلا اسم عربي في أودو

تُصحَّح في أودو (حقل الاسم بالعربية للمنتج)، ويصل التصحيح مع السحب التالي.

| Item | الفئة | الطلبات في 45 يوماً |
|---|---|---|
| Turkish Coffee | Hot Specialty Coffee | 4013 |
| Espresso | Hot Specialty Coffee | 2451 |
| Mango & Passion Orange Juice | Iced Tea And Fresh Juices | 1834 |
| Cortado | Hot Specialty Coffee | 829 |
| Candles 1 | Sides | 432 |
| Candles 2 | Sides | 415 |
| Iced Strawberry Matcha Latte | Iced Tea And Fresh Juices | 374 |
| Iced Pistachio Latte | Iced Specialty Coffee | 265 |
| Espresso Machiato | Hot Specialty Coffee | 129 |
| Candles 4 | Sides | 110 |
| Pistachio Latte | Hot Specialty Coffee | 109 |
| Frozen Yogurt Cup - Sugar Free | Cake Pieces & Sweets | 81 |
| Frozen Yogurt Cup | Cake Pieces & Sweets | 56 |
| Salmon Cheese Sourdough | Sourdough | 55 |
| Tea Bag To Go | Tea | 47 |
| Omelette Cheese Sourdough | Sourdough | 46 |
| Steamed Milk | Hot Chocolate | 40 |
| V60 Filters / Size 02 | Specialty Coffee Tools | 39 |
| Iced Cappuccino Cold Foam | Iced Specialty Coffee | 35 |
| French Press | Hot Specialty Coffee | 28 |
| Egg Cheese Sourdough | Sourdough | 21 |
| Cream Cheese Sourdough | Sourdough | 17 |
| Iced Americano Cold Foam | Iced Specialty Coffee | 16 |
| Hairo V60 Plastic Coffee Dripper | Specialty Coffee Tools | 3 |
| Mini Margherita Pizza | Pizza | 3 |
| Hario V60 Range Server | Specialty Coffee Tools | 2 |
| Mini Pepperoni Pizza | Pizza | 2 |
| Hario V60 Craft Coffee Maker | Specialty Coffee Tools | 1 |
| Candles 3 | Sides | 0 |
| Fruit Salad Cup | Mini Bites | 0 |
| Hario Ceramic Coffee Grinder Skerton | Specialty Coffee Tools | 0 |
| Mini Hairo Ceramic Coffe Grinder Skerton | Specialty Coffee Tools | 0 |
| Mini Mille Feuille Vanille | Mini Bites | 0 |

> ملاحظة: في أودو خطأ إملائي «قهموة» في اسم أحد الأصناف (بدل «قهوة»).
