/**
 * ─────────────────────────────────────────────────────────────────────────
 *  Almond × Ishbek — سكربت سامبل توضيحي (Careem / Talabat)
 *  الهدف: نشرح لفريق Ishbek 3 أشياء بمثال كود واقعي:
 *    (1) التوقيت  — متى نطلب الكابتن حتى يوصل الفرع لحظة جهوزية الطلب.
 *    (2) الموديفاير — كيف نمرّر تخصيص كل صنف (حجم/حليب/سكر/إضافات) للمطبخ والكابتن.
 *    (3) عكس كريم/طلبات حسب العميل — كيف نختار الأسطول حسب عنوان الزبون.
 *
 *  ملاحظة: الحقول مبنية على أنواعنا الفعلية (@almond/shared/types) + نقاط
 *  Ishbek المعرّفة عندنا. الأسماء النهائية للحقول تتأكد من وثائق Ishbek الرسمية.
 * ─────────────────────────────────────────────────────────────────────────
 */

// ======= أنواعنا المختصرة (نفس شكل @almond/shared/types) =======
interface CartCustomization {
  groupId: string;   // مثال: "milk" | "sugar" | "extras"  (نفس id الموديفاير بأودو/طلبات)
  optionId: string;  // مثال: "oat" | "no-sugar" | "extra-shot"
  nameAr: string;
  nameEn: string;
  priceDelta: number; // د.أ تُضاف لسعر السطر
}
interface CartItem {
  lineId: string;
  itemId: string;
  nameAr: string;
  nameEn: string;
  sizeId: 'S' | 'M' | 'L';
  sizeNameAr: string;
  unitBasePrice: number;
  customizations: CartCustomization[];
  qty: number;
  prepMinutes?: number; // زمن تحضير هذا الصنف
}
interface CustomerAddress {
  lat: number;
  lng: number;
  text: string;   // "خلدا، عمّان"
  city: 'amman';
}

type Fleet = 'careem' | 'talabat';


/* ═══════════════════════════════════════════════════════════════════════
 * (1) التوقيت — نزامن جهوزية الطلب مع وصول الكابتن للفرع
 *
 * القاعدة عنا: زمن الجهوزية = max(زمن التحضير, زمن وصول الكابتن للفرع).
 *   - ما بدنا الأكل يجهز ويبرد وينتظر الكابتن.
 *   - وما بدنا الكابتن يوصل ويقعد ينتظر الأكل.
 * الحل: نبعث لـ Ishbek "الطلب جاهز خلال prepMinutes"، وهي تجدول الكابتن
 * حتى يوصل الفرع عند تلك اللحظة تماماً (scheduled pickup).
 * ═════════════════════════════════════════════════════════════════════ */
function estimatePrepMinutes(items: CartItem[]): number {
  // التحضير على التوازي → أطول صنف يحكم، مش المجموع.
  return items.reduce((max, l) => Math.max(max, l.prepMinutes ?? 5), 0);
}

// الأردن = Asia/Amman ثابت UTC+3. كل طابع زمني لازم يحمل offset صريح +03:00،
// مش `Z` مجرّد — هذا اللي بيخلي الأوردر ينعكس على نقطة البيع. (نفس منطق
// toAmmanISO بـ @almond/shared/lib/format، مُضمّن هون عشان السامبل مستقل.)
function toAmmanISO(ms: number): string {
  const d = new Date(ms);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Amman', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(d).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const off = Math.round((asUTC - d.getTime()) / 60000);
  const sign = off >= 0 ? '+' : '-';
  const oh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
  const om = String(Math.abs(off) % 60).padStart(2, '0');
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${sign}${oh}:${om}`;
}

function buildDispatchTiming(items: CartItem[], orderPlacedAtISO: string) {
  const prep = estimatePrepMinutes(items);
  const placed = new Date(orderPlacedAtISO).getTime();
  return {
    // اللحظة اللي بدنا الكابتن يكون فيها بالفرع = وقت الطلب + زمن التحضير
    readyAt: toAmmanISO(placed + prep * 60_000), // +03:00 صريح، مش Z
    prepMinutes: prep,
    // Ishbek تحسب زمن سير الكابتن للفرع وتطلبه قبلها بالمقدار المناسب.
    schedulePickup: true,
  };
}


/* ═══════════════════════════════════════════════════════════════════════
 * (2) الموديفاير — تحويل تخصيص كل صنف لصيغة يفهمها المطبخ + الكابتن
 *
 * كل سطر بالسلة فيه: حجم (size) + قائمة تخصيصات (حليب/سكر/ثلج/إضافات).
 * منحوّلها لبنية modifiers مسطّحة مع الأسعار، عشان:
 *   - المطبخ (KDS) يشوف بالضبط شو يحضّر.
 *   - Ishbek/الكابتن يعرف محتوى الطلب وسعره الصحيح.
 * ═════════════════════════════════════════════════════════════════════ */
function toIshbekLine(item: CartItem) {
  const modifiers = [
    // الحجم كموديفاير أول (single-choice)
    { groupId: 'size', optionId: item.sizeId, name: item.sizeNameAr, priceDelta: 0 },
    // باقي التخصيصات (حليب/سكر/ثلج/إضافات...)
    ...item.customizations.map((c) => ({
      groupId: c.groupId,
      optionId: c.optionId,
      name: c.nameAr,
      priceDelta: c.priceDelta,
    })),
  ];

  const unitPrice =
    item.unitBasePrice + item.customizations.reduce((s, c) => s + c.priceDelta, 0);

  return {
    itemId: item.itemId,
    name: item.nameAr,
    qty: item.qty,
    unitPrice: Number(unitPrice.toFixed(3)), // صيغة X.XXX د.أ
    modifiers, // ← المطبخ والكابتن يقروا التخصيص كامل من هون
  };
}


/* ═══════════════════════════════════════════════════════════════════════
 * (3) عكس كريم/طلبات "حسب العميل" — اختيار الأسطول حسب عنوان الزبون
 *
 * الفكرة: نفس الطلب من موقعنا يُدفع لأسطول كريم *أو* طلبات، ويُختار حسب:
 *   1) التغطية: مين يغطي منطقة الزبون (بعض المناطق كريم بس، بعضها طلبات بس).
 *   2) لو الاثنين يغطّوا → الأرخص/الأسرع (fee + ETA من quote).
 * القرار النهائي فعلياً بتاخذه Ishbek (broker)، بس هون نبيّن المنطق حسب العميل.
 * ═════════════════════════════════════════════════════════════════════ */
interface FleetQuote { fleet: Fleet; covered: boolean; fee: number; etaMinutes: number }

function chooseFleetForCustomer(quotes: FleetQuote[]): Fleet | null {
  const available = quotes.filter((q) => q.covered);
  if (available.length === 0) return null; // لا كريم ولا طلبات يغطي → نعرض "توصيل غير متاح لعنوانك"
  // نفضّل الأرخص، وعند التعادل الأسرع.
  available.sort((a, b) => a.fee - b.fee || a.etaMinutes - b.etaMinutes);
  return available[0].fleet;
}


/* ═══════════════════════════════════════════════════════════════════════
 *  الطلب الكامل المُرسل لـ Ishbek  (POST /delivery/dispatch)
 * ═════════════════════════════════════════════════════════════════════ */
function buildIshbekDispatch(params: {
  orderId: string;
  branch: string;
  items: CartItem[];
  address: CustomerAddress;
  orderPlacedAtISO: string;
  quotes: FleetQuote[];
}) {
  const fleet = chooseFleetForCustomer(params.quotes);
  if (!fleet) throw new Error('DELIVERY_UNAVAILABLE — لا يوجد أسطول يغطي عنوان الزبون');

  const timing = buildDispatchTiming(params.items, params.orderPlacedAtISO);

  return {
    orderId: params.orderId,
    branch: params.branch,
    preferredFleet: fleet,          // (3) كريم أو طلبات حسب العميل
    dropoff: params.address,        // عنوان الزبون
    readyAt: timing.readyAt,        // (1) لحظة جهوزية الطلب = وصول الكابتن
    prepMinutes: timing.prepMinutes,
    schedulePickup: timing.schedulePickup,
    lines: params.items.map(toIshbekLine), // (2) الأصناف + الموديفايرز
  };
}


/* ═══════════════════════════ مثال تشغيل ═══════════════════════════ */
const demoItems: CartItem[] = [
  {
    lineId: 'l1', itemId: 'flat-white', nameAr: 'فلات وايت', nameEn: 'Flat White',
    sizeId: 'L', sizeNameAr: 'كبير', unitBasePrice: 2.5, qty: 1, prepMinutes: 6,
    customizations: [
      { groupId: 'milk',   optionId: 'oat',        nameAr: 'حليب شوفان', nameEn: 'Oat milk',   priceDelta: 0.5 },
      { groupId: 'extras', optionId: 'extra-shot', nameAr: 'شوت إضافي',  nameEn: 'Extra shot', priceDelta: 0.4 },
    ],
  },
  {
    lineId: 'l2', itemId: 'croissant', nameAr: 'كرواسون', nameEn: 'Croissant',
    sizeId: 'M', sizeNameAr: 'وسط', unitBasePrice: 1.8, qty: 2, prepMinutes: 3,
    customizations: [],
  },
];

const dispatch = buildIshbekDispatch({
  orderId: 'ord_10432',
  branch: 'khalda',
  items: demoItems,
  orderPlacedAtISO: '2026-07-05T13:00:00+03:00',
  address: { lat: 31.9986, lng: 35.879, text: 'خلدا، عمّان', city: 'amman' },
  quotes: [
    { fleet: 'careem',  covered: true,  fee: 1.5, etaMinutes: 32 },
    { fleet: 'talabat', covered: true,  fee: 1.8, etaMinutes: 28 },
  ],
});

console.log(JSON.stringify(dispatch, null, 2));
/*  المُخرج المتوقّع:
{
  "orderId": "ord_10432",
  "branch": "khalda",
  "preferredFleet": "careem",           // الأرخص من بين المُغطّين  ← (3)
  "dropoff": { "lat": 31.9986, "lng": 35.879, "text": "خلدا، عمّان", "city": "amman" },
  "readyAt": "2026-07-05T13:06:00+03:00", // وقت الطلب + 6 دقائق (أطول صنف)، +03:00 صريح ← (1)
  "prepMinutes": 6,
  "schedulePickup": true,
  "lines": [
    {
      "itemId": "flat-white", "name": "فلات وايت", "qty": 1, "unitPrice": 3.4,  // 2.5 + 0.5 + 0.4
      "modifiers": [                                                            // ← (2)
        { "groupId": "size",   "optionId": "L",          "name": "كبير",       "priceDelta": 0 },
        { "groupId": "milk",   "optionId": "oat",        "name": "حليب شوفان", "priceDelta": 0.5 },
        { "groupId": "extras", "optionId": "extra-shot", "name": "شوت إضافي",  "priceDelta": 0.4 }
      ]
    },
    {
      "itemId": "croissant", "name": "كرواسون", "qty": 2, "unitPrice": 1.8,
      "modifiers": [ { "groupId": "size", "optionId": "M", "name": "وسط", "priceDelta": 0 } ]
    }
  ]
}
*/
