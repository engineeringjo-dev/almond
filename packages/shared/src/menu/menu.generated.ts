import type { Category, MenuItem } from '../types';

// AUTO-GENERATED — do not edit by hand. Regenerate with:
//   ODOO_URL=… ODOO_DB=… ODOO_LOGIN=… ODOO_API_KEY=… npx tsx scripts/odoo-menu-pull.ts
//
// Source: Odoo 19 POS (pos.category + product.template where available_in_pos).
// This is THE SHOP'S menu at shop prices — it replaced a Talabat export whose
// photos were hotlinked from images.deliveryhero.io. Photos now live in
// almond-web/public/menu/ and are ours.
//
// Pulled 2026-09-25: 44 categories, 375 items, 308 photos.

/** When this menu was pulled from Odoo — the public feed's updated_at. */
export const menuPulledAt = '2026-09-25';

export const generatedCategories: Category[] = [
  {
    "id": "cat-1",
    "nameEn": "Food",
    "nameAr": "طعام"
  },
  {
    "id": "cat-47",
    "nameEn": "Bars",
    "nameAr": "ألواح"
  },
  {
    "id": "cat-28",
    "nameEn": "Drink",
    "nameAr": "مشروبات"
  },
  {
    "id": "cat-29",
    "nameEn": "Roasted Coffee",
    "nameAr": "قهوة محمّصة"
  },
  {
    "id": "cat-2",
    "nameEn": "Croissants",
    "nameAr": "كرواسون"
  },
  {
    "id": "cat-3",
    "nameEn": "Bagel",
    "nameAr": "بايغل"
  },
  {
    "id": "cat-4",
    "nameEn": "Keto Bread",
    "nameAr": "خبز الكيتو"
  },
  {
    "id": "cat-5",
    "nameEn": "Sourdough",
    "nameAr": "ساوردو"
  },
  {
    "id": "cat-6",
    "nameEn": "Sandwiches",
    "nameAr": "ساندويشات"
  },
  {
    "id": "cat-7",
    "nameEn": "Chicken Meals And Sandwiches",
    "nameAr": "وجبات وساندويشات دجاج"
  },
  {
    "id": "cat-8",
    "nameEn": "Salads",
    "nameAr": "سلطات"
  },
  {
    "id": "cat-9",
    "nameEn": "Granola Cups",
    "nameAr": "كاسات جرانولا"
  },
  {
    "id": "cat-10",
    "nameEn": "Cake Pieces & Sweets",
    "nameAr": "قطع كيك وحلويات"
  },
  {
    "id": "cat-11",
    "nameEn": "Cookies & Muffins",
    "nameAr": "كوكيز ومافن"
  },
  {
    "id": "cat-12",
    "nameEn": "Gluten-free Desserts",
    "nameAr": "حلويات خالية من الجلوتين"
  },
  {
    "id": "cat-13",
    "nameEn": "Sweet Packs",
    "nameAr": "علب حلويات"
  },
  {
    "id": "cat-14",
    "nameEn": "Full Cakes",
    "nameAr": "كيكات كاملة"
  },
  {
    "id": "cat-15",
    "nameEn": "Manaqeesh",
    "nameAr": "مناقيش"
  },
  {
    "id": "cat-16",
    "nameEn": "Pasta",
    "nameAr": "باستا"
  },
  {
    "id": "cat-18",
    "nameEn": "Pizza",
    "nameAr": "بيتزا"
  },
  {
    "id": "cat-17",
    "nameEn": "Mini Bites",
    "nameAr": "ميني بايتس"
  },
  {
    "id": "cat-19",
    "nameEn": "Coffee Frappe",
    "nameAr": "فرابيه قهوة"
  },
  {
    "id": "cat-20",
    "nameEn": "Creme Frappe",
    "nameAr": "فرابيه كريمة"
  },
  {
    "id": "cat-21",
    "nameEn": "Hot Chocolate",
    "nameAr": "شوكولاتة ساخنة"
  },
  {
    "id": "cat-22",
    "nameEn": "Hot Specialty Coffee",
    "nameAr": "قهوة مختصة ساخنة"
  },
  {
    "id": "cat-48",
    "nameEn": "Seasonal Drinks",
    "nameAr": "مشروبات موسمية"
  },
  {
    "id": "cat-23",
    "nameEn": "Iced Specialty Coffee",
    "nameAr": "قهوة مختصة مثلجة"
  },
  {
    "id": "cat-24",
    "nameEn": "Iced Tea And Fresh Juices",
    "nameAr": "شاي مثلج وعصائر طازجة"
  },
  {
    "id": "cat-25",
    "nameEn": "Mojito",
    "nameAr": "موهيتو"
  },
  {
    "id": "cat-27",
    "nameEn": "Tea",
    "nameAr": "شاي"
  },
  {
    "id": "cat-41",
    "nameEn": "Drink / Iced",
    "nameAr": "Drink / Iced"
  },
  {
    "id": "cat-30",
    "nameEn": "Coffee Bags",
    "nameAr": "أكياس قهوة"
  },
  {
    "id": "cat-32",
    "nameEn": "Extra Food",
    "nameAr": "Extra Food"
  },
  {
    "id": "cat-33",
    "nameEn": "Extra Pizza",
    "nameAr": "Extra Pizza"
  },
  {
    "id": "cat-36",
    "nameEn": "Specialty Coffee Tools",
    "nameAr": "أدوات القهوة المختصة"
  },
  {
    "id": "cat-43",
    "nameEn": "Gluten-free Full Cake",
    "nameAr": "كيك كامل خالٍ من الجلوتين"
  },
  {
    "id": "cat-45",
    "nameEn": "Bento Cake",
    "nameAr": "بينتو كيك"
  },
  {
    "id": "cat-34",
    "nameEn": "Extra Drink",
    "nameAr": "Extra Drink"
  },
  {
    "id": "cat-35",
    "nameEn": "Extra Flavor",
    "nameAr": "Extra Flavor"
  },
  {
    "id": "cat-38",
    "nameEn": "Extra Sweets",
    "nameAr": "Extra Sweets"
  },
  {
    "id": "cat-39",
    "nameEn": "Extra Special Milk",
    "nameAr": "Extra Special Milk"
  },
  {
    "id": "cat-40",
    "nameEn": "Maamoul",
    "nameAr": "معمول"
  },
  {
    "id": "cat-42",
    "nameEn": "Ramdan Sweets",
    "nameAr": "Ramdan Sweets"
  },
  {
    "id": "cat-44",
    "nameEn": "Sides",
    "nameAr": "طلب جانبي"
  }
];

export const generatedMenuItems: MenuItem[] = [
  {
    "id": "p-10170",
    "categoryId": "cat-3",
    "nameEn": "3 Cheese Omelette Bagel",
    "nameAr": "بايغل مع أومليت و ٣ أنواع جبن",
    "emoji": "",
    "imageUrl": "/menu/p-10170.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.9
      }
    ],
    "customizations": [
      {
        "id": "g-4",
        "nameEn": "Bagel Type",
        "nameAr": "نوع البيغل",
        "multiple": false,
        "options": [
          {
            "id": "o-1",
            "nameEn": "Plain",
            "nameAr": "سادة",
            "priceDelta": 0
          },
          {
            "id": "o-2",
            "nameEn": "Everything",
            "nameAr": "ايفري ثنج",
            "priceDelta": 0
          },
          {
            "id": "o-3",
            "nameEn": "Multigrain",
            "nameAr": "خلطة حبوب",
            "priceDelta": 0
          },
          {
            "id": "o-4",
            "nameEn": "Poppy Seed",
            "nameAr": "بوبي سيد",
            "priceDelta": 0
          },
          {
            "id": "o-5",
            "nameEn": "Sesame",
            "nameAr": "السمسم",
            "priceDelta": 0
          },
          {
            "id": "o-6",
            "nameEn": "Zatar",
            "nameAr": "زعتر",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3135",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11581",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11583",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11587",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2778",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-8737",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-8744",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-8748",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11867",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12071",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10156",
    "categoryId": "cat-2",
    "nameEn": "3 Cheese Omelette Croissant",
    "nameAr": "كرواسون مع أومليت و٣ أنواع جبن",
    "emoji": "",
    "imageUrl": "/menu/p-10156.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.9
      }
    ],
    "customizations": [
      {
        "id": "g-3156",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11728",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11730",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11734",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2844",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9805",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9812",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9816",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11866",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10183",
    "categoryId": "cat-4",
    "nameEn": "3 Cheese Omelette Keto Bagel",
    "nameAr": "كيتو بايغل مع أومليت و ٣ أنواع جبن",
    "emoji": "",
    "imageUrl": "/menu/p-10183.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 5.9
      }
    ],
    "customizations": [
      {
        "id": "g-3136",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11588",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11590",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11594",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2823",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9427",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9434",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9438",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11858",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12062",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      },
      {
        "id": "g-240",
        "nameEn": "Without",
        "nameAr": "بدون اضافة",
        "multiple": true,
        "options": [
          {
            "id": "o-487",
            "nameEn": "Without Tomato",
            "nameAr": "بدون بندورة",
            "priceDelta": 0
          },
          {
            "id": "o-488",
            "nameEn": "Without Roast Beef",
            "nameAr": " بدون روست بيف",
            "priceDelta": 0
          },
          {
            "id": "o-489",
            "nameEn": "Without Turkey",
            "nameAr": "بدون تيركي",
            "priceDelta": 0
          },
          {
            "id": "o-493",
            "nameEn": "Without Cheddar Cheese",
            "nameAr": "بدون تشيدر تشيز ",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10185",
    "categoryId": "cat-5",
    "nameEn": "3 Cheese Omelette Sourdough",
    "nameAr": "ساوردو مع أومليت و٣ أنواع جبن",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.9
      }
    ],
    "customizations": [
      {
        "id": "g-2832",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9589",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9596",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9600",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11879",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12083",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10310",
    "categoryId": "cat-14",
    "nameEn": "Add Sugar Picture",
    "nameAr": "اضافة صورة من السكر",
    "emoji": "",
    "imageUrl": "/menu/p-10310.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 10
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11768",
    "categoryId": "cat-27",
    "nameEn": "Ahmad Tea",
    "nameAr": "شاي احمد",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-5042",
    "categoryId": "cat-24",
    "nameEn": "Al Marai Juice 300 ml",
    "nameAr": "عصير مراعي 300 مل",
    "emoji": "",
    "imageUrl": "/menu/p-5042.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10202",
    "categoryId": "cat-6",
    "nameEn": "Alfredo Chicken Sandwich",
    "nameAr": "ساندويش ألفريدو دجاج",
    "emoji": "",
    "imageUrl": "/menu/p-10202.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": [
      {
        "id": "g-2802",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9074",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 1.5
          },
          {
            "id": "o-11827",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12031",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10332",
    "categoryId": "cat-16",
    "nameEn": "Alfredo Fettucine",
    "nameAr": "فيتوشيني ألفريدو مع ماشروم",
    "emoji": "",
    "imageUrl": "/menu/p-10332.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.95
      }
    ],
    "customizations": [
      {
        "id": "g-2811",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-9223",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-9224",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-9225",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-9227",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          }
        ]
      },
      {
        "id": "g-3090",
        "nameEn": "Remove:",
        "nameAr": "ازالة:",
        "multiple": true,
        "options": [
          {
            "id": "o-11346",
            "nameEn": "Remove Mushroom",
            "nameAr": "أزل الفطر",
            "priceDelta": 0
          },
          {
            "id": "o-11347",
            "nameEn": "Remove Basil Leaves",
            "nameAr": "أزل أوراق الريحان",
            "priceDelta": 0
          },
          {
            "id": "o-11348",
            "nameEn": "Remove Parmesan Cheese",
            "nameAr": "أزل جبنة البارمزان",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10367",
    "categoryId": "cat-19",
    "nameEn": "Almond Coffee Frappe",
    "nameAr": "الموند فرابيه بالقهوة",
    "emoji": "",
    "imageUrl": "/menu/p-10367.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2045",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7833",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-2987",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-2988",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-2989",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-2990",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-2991",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2992",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2993",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3004",
        "nameEn": "Extra For Frappe",
        "nameAr": "Extra For Frappe",
        "multiple": true,
        "options": [
          {
            "id": "o-11019",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11020",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11021",
            "nameEn": "No Whipped Cream",
            "nameAr": "No Whipped Cream",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10245",
    "categoryId": "cat-10",
    "nameEn": "Almond Croissant",
    "nameAr": "كرواسون باللوز",
    "emoji": "",
    "imageUrl": "/menu/p-10245.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.75
      }
    ],
    "customizations": [
      {
        "id": "g-2909",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10469",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10470",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10472",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10471",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-12160",
    "categoryId": "cat-10",
    "nameEn": "Apple & Dark Chocolate Brioche",
    "nameAr": "قطعة بريوش التفاح",
    "emoji": "",
    "imageUrl": "/menu/p-12160.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-12134",
    "categoryId": "cat-8",
    "nameEn": "Apple & Feta Salad",
    "nameAr": "سلطة التفاح والفيتا(حديقة الخريف)",
    "emoji": "",
    "imageUrl": "/menu/p-12134.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-12138",
    "categoryId": "cat-10",
    "nameEn": "Apple Linzer Cake Piece",
    "nameAr": "قطعة لينزار التفاح",
    "emoji": "",
    "imageUrl": "/menu/p-12138.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-12137",
    "categoryId": "cat-14",
    "nameEn": "Apple Linzer Full Cake",
    "nameAr": "قالب لينزار التفاح",
    "emoji": "",
    "imageUrl": "/menu/p-12137.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 16
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10188",
    "categoryId": "cat-5",
    "nameEn": "Avocado And Labaneh Sourdough Bread",
    "nameAr": "افوكادو ولبنة خبز سوردو",
    "emoji": "",
    "imageUrl": "/menu/p-10188.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": [
      {
        "id": "g-2829",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11876",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11944",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-12012",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-10167",
    "categoryId": "cat-3",
    "nameEn": "Avocado And Labneh Bagel",
    "nameAr": "بايغل مع أفوكادو ولبنة",
    "emoji": "",
    "imageUrl": "/menu/p-10167.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": [
      {
        "id": "g-75",
        "nameEn": "Bagel Type",
        "nameAr": "نوع البيغل",
        "multiple": false,
        "options": [
          {
            "id": "o-150",
            "nameEn": "Plain",
            "nameAr": "سادة",
            "priceDelta": 0
          },
          {
            "id": "o-151",
            "nameEn": "Everything",
            "nameAr": "ايفري ثنج",
            "priceDelta": 0
          },
          {
            "id": "o-152",
            "nameEn": "Multigrain",
            "nameAr": "خلطة حبوب",
            "priceDelta": 0
          },
          {
            "id": "o-153",
            "nameEn": "Poppy Seed",
            "nameAr": "بوبي سيد",
            "priceDelta": 0
          },
          {
            "id": "o-154",
            "nameEn": "Sesame",
            "nameAr": "السمسم",
            "priceDelta": 0
          },
          {
            "id": "o-155",
            "nameEn": "Zatar",
            "nameAr": "زعتر",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3137",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11595",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11597",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11601",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2850",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11888",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11956",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-12024",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-10153",
    "categoryId": "cat-2",
    "nameEn": "Avocado And Labneh Croissant",
    "nameAr": "كرواسون مع أفوكادو ولبنة",
    "emoji": "",
    "imageUrl": "/menu/p-10153.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": [
      {
        "id": "g-2841",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11863",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11931",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-11999",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      },
      {
        "id": "g-3157",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11735",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11737",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11741",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10180",
    "categoryId": "cat-4",
    "nameEn": "Avocado And Labneh Keto Bagel",
    "nameAr": "كيتو بايغل مع أفوكادو ولبنة",
    "emoji": "",
    "imageUrl": "/menu/p-10180.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 5.5
      }
    ],
    "customizations": [
      {
        "id": "g-3138",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11602",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11604",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11608",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2820",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11855",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11923",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-11991",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-10169",
    "categoryId": "cat-3",
    "nameEn": "Avocado And Nabulsi Cheese Bagel",
    "nameAr": "بايغل مع أفوكادو وجبنة نابلسية",
    "emoji": "",
    "imageUrl": "/menu/p-10169.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.9
      }
    ],
    "customizations": [
      {
        "id": "g-78",
        "nameEn": "Bagel Type",
        "nameAr": "نوع البيغل",
        "multiple": false,
        "options": [
          {
            "id": "o-178",
            "nameEn": "Plain",
            "nameAr": "سادة",
            "priceDelta": 0
          },
          {
            "id": "o-179",
            "nameEn": "Everything",
            "nameAr": "ايفري ثنج",
            "priceDelta": 0
          },
          {
            "id": "o-180",
            "nameEn": "Multigrain",
            "nameAr": "خلطة حبوب",
            "priceDelta": 0
          },
          {
            "id": "o-181",
            "nameEn": "Poppy Seed",
            "nameAr": "بوبي سيد",
            "priceDelta": 0
          },
          {
            "id": "o-182",
            "nameEn": "Sesame",
            "nameAr": "السمسم",
            "priceDelta": 0
          },
          {
            "id": "o-183",
            "nameEn": "Zatar",
            "nameAr": "زعتر",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3139",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11609",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11611",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11615",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2852",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11889",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11957",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-12025",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-10155",
    "categoryId": "cat-2",
    "nameEn": "Avocado And Nabulsi Cheese Croissant",
    "nameAr": "كرواسون مع أفوكادو وجبنة نابلسية",
    "emoji": "",
    "imageUrl": "/menu/p-10155.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.9
      }
    ],
    "customizations": [
      {
        "id": "g-3158",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11742",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11744",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11748",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2843",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11865",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11933",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-12001",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-10182",
    "categoryId": "cat-4",
    "nameEn": "Avocado And Nabulsi Cheese Keto Bagel",
    "nameAr": "كيتو بايغل مع أفوكادو وجبنة نابلسية",
    "emoji": "",
    "imageUrl": "/menu/p-10182.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 5.9
      }
    ],
    "customizations": [
      {
        "id": "g-3140",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11616",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11618",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11622",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2822",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11857",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11925",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-11993",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-10186",
    "categoryId": "cat-5",
    "nameEn": "Avocado And Nabulsi Cheese Sourdough Bread",
    "nameAr": "افوكادو وجبنة نابلسية خبز سوردو",
    "emoji": "",
    "imageUrl": "/menu/p-10186.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.9
      }
    ],
    "customizations": [
      {
        "id": "g-2831",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11878",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11946",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-12014",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-10168",
    "categoryId": "cat-3",
    "nameEn": "Avocado And Sliced Egg Bagel",
    "nameAr": "بايغل مع أفوكادو وشرائح بيض",
    "emoji": "",
    "imageUrl": "/menu/p-10168.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": [
      {
        "id": "g-81",
        "nameEn": "Bagel Type",
        "nameAr": "نوع البيغل",
        "multiple": false,
        "options": [
          {
            "id": "o-206",
            "nameEn": "Plain",
            "nameAr": "سادة",
            "priceDelta": 0
          },
          {
            "id": "o-207",
            "nameEn": "Everything",
            "nameAr": "ايفري ثنج",
            "priceDelta": 0
          },
          {
            "id": "o-208",
            "nameEn": "Multigrain",
            "nameAr": "خلطة حبوب",
            "priceDelta": 0
          },
          {
            "id": "o-209",
            "nameEn": "Poppy Seed",
            "nameAr": "بوبي سيد",
            "priceDelta": 0
          },
          {
            "id": "o-210",
            "nameEn": "Sesame",
            "nameAr": "السمسم",
            "priceDelta": 0
          },
          {
            "id": "o-211",
            "nameEn": "Zatar",
            "nameAr": "زعتر",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3133",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11567",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11569",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11573",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2851",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9942",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11893",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11961",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-12029",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-10154",
    "categoryId": "cat-2",
    "nameEn": "Avocado And Sliced Egg Croissant",
    "nameAr": "كرواسون مع أفوكادو وشرائح بيض",
    "emoji": "",
    "imageUrl": "/menu/p-10154.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": [
      {
        "id": "g-2842",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9780",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11864",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11932",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-12000",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      },
      {
        "id": "g-3159",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11749",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11751",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11755",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10181",
    "categoryId": "cat-4",
    "nameEn": "Avocado And Sliced Egg Keto Bagel",
    "nameAr": "كيتو بايغل مع أفوكادو وشرائح بيض",
    "emoji": "",
    "imageUrl": "/menu/p-10181.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 5.5
      }
    ],
    "customizations": [
      {
        "id": "g-3141",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11623",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11625",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11629",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2821",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9402",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11856",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11924",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-11992",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-10187",
    "categoryId": "cat-5",
    "nameEn": "Avocado Egg Sourdough",
    "nameAr": "ساوردو مع أفوكادو وشرائح بيض",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": [
      {
        "id": "g-2830",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9564",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11877",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11945",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-12013",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-10221",
    "categoryId": "cat-9",
    "nameEn": "Banana Granola",
    "nameAr": "جرانولا موز",
    "emoji": "",
    "imageUrl": "/menu/p-10221.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3
      }
    ],
    "customizations": []
  },
  {
    "id": "p-12188",
    "categoryId": "cat-48",
    "nameEn": "Banoffee Frappé",
    "nameAr": "بانوفي فرابيه",
    "emoji": "",
    "imageUrl": "/menu/p-12188.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-3175",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-12115",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-12109",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-12110",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-12111",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-12112",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-12113",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-12114",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-12129",
    "categoryId": "cat-8",
    "nameEn": "Beetroot & Quinoa Salad",
    "nameAr": "سلطة الكينوا والشمندر(حصاد الخريف)",
    "emoji": "",
    "imageUrl": "/menu/p-12129.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10551",
    "categoryId": "cat-45",
    "nameEn": "Bento Lemon Cake",
    "nameAr": "كيكة بينتو ليمون",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 8
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10550",
    "categoryId": "cat-45",
    "nameEn": "Bento Nutella Cake",
    "nameAr": "كيكة بينتو نوتيلا",
    "emoji": "",
    "imageUrl": "/menu/p-10550.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 8
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10552",
    "categoryId": "cat-45",
    "nameEn": "Bento Red Velvet Cake",
    "nameAr": "كيكة بينتو ريد فيلفيت",
    "emoji": "",
    "imageUrl": "/menu/p-10552.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 8
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10553",
    "categoryId": "cat-45",
    "nameEn": "Bento Strawberry Cake",
    "nameAr": "كيكة بينتو فراولة",
    "emoji": "",
    "imageUrl": "/menu/p-10553.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 8
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10392",
    "categoryId": "cat-25",
    "nameEn": "Blackcurrant Mojito",
    "nameAr": "موهيتو البلاك كرنت",
    "emoji": "",
    "imageUrl": "/menu/p-10392.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-3092",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11363",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10215",
    "categoryId": "cat-9",
    "nameEn": "Blueberry Banana Granola",
    "nameAr": "جرانولا البلوبيري والموز",
    "emoji": "",
    "imageUrl": "/menu/p-10215.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10252",
    "categoryId": "cat-10",
    "nameEn": "Blueberry Cheese Cake",
    "nameAr": "بلوبيري تشيز كيك",
    "emoji": "",
    "imageUrl": "/menu/p-10252.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-2923",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10553",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10554",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10556",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10555",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10374",
    "categoryId": "cat-20",
    "nameEn": "Blueberry Crème Frappe",
    "nameAr": "بلوبيري فراب",
    "emoji": "",
    "imageUrl": "/menu/p-10374.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2049",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7837",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3015",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3016",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3017",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3018",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3019",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3020",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3021",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3007",
        "nameEn": "Extra For Frappe",
        "nameAr": "Extra For Frappe",
        "multiple": true,
        "options": [
          {
            "id": "o-11028",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11029",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11030",
            "nameEn": "No Whipped Cream",
            "nameAr": "No Whipped Cream",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10388",
    "categoryId": "cat-25",
    "nameEn": "Blueberry Mojito",
    "nameAr": "موهيتو توت أزرق",
    "emoji": "",
    "imageUrl": "/menu/p-10388.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-3064",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11185",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10267",
    "categoryId": "cat-11",
    "nameEn": "Blueberry Muffin",
    "nameAr": "بلوبيري مفن",
    "emoji": "",
    "imageUrl": "/menu/p-10267.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": [
      {
        "id": "g-2867",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10145",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10146",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10148",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10149",
            "nameEn": "Extra Cream",
            "nameAr": "Extra Cream",
            "priceDelta": 0.45
          },
          {
            "id": "o-10150",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.45
          },
          {
            "id": "o-10147",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-12089",
    "categoryId": "cat-6",
    "nameEn": "Boiled Egg Meal",
    "nameAr": "وجبة البيض المسلوق",
    "emoji": "",
    "imageUrl": "/menu/p-12089.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10244",
    "categoryId": "cat-10",
    "nameEn": "Brownies",
    "nameAr": "براونيز",
    "emoji": "",
    "imageUrl": "/menu/p-10244.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.25
      }
    ],
    "customizations": [
      {
        "id": "g-2934",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10619",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10620",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10622",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10621",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10328",
    "categoryId": "cat-18",
    "nameEn": "Bufala Pizza",
    "nameAr": "بوفالا بيتزا",
    "emoji": "",
    "imageUrl": "/menu/p-10328.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "White . Medium",
        "nameAr": "وسط ابيض",
        "price": 6.9
      },
      {
        "id": "M",
        "nameEn": "White . Large",
        "nameAr": "كبير ابيض",
        "price": 8.9
      },
      {
        "id": "L",
        "nameEn": "brown . Medium",
        "nameAr": "وسط اسمر",
        "price": 7.4
      }
    ],
    "customizations": [
      {
        "id": "g-2780",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8765",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-11426",
            "nameEn": "Extra Blue Cheese",
            "nameAr": "اكسترا بلو تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-8767",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8769",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-11427",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-11425",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-8773",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-8774",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8775",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-8776",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          }
        ]
      },
      {
        "id": "g-267",
        "nameEn": "Remove:",
        "nameAr": "ازالة:",
        "multiple": true,
        "options": [
          {
            "id": "o-11332",
            "nameEn": "Remove Pizza Sauce",
            "nameAr": "أزل صوص البيتزا",
            "priceDelta": 0
          },
          {
            "id": "o-11333",
            "nameEn": "Remove Basil Leaves",
            "nameAr": "أزل أوراق الريحان",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10201",
    "categoryId": "cat-6",
    "nameEn": "Buffalo Chicken Sandwich",
    "nameAr": "ساندويش بافلو تشكين",
    "emoji": "",
    "imageUrl": "/menu/p-10201.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": [
      {
        "id": "g-2801",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-12118",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9056",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 1.5
          },
          {
            "id": "o-11826",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10327",
    "categoryId": "cat-18",
    "nameEn": "Burrata Pizza",
    "nameAr": "بوراتا بيتزا",
    "emoji": "",
    "imageUrl": "/menu/p-10327.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "White . Medium",
        "nameAr": "وسط ابيض",
        "price": 7.5
      },
      {
        "id": "M",
        "nameEn": "White . Large",
        "nameAr": "كبير ابيض",
        "price": 9.5
      },
      {
        "id": "L",
        "nameEn": "brown . Medium",
        "nameAr": "وسط اسمر",
        "price": 8
      }
    ],
    "customizations": [
      {
        "id": "g-2781",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8777",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-8779",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8780",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8781",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-8785",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-8786",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8787",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-8788",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          }
        ]
      },
      {
        "id": "g-276",
        "nameEn": "Remove:",
        "nameAr": "ازالة:",
        "multiple": true,
        "options": [
          {
            "id": "o-11335",
            "nameEn": "Remove Pizza Sauce",
            "nameAr": "أزل صوص البيتزا",
            "priceDelta": 0
          },
          {
            "id": "o-11336",
            "nameEn": "Remove Basil Leaves",
            "nameAr": "أزل أوراق الريحان",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10243",
    "categoryId": "cat-10",
    "nameEn": "Cake Pop",
    "nameAr": "كيك بوب",
    "emoji": "",
    "imageUrl": "/menu/p-10243.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10836",
    "categoryId": "cat-44",
    "nameEn": "Candles 1",
    "nameAr": "Candles 1",
    "emoji": "",
    "imageUrl": "/menu/p-10836.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10837",
    "categoryId": "cat-44",
    "nameEn": "Candles 2",
    "nameAr": "Candles 2",
    "emoji": "",
    "imageUrl": "/menu/p-10837.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10838",
    "categoryId": "cat-44",
    "nameEn": "Candles 3",
    "nameAr": "Candles 3",
    "emoji": "",
    "imageUrl": "/menu/p-10838.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10839",
    "categoryId": "cat-44",
    "nameEn": "Candles 4",
    "nameAr": "Candles 4",
    "emoji": "",
    "imageUrl": "/menu/p-10839.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10645",
    "categoryId": "cat-14",
    "nameEn": "Caramel Chocolate",
    "nameAr": "الشوكلاتة بالكراميل",
    "emoji": "",
    "imageUrl": "/menu/p-10645.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "(6-8) people",
        "nameAr": "(6-8) أشخاص",
        "price": 25
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10650",
    "categoryId": "cat-10",
    "nameEn": "Caramel Chocolate Cake",
    "nameAr": "كيك الشوكلاتة بالكراميل",
    "emoji": "",
    "imageUrl": "/menu/p-10650.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.75
      }
    ],
    "customizations": [
      {
        "id": "g-2948",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10703",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10704",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10706",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10705",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10371",
    "categoryId": "cat-20",
    "nameEn": "Caramel Crème Frappe",
    "nameAr": "كراميل فرابيه",
    "emoji": "",
    "imageUrl": "/menu/p-10371.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2050",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7838",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3022",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3023",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3024",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3025",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3026",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3027",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3028",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3012",
        "nameEn": "Extra For Frappe",
        "nameAr": "Extra For Frappe",
        "multiple": true,
        "options": [
          {
            "id": "o-11043",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11044",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11045",
            "nameEn": "No Whipped Cream",
            "nameAr": "No Whipped Cream",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10369",
    "categoryId": "cat-19",
    "nameEn": "Caramel Crunch Coffee Frappe",
    "nameAr": "كراميل كرانش فرابيه بالقهوة",
    "emoji": "",
    "imageUrl": "/menu/p-10369.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2644",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7942",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-7943",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-7944",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-7945",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-7946",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-7947",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-7948",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-7949",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3005",
        "nameEn": "Extra For Frappe",
        "nameAr": "Extra For Frappe",
        "multiple": true,
        "options": [
          {
            "id": "o-11022",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11023",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11024",
            "nameEn": "No Whipped Cream",
            "nameAr": "No Whipped Cream",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-11799",
    "categoryId": "cat-11",
    "nameEn": "Caramel Latte Muffin",
    "nameAr": "مافن الكراميل لاتيه",
    "emoji": "",
    "imageUrl": "/menu/p-11799.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": [
      {
        "id": "g-2970",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10842",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10843",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10845",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10846",
            "nameEn": "Extra Cream",
            "nameAr": "Extra Cream",
            "priceDelta": 0.45
          },
          {
            "id": "o-10847",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.45
          },
          {
            "id": "o-10844",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10307",
    "categoryId": "cat-14",
    "nameEn": "Carrot Cake",
    "nameAr": "كيكة الجزر",
    "emoji": "",
    "imageUrl": "/menu/p-10307.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "(6-8) people",
        "nameAr": "(6-8) أشخاص",
        "price": 16
      },
      {
        "id": "M",
        "nameEn": "(10-12) poeple",
        "nameAr": "(10-12) أشخاص",
        "price": 20
      },
      {
        "id": "L",
        "nameEn": "15 (تواصي)",
        "nameAr": "15 (تواصي)",
        "price": 30
      },
      {
        "id": "L",
        "nameEn": "20 (تواصي)",
        "nameAr": "20 (تواصي)",
        "price": 40
      },
      {
        "id": "L",
        "nameEn": "25 (تواصي)",
        "nameAr": "25 (تواصي)",
        "price": 50
      }
    ],
    "customizations": [
      {
        "id": "g-2586",
        "nameEn": "Customize Cake",
        "nameAr": "تفصيلات قوالب الكيك",
        "multiple": true,
        "options": [
          {
            "id": "o-7761",
            "nameEn": "Sugar Picture",
            "nameAr": "صورة السكر",
            "priceDelta": 10
          }
        ]
      }
    ]
  },
  {
    "id": "p-10251",
    "categoryId": "cat-10",
    "nameEn": "Carrot Cake Piece",
    "nameAr": "قطع كيك الجزر",
    "emoji": "",
    "imageUrl": "/menu/p-10251.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-2919",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10529",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10530",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10532",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10531",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10166",
    "categoryId": "cat-3",
    "nameEn": "Cheddar Cheese Bagel",
    "nameAr": "بايغل مع جبنة الشيدر",
    "emoji": "",
    "imageUrl": "/menu/p-10166.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-87",
        "nameEn": "Bagel Type",
        "nameAr": "نوع البيغل",
        "multiple": false,
        "options": [
          {
            "id": "o-262",
            "nameEn": "Plain",
            "nameAr": "سادة",
            "priceDelta": 0
          },
          {
            "id": "o-263",
            "nameEn": "Everything",
            "nameAr": "ايفري ثنج",
            "priceDelta": 0
          },
          {
            "id": "o-264",
            "nameEn": "Multigrain",
            "nameAr": "خلطة حبوب",
            "priceDelta": 0
          },
          {
            "id": "o-265",
            "nameEn": "Poppy Seed",
            "nameAr": "بوبي سيد",
            "priceDelta": 0
          },
          {
            "id": "o-266",
            "nameEn": "Sesame",
            "nameAr": "السمسم",
            "priceDelta": 0
          },
          {
            "id": "o-267",
            "nameEn": "Zatar",
            "nameAr": "زعتر",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3142",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11630",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11632",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11636",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2849",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9895",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9902",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9903",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-9906",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11887",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12091",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10152",
    "categoryId": "cat-2",
    "nameEn": "Cheddar Cheese Croissant",
    "nameAr": "كرواسون مع جبنة شيدر",
    "emoji": "",
    "imageUrl": "/menu/p-10152.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-3160",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11756",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11758",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11762",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2840",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9733",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9740",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9741",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-9744",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11862",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12066",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10179",
    "categoryId": "cat-4",
    "nameEn": "Cheddar Cheese Keto Bagel",
    "nameAr": "كيتو بايغل مع جبنة الشيدر",
    "emoji": "",
    "imageUrl": "/menu/p-10179.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": [
      {
        "id": "g-3143",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11637",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11639",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11643",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2819",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9355",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9362",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9363",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-9366",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11854",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12058",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10189",
    "categoryId": "cat-5",
    "nameEn": "Chedder Sourdough",
    "nameAr": "ساوردو مع جبنة الشيدر",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-2828",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9524",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9528",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-9529",
            "nameEn": "Extra Cream Cheese",
            "nameAr": "اكسترا كريم تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-11875",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12079",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10146",
    "categoryId": "cat-2",
    "nameEn": "Cheese Croissant",
    "nameAr": "كرواسون الجبنة",
    "emoji": "",
    "imageUrl": "/menu/p-10146.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10213",
    "categoryId": "cat-8",
    "nameEn": "Chicken Caesar Salad",
    "nameAr": "سلطة السيزر بالدجاج",
    "emoji": "",
    "imageUrl": "/menu/p-10213.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": [
      {
        "id": "g-2880",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-10274",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-10211",
    "categoryId": "cat-8",
    "nameEn": "Chicken Pasta Salad",
    "nameAr": "سلطة باستا دجاج",
    "emoji": "",
    "imageUrl": "/menu/p-10211.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": [
      {
        "id": "g-2879",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-10256",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 1.5
          },
          {
            "id": "o-11842",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10326",
    "categoryId": "cat-18",
    "nameEn": "Chicken Pizza",
    "nameAr": "دجاج بيتزا",
    "emoji": "",
    "imageUrl": "/menu/p-10326.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "White . Medium",
        "nameAr": "وسط ابيض",
        "price": 5.5
      },
      {
        "id": "M",
        "nameEn": "White . Large",
        "nameAr": "كبير ابيض",
        "price": 7.5
      },
      {
        "id": "L",
        "nameEn": "brown . Medium",
        "nameAr": "وسط اسمر",
        "price": 6
      }
    ],
    "customizations": [
      {
        "id": "g-2782",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8789",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-8791",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8792",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8793",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-8798",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8799",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-8800",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          }
        ]
      },
      {
        "id": "g-1476",
        "nameEn": "Remove:",
        "nameAr": "ازالة:",
        "multiple": true,
        "options": [
          {
            "id": "o-11337",
            "nameEn": "Remove Mozzarella Cheese",
            "nameAr": "أزل الجبنة",
            "priceDelta": 0
          },
          {
            "id": "o-11338",
            "nameEn": "Remove Pizza Sauce",
            "nameAr": "أزل صوص البيتزا",
            "priceDelta": 0
          },
          {
            "id": "o-11339",
            "nameEn": "Remove Basil Leaves",
            "nameAr": "أزل أوراق الريحان",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10368",
    "categoryId": "cat-19",
    "nameEn": "Chocolate Chip Coffee Frappe",
    "nameAr": "تشوكلت تشيب فرابيه بالقهوة",
    "emoji": "",
    "imageUrl": "/menu/p-10368.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2046",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7834",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-2994",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-2995",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-2996",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-2997",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-2998",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2999",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3000",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3016",
        "nameEn": "Extra For Frappe",
        "nameAr": "Extra For Frappe",
        "multiple": true,
        "options": [
          {
            "id": "o-11055",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11056",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11057",
            "nameEn": "No Whipped Cream",
            "nameAr": "No Whipped Cream",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10260",
    "categoryId": "cat-11",
    "nameEn": "Chocolate Chip Cookie",
    "nameAr": "شوكليت شيب كوكيز",
    "emoji": "",
    "imageUrl": "/menu/p-10260.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": [
      {
        "id": "g-2872",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10175",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10176",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10178",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10179",
            "nameEn": "Extra Cream",
            "nameAr": "Extra Cream",
            "priceDelta": 0.45
          },
          {
            "id": "o-10180",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.45
          },
          {
            "id": "o-10177",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10377",
    "categoryId": "cat-20",
    "nameEn": "Chocolate Chip Crème Frappe",
    "nameAr": "تشوكت تشيب فراب",
    "emoji": "",
    "imageUrl": "/menu/p-10377.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2051",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7839",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3029",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3030",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3031",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3032",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3033",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3034",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3035",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          },
          {
            "id": "o-10931",
            "nameEn": "No Milk",
            "nameAr": "بدون حليب",
            "priceDelta": 0
          },
          {
            "id": "o-10932",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-10925",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-10926",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-10927",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-10928",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-10929",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-10930",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3008",
        "nameEn": "Extra For Frappe",
        "nameAr": "Extra For Frappe",
        "multiple": true,
        "options": [
          {
            "id": "o-11031",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11032",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11033",
            "nameEn": "No Whipped Cream",
            "nameAr": "No Whipped Cream",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10228",
    "categoryId": "cat-10",
    "nameEn": "Chocolate Croissant",
    "nameAr": "كروسان الشوكلاتة",
    "emoji": "",
    "imageUrl": "/menu/p-10228.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-2904",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10439",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10440",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10442",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10441",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-11798",
    "categoryId": "cat-10",
    "nameEn": "Chocolate Flan Danish",
    "nameAr": "فلان الشوكلاتة دانيش",
    "emoji": "",
    "imageUrl": "/menu/p-11798.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-2969",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10836",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10837",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10839",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10838",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10308",
    "categoryId": "cat-14",
    "nameEn": "Chocolate Fudge Cake",
    "nameAr": "قالب كيك فادج الشوكولاتة",
    "emoji": "",
    "imageUrl": "/menu/p-10308.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "(6-8) people",
        "nameAr": "(6-8) أشخاص",
        "price": 25
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10256",
    "categoryId": "cat-10",
    "nameEn": "Chocolate Fudge Cake Piece",
    "nameAr": "قطعة كيكة فادج الشوكولاتة",
    "emoji": "",
    "imageUrl": "/menu/p-10256.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": [
      {
        "id": "g-2903",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10433",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10434",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10436",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10437",
            "nameEn": "Extra Cream",
            "nameAr": "Extra Cream",
            "priceDelta": 0.45
          },
          {
            "id": "o-10438",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.45
          },
          {
            "id": "o-10435",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-11996",
    "categoryId": "cat-47",
    "nameEn": "Chocolate Oat Bar",
    "nameAr": "بار الشوفان بالشوكولاتة",
    "emoji": "",
    "imageUrl": "/menu/p-11996.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11992",
    "categoryId": "cat-47",
    "nameEn": "Chocolate protein Bar",
    "nameAr": "بار بروتين بالشوكولاتة",
    "emoji": "",
    "imageUrl": "/menu/p-11992.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10240",
    "categoryId": "cat-10",
    "nameEn": "Classic Eclair",
    "nameAr": "كلاسيك ايكلير",
    "emoji": "",
    "imageUrl": "/menu/p-10240.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-2931",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10601",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10602",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10604",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10603",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10393",
    "categoryId": "cat-25",
    "nameEn": "Classic Mojito",
    "nameAr": "موهيتو كلاسيك",
    "emoji": "",
    "imageUrl": "/menu/p-10393.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-3065",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11186",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-11993",
    "categoryId": "cat-47",
    "nameEn": "Coconut protein Bar",
    "nameAr": "بار بروتين بجوز الهند",
    "emoji": "",
    "imageUrl": "/menu/p-11993.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10649",
    "categoryId": "cat-14",
    "nameEn": "Coffee Cake",
    "nameAr": "قالب كيك قهوة",
    "emoji": "",
    "imageUrl": "/menu/p-10649.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "(6-8) people",
        "nameAr": "(6-8) أشخاص",
        "price": 16
      },
      {
        "id": "M",
        "nameEn": "(10-12) poeple",
        "nameAr": "(10-12) أشخاص",
        "price": 20
      },
      {
        "id": "L",
        "nameEn": "(10-12) poeple",
        "nameAr": "(10-12) أشخاص",
        "price": 20
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10654",
    "categoryId": "cat-10",
    "nameEn": "Coffee Cake Piece",
    "nameAr": "قطعة كيك القهوة",
    "emoji": "",
    "imageUrl": "/menu/p-10654.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-2940",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10655",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10656",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10658",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10657",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10359",
    "categoryId": "cat-23",
    "nameEn": "Cold Brew",
    "nameAr": "كولد بيرو",
    "emoji": "",
    "imageUrl": "/menu/p-10359.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 3.6
      }
    ],
    "customizations": [
      {
        "id": "g-2770",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8640",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8626",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8627",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8638",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8639",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8630",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8631",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8637",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8636",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8634",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8628",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8629",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8635",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8632",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8633",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8641",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8642",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2985",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-10939",
            "nameEn": "No Milk",
            "nameAr": "بدون حليب",
            "priceDelta": 0
          },
          {
            "id": "o-10940",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-10933",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-10934",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-10935",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-10936",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-10937",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-10938",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3000",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-10995",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-10996",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11067",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11068",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-2694",
    "categoryId": "cat-23",
    "nameEn": "Cold Brew Bottle",
    "nameAr": "زجاجة مركز كولد برو",
    "emoji": "",
    "imageUrl": "/menu/p-2694.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10397",
    "categoryId": "cat-30",
    "nameEn": "Colombia Flores Single Origin Specialty Coffee 250 Grams",
    "nameAr": "كولومبيا فلوريس سينجل اوريجن قهموة مختصة  ٢٥٠ جرام",
    "emoji": "",
    "imageUrl": "/menu/p-10397.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 10
      }
    ],
    "customizations": [
      {
        "id": "g-3075",
        "nameEn": "Choose Grind Size:",
        "nameAr": "اختر حجم الطحن:",
        "multiple": false,
        "options": [
          {
            "id": "o-11208",
            "nameEn": "Whole Beans",
            "nameAr": "حبوب كاملة",
            "priceDelta": 0
          },
          {
            "id": "o-11209",
            "nameEn": "Turkish Grind",
            "nameAr": "طحن قهوة تركية",
            "priceDelta": 0
          },
          {
            "id": "o-11210",
            "nameEn": "American Grind",
            "nameAr": "طحن قهوة امريكية",
            "priceDelta": 0
          },
          {
            "id": "o-11211",
            "nameEn": "Espresso Grind",
            "nameAr": "طحنة قهوة اسبريسو",
            "priceDelta": 0
          },
          {
            "id": "o-11212",
            "nameEn": "V60 Grind",
            "nameAr": "طحن V60",
            "priceDelta": 0
          },
          {
            "id": "o-11213",
            "nameEn": "French Press Grind",
            "nameAr": "طحنة فرنش بريس",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10345",
    "categoryId": "cat-22",
    "nameEn": "Cortado",
    "nameAr": "Cortado",
    "emoji": "",
    "imageUrl": "/menu/p-10345.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.8
      }
    ],
    "customizations": [
      {
        "id": "g-1971",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7821",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-2528",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-2529",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-2530",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-2531",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-2532",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2533",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2534",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2760",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8468",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8454",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8455",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8466",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8467",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8458",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8459",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8465",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8464",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8462",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8456",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8457",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8463",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8460",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8461",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8469",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8470",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3020",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11073",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11074",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11075",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11076",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-11995",
    "categoryId": "cat-47",
    "nameEn": "Cranberry Oat Bar",
    "nameAr": "بار الشوفان بالتوت البري",
    "emoji": "",
    "imageUrl": "/menu/p-11995.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10165",
    "categoryId": "cat-3",
    "nameEn": "Cream Cheese Bagel",
    "nameAr": "بايغل مع جبنة كريمية",
    "emoji": "",
    "imageUrl": "/menu/p-10165.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-84",
        "nameEn": "Bagel Type",
        "nameAr": "نوع البيغل",
        "multiple": false,
        "options": [
          {
            "id": "o-234",
            "nameEn": "Plain",
            "nameAr": "سادة",
            "priceDelta": 0
          },
          {
            "id": "o-235",
            "nameEn": "Everything",
            "nameAr": "ايفري ثنج",
            "priceDelta": 0
          },
          {
            "id": "o-236",
            "nameEn": "Multigrain",
            "nameAr": "خلطة حبوب",
            "priceDelta": 0
          },
          {
            "id": "o-237",
            "nameEn": "Poppy Seed",
            "nameAr": "بوبي سيد",
            "priceDelta": 0
          },
          {
            "id": "o-238",
            "nameEn": "Sesame",
            "nameAr": "السمسم",
            "priceDelta": 0
          },
          {
            "id": "o-239",
            "nameEn": "Zatar",
            "nameAr": "زعتر",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3145",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11651",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11653",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11657",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2848",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9877",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9885",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-9888",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-9889",
            "nameEn": "Extra Cream Cheese",
            "nameAr": "اكسترا كريم تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-11886",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10151",
    "categoryId": "cat-2",
    "nameEn": "Cream Cheese Croissant",
    "nameAr": "كرواسون مع جبنة كريمية",
    "emoji": "",
    "imageUrl": "/menu/p-10151.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-3085",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11280",
            "nameEn": "Extra Cream Cheese",
            "nameAr": "اكسترا كريم تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-11847",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      },
      {
        "id": "g-3161",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11763",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11765",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11769",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10178",
    "categoryId": "cat-4",
    "nameEn": "Cream Cheese Keto Bagel",
    "nameAr": "كيتو بايغل مع جبنة كريمية",
    "emoji": "",
    "imageUrl": "/menu/p-10178.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": [
      {
        "id": "g-3146",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11658",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11660",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11664",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2818",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9337",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9345",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-9348",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-9349",
            "nameEn": "Extra Cream Cheese",
            "nameAr": "اكسترا كريم تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-11870",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10190",
    "categoryId": "cat-5",
    "nameEn": "Cream Cheese Sourdough",
    "nameAr": "Cream Cheese Sourdough",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-3178",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-12125",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-12126",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-12127",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2827",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9499",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9507",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-9510",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-9511",
            "nameEn": "Extra Cream Cheese",
            "nameAr": "اكسترا كريم تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-11874",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10259",
    "categoryId": "cat-11",
    "nameEn": "Crinkle Cookie",
    "nameAr": "كرنكل كوكيز",
    "emoji": "",
    "imageUrl": "/menu/p-10259.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": [
      {
        "id": "g-2871",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10169",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10170",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10172",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10173",
            "nameEn": "Extra Cream",
            "nameAr": "Extra Cream",
            "priceDelta": 0.45
          },
          {
            "id": "o-10174",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.45
          },
          {
            "id": "o-10171",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-12143",
    "categoryId": "cat-10",
    "nameEn": "Crunchy Chocolate Cheesecake Piece",
    "nameAr": "قطعة كرنشي تشوكلت",
    "emoji": "",
    "imageUrl": "/menu/p-12143.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-12142",
    "categoryId": "cat-14",
    "nameEn": "Crunchy Chocolate Full Cheesecake",
    "nameAr": "قالب كرنشي تشوكلت",
    "emoji": "",
    "imageUrl": "/menu/p-12142.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 20
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11933",
    "categoryId": "cat-10",
    "nameEn": "Crushed Lemon Tart Piece",
    "nameAr": "قطعة تارت الليمون المقرمش",
    "emoji": "",
    "imageUrl": "/menu/p-11933.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10234",
    "categoryId": "cat-10",
    "nameEn": "Dark Chocolate Flat Croissant",
    "nameAr": "فلات كروسان بالشوكلاتة الغامقة",
    "emoji": "",
    "imageUrl": "/menu/p-10234.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": [
      {
        "id": "g-2950",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10715",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10716",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10718",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10717",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10399",
    "categoryId": "cat-30",
    "nameEn": "Dark Roast Black Velvet Blend 250 G",
    "nameAr": "دارك روست بلاك فيلفيت بليند ٢٥٠ جم",
    "emoji": "",
    "imageUrl": "/menu/p-10399.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 6.25
      }
    ],
    "customizations": [
      {
        "id": "g-3077",
        "nameEn": "Choose Grind Size:",
        "nameAr": "اختر حجم الطحن:",
        "multiple": false,
        "options": [
          {
            "id": "o-11220",
            "nameEn": "Whole Beans",
            "nameAr": "حبوب كاملة",
            "priceDelta": 0
          },
          {
            "id": "o-11221",
            "nameEn": "Turkish Grind",
            "nameAr": "طحن قهوة تركية",
            "priceDelta": 0
          },
          {
            "id": "o-11222",
            "nameEn": "American Grind",
            "nameAr": "طحن قهوة امريكية",
            "priceDelta": 0
          },
          {
            "id": "o-11223",
            "nameEn": "Espresso Grind",
            "nameAr": "طحنة قهوة اسبريسو",
            "priceDelta": 0
          },
          {
            "id": "o-11224",
            "nameEn": "V60 Grind",
            "nameAr": "طحن V60",
            "priceDelta": 0
          },
          {
            "id": "o-11225",
            "nameEn": "French Press Grind",
            "nameAr": "طحنة فرنش بريس",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10230",
    "categoryId": "cat-10",
    "nameEn": "Double Berries Croissant",
    "nameAr": "كرواسون توت دبل",
    "emoji": "",
    "imageUrl": "/menu/p-10230.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-2906",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10451",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10452",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10454",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10453",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10265",
    "categoryId": "cat-11",
    "nameEn": "Double Chocolate Muffin",
    "nameAr": "دبل شوكليت مفن",
    "emoji": "",
    "imageUrl": "/menu/p-10265.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": [
      {
        "id": "g-2865",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10133",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10134",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10136",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10137",
            "nameEn": "Extra Cream",
            "nameAr": "Extra Cream",
            "priceDelta": 0.45
          },
          {
            "id": "o-10138",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.45
          },
          {
            "id": "o-10135",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-11761",
    "categoryId": "cat-14",
    "nameEn": "Double Chocolate Strawberry Cake",
    "nameAr": "قالب الشوكلاتة و الفراولة",
    "emoji": "",
    "imageUrl": "/menu/p-11761.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "(6-8) people",
        "nameAr": "(6-8) أشخاص",
        "price": 20
      }
    ],
    "customizations": []
  },
  {
    "id": "p-12086",
    "categoryId": "cat-6",
    "nameEn": "Duo Protein Sourdough Focaccia Sandwich",
    "nameAr": "ساندويش فوكاشيا ساوردو ديو بروتين",
    "emoji": "",
    "imageUrl": "/menu/p-12086.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10164",
    "categoryId": "cat-3",
    "nameEn": "Egg And Cheese Bagel",
    "nameAr": "بايغل مع جبنة وبيض",
    "emoji": "",
    "imageUrl": "/menu/p-10164.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-90",
        "nameEn": "Bagel Type",
        "nameAr": "نوع البيغل",
        "multiple": false,
        "options": [
          {
            "id": "o-290",
            "nameEn": "Plain",
            "nameAr": "سادة",
            "priceDelta": 0
          },
          {
            "id": "o-291",
            "nameEn": "Everything",
            "nameAr": "ايفري ثنج",
            "priceDelta": 0
          },
          {
            "id": "o-292",
            "nameEn": "Multigrain",
            "nameAr": "خلطة حبوب",
            "priceDelta": 0
          },
          {
            "id": "o-293",
            "nameEn": "Poppy Seed",
            "nameAr": "بوبي سيد",
            "priceDelta": 0
          },
          {
            "id": "o-294",
            "nameEn": "Sesame",
            "nameAr": "السمسم",
            "priceDelta": 0
          },
          {
            "id": "o-295",
            "nameEn": "Zatar",
            "nameAr": "زعتر",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3147",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11665",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11667",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11671",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2847",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9859",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9870",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11885",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12089",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10150",
    "categoryId": "cat-2",
    "nameEn": "Egg And Cheese Croissant",
    "nameAr": "كرواسون مع بيض وجبنة",
    "emoji": "",
    "imageUrl": "/menu/p-10150.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-2838",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9697",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9704",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9705",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-9708",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11861",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11929",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-11997",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          },
          {
            "id": "o-12065",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      },
      {
        "id": "g-3162",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11770",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11772",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11776",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10177",
    "categoryId": "cat-4",
    "nameEn": "Egg And Cheese Keto Bagel",
    "nameAr": "كيتو بايغل مع جبنة وبيض",
    "emoji": "",
    "imageUrl": "/menu/p-10177.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": [
      {
        "id": "g-2817",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9319",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9326",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9330",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-9331",
            "nameEn": "Extra Cream Cheese",
            "nameAr": "اكسترا كريم تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-11853",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11921",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-11989",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          },
          {
            "id": "o-12057",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      },
      {
        "id": "g-3148",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11672",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11674",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11678",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10191",
    "categoryId": "cat-5",
    "nameEn": "Egg Cheese Sourdough",
    "nameAr": "Egg Cheese Sourdough",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-2826",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9481",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9488",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9492",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11873",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-11379",
    "categoryId": "cat-15",
    "nameEn": "Egg Truffle Manousheh",
    "nameAr": "منقوشة ترفل",
    "emoji": "",
    "imageUrl": "/menu/p-11379.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": [
      {
        "id": "g-2716",
        "nameEn": "Dough Type",
        "nameAr": "نوع العجين",
        "multiple": false,
        "options": [
          {
            "id": "o-8292",
            "nameEn": "White Dough",
            "nameAr": "عجينة أبيض",
            "priceDelta": 0
          },
          {
            "id": "o-8293",
            "nameEn": "Whole Brown Dough",
            "nameAr": "عجينة القمح البلدي الكامل",
            "priceDelta": 0.5
          }
        ]
      },
      {
        "id": "g-2795",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8945",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-8946",
            "nameEn": "Extra Blue Cheese",
            "nameAr": "اكسترا بلو تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-8947",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8948",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8949",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-8950",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-8951",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-8953",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-8954",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8955",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-8956",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10342",
    "categoryId": "cat-22",
    "nameEn": "Espresso",
    "nameAr": "Espresso",
    "emoji": "",
    "imageUrl": "/menu/p-10342.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Short",
        "nameAr": "شورت",
        "price": 1.9
      }
    ],
    "customizations": [
      {
        "id": "g-2761",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8485",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8471",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8472",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8483",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8484",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8475",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8476",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8482",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8481",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8479",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8473",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8474",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8480",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8477",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8478",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8486",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8487",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3021",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11077",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11078",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10402",
    "categoryId": "cat-30",
    "nameEn": "Espresso Blend 250 Gm",
    "nameAr": "اسبريسو بليند ٢٥٠ جم",
    "emoji": "",
    "imageUrl": "/menu/p-10402.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 6.75
      }
    ],
    "customizations": [
      {
        "id": "g-3079",
        "nameEn": "Choose Grind Size:",
        "nameAr": "اختر حجم الطحن:",
        "multiple": false,
        "options": [
          {
            "id": "o-11232",
            "nameEn": "Whole Beans",
            "nameAr": "حبوب كاملة",
            "priceDelta": 0
          },
          {
            "id": "o-11233",
            "nameEn": "Turkish Grind",
            "nameAr": "طحن قهوة تركية",
            "priceDelta": 0
          },
          {
            "id": "o-11234",
            "nameEn": "American Grind",
            "nameAr": "طحن قهوة امريكية",
            "priceDelta": 0
          },
          {
            "id": "o-11235",
            "nameEn": "Espresso Grind",
            "nameAr": "طحنة قهوة اسبريسو",
            "priceDelta": 0
          },
          {
            "id": "o-11236",
            "nameEn": "V60 Grind",
            "nameAr": "طحن V60",
            "priceDelta": 0
          },
          {
            "id": "o-11237",
            "nameEn": "French Press Grind",
            "nameAr": "طحنة فرنش بريس",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10365",
    "categoryId": "cat-19",
    "nameEn": "Espresso Frappe",
    "nameAr": "اسبريسو فرابيه",
    "emoji": "",
    "imageUrl": "/menu/p-10365.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2047",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7835",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3001",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3002",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3003",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3004",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3005",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3006",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3007",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2694",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8184",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8185",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8186",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8197",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8198",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8189",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8190",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8196",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8195",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8193",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8187",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8188",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8194",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8191",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8192",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8435",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8436",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3006",
        "nameEn": "Extra For Frappe",
        "nameAr": "Extra For Frappe",
        "multiple": true,
        "options": [
          {
            "id": "o-11025",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11026",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11027",
            "nameEn": "No Whipped Cream",
            "nameAr": "No Whipped Cream",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10341",
    "categoryId": "cat-22",
    "nameEn": "Espresso Machiato",
    "nameAr": "Espresso Machiato",
    "emoji": "",
    "imageUrl": "/menu/p-10341.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Short",
        "nameAr": "شورت",
        "price": 2.2
      }
    ],
    "customizations": [
      {
        "id": "g-2647",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7953",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-7954",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-7955",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-7956",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-7957",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-7958",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-7959",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-7960",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2762",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8502",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8488",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8489",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8500",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8501",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8492",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8493",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8499",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8498",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8496",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8490",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8491",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8497",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8494",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8495",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8503",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8504",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3022",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11079",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11080",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11081",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10403",
    "categoryId": "cat-30",
    "nameEn": "Ethiopia 250 G",
    "nameAr": "اثيوبيا ٢٥٠ جرام",
    "emoji": "",
    "imageUrl": "/menu/p-10403.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 7
      }
    ],
    "customizations": [
      {
        "id": "g-3080",
        "nameEn": "Choose Grind Size:",
        "nameAr": "اختر حجم الطحن:",
        "multiple": false,
        "options": [
          {
            "id": "o-11238",
            "nameEn": "Whole Beans",
            "nameAr": "حبوب كاملة",
            "priceDelta": 0
          },
          {
            "id": "o-11239",
            "nameEn": "Turkish Grind",
            "nameAr": "طحن قهوة تركية",
            "priceDelta": 0
          },
          {
            "id": "o-11240",
            "nameEn": "American Grind",
            "nameAr": "طحن قهوة امريكية",
            "priceDelta": 0
          },
          {
            "id": "o-11241",
            "nameEn": "Espresso Grind",
            "nameAr": "طحنة قهوة اسبريسو",
            "priceDelta": 0
          },
          {
            "id": "o-11242",
            "nameEn": "V60 Grind",
            "nameAr": "طحن V60",
            "priceDelta": 0
          },
          {
            "id": "o-11243",
            "nameEn": "French Press Grind",
            "nameAr": "طحنة فرنش بريس",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10306",
    "categoryId": "cat-14",
    "nameEn": "Ferrero Rocher Cake",
    "nameAr": "كيكة فيريرو روشيه",
    "emoji": "",
    "imageUrl": "/menu/p-10306.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "(6-8) people",
        "nameAr": "(6-8) أشخاص",
        "price": 16
      },
      {
        "id": "M",
        "nameEn": "(10-12) poeple",
        "nameAr": "(10-12) أشخاص",
        "price": 20
      },
      {
        "id": "L",
        "nameEn": "15 (تواصي)",
        "nameAr": "15 (تواصي)",
        "price": 28
      },
      {
        "id": "L",
        "nameEn": "20 (تواصي)",
        "nameAr": "20 (تواصي)",
        "price": 38
      },
      {
        "id": "L",
        "nameEn": "25 (تواصي)",
        "nameAr": "25 (تواصي)",
        "price": 50
      }
    ],
    "customizations": [
      {
        "id": "g-2585",
        "nameEn": "Customize Cake",
        "nameAr": "تفصيلات قوالب الكيك",
        "multiple": true,
        "options": [
          {
            "id": "o-7760",
            "nameEn": "Sugar Picture",
            "nameAr": "صورة السكر",
            "priceDelta": 10
          }
        ]
      }
    ]
  },
  {
    "id": "p-12150",
    "categoryId": "cat-10",
    "nameEn": "Fig & Almond Cake Piece",
    "nameAr": "قطعة تين كيك",
    "emoji": "",
    "imageUrl": "/menu/p-12150.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-12131",
    "categoryId": "cat-8",
    "nameEn": "Fig & Walnut Fall Salad",
    "nameAr": "سلطة التين والجوز الخريفية(خيرات الخريف)",
    "emoji": "",
    "imageUrl": "/menu/p-12131.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-4469",
    "categoryId": "cat-44",
    "nameEn": "Flowers Cup",
    "nameAr": "كاسة ورود",
    "emoji": "",
    "imageUrl": "/menu/p-4469.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10340",
    "categoryId": "cat-22",
    "nameEn": "French Press",
    "nameAr": "French Press",
    "emoji": "",
    "imageUrl": "/menu/p-10340.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11901",
    "categoryId": "cat-10",
    "nameEn": "Frozen Yogurt Cup",
    "nameAr": "Frozen Yogurt Cup",
    "emoji": "",
    "imageUrl": "/menu/p-11901.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-3088",
        "nameEn": "Frozen Type",
        "nameAr": "Frozen Type",
        "multiple": false,
        "options": [
          {
            "id": "o-11316",
            "nameEn": "Plain",
            "nameAr": "Plain",
            "priceDelta": 0
          },
          {
            "id": "o-11317",
            "nameEn": "Strawberry",
            "nameAr": "Strawberry",
            "priceDelta": 0
          },
          {
            "id": "o-11318",
            "nameEn": "Caramel",
            "nameAr": "Caramel",
            "priceDelta": 0
          },
          {
            "id": "o-11319",
            "nameEn": "Chocolate",
            "nameAr": "Chocolate",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-11908",
    "categoryId": "cat-10",
    "nameEn": "Frozen Yogurt Cup - Sugar Free",
    "nameAr": "Frozen Yogurt Cup - Sugar Free",
    "emoji": "",
    "imageUrl": "/menu/p-11908.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-3089",
        "nameEn": "Frozen Type",
        "nameAr": "Frozen Type",
        "multiple": false,
        "options": [
          {
            "id": "o-11320",
            "nameEn": "Plain",
            "nameAr": "Plain",
            "priceDelta": 0
          },
          {
            "id": "o-11321",
            "nameEn": "Strawberry",
            "nameAr": "Strawberry",
            "priceDelta": 0
          },
          {
            "id": "o-11322",
            "nameEn": "Caramel",
            "nameAr": "Caramel",
            "priceDelta": 0
          },
          {
            "id": "o-11323",
            "nameEn": "Chocolate",
            "nameAr": "Chocolate",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-12088",
    "categoryId": "cat-9",
    "nameEn": "Fruit & Vegetable Meal",
    "nameAr": "وجبة الخضار و الفواكه",
    "emoji": "",
    "imageUrl": "/menu/p-12088.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11419",
    "categoryId": "cat-17",
    "nameEn": "Fruit Salad Cup",
    "nameAr": "Fruit Salad Cup",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10325",
    "categoryId": "cat-18",
    "nameEn": "Funghi Pizza",
    "nameAr": "فونجي بيتزا",
    "emoji": "",
    "imageUrl": "/menu/p-10325.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "White . Medium",
        "nameAr": "وسط ابيض",
        "price": 5.5
      },
      {
        "id": "M",
        "nameEn": "White . Large",
        "nameAr": "كبير ابيض",
        "price": 7.5
      },
      {
        "id": "L",
        "nameEn": "brown . Medium",
        "nameAr": "وسط اسمر",
        "price": 6
      }
    ],
    "customizations": [
      {
        "id": "g-2783",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8801",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-8802",
            "nameEn": "Extra Blue Cheese",
            "nameAr": "اكسترا بلو تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-8803",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8804",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8805",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-8806",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-8807",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-8809",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-8810",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8811",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          }
        ]
      },
      {
        "id": "g-1498",
        "nameEn": "Remove:",
        "nameAr": "ازالة:",
        "multiple": true,
        "options": [
          {
            "id": "o-856",
            "nameEn": "Remove Mushroom",
            "nameAr": "أزل الفطر",
            "priceDelta": 0
          },
          {
            "id": "o-11328",
            "nameEn": "Remove Mozzarella Cheese",
            "nameAr": "أزل الجبنة",
            "priceDelta": 0
          },
          {
            "id": "o-11329",
            "nameEn": "Remove Pizza Sauce",
            "nameAr": "أزل صوص البيتزا",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10305",
    "categoryId": "cat-14",
    "nameEn": "German Cake (تواصي)",
    "nameAr": "جيرمن كيك",
    "emoji": "",
    "imageUrl": "/menu/p-10305.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "(6-8) people",
        "nameAr": "(6-8) أشخاص",
        "price": 16
      },
      {
        "id": "M",
        "nameEn": "(10-12) poeple",
        "nameAr": "(10-12) أشخاص",
        "price": 20
      },
      {
        "id": "L",
        "nameEn": "15 (تواصي)",
        "nameAr": "15 (تواصي)",
        "price": 30
      },
      {
        "id": "L",
        "nameEn": "20 (تواصي)",
        "nameAr": "20 (تواصي)",
        "price": 40
      },
      {
        "id": "L",
        "nameEn": "25 (تواصي)",
        "nameAr": "25 (تواصي)",
        "price": 50
      }
    ],
    "customizations": [
      {
        "id": "g-2584",
        "nameEn": "Customize Cake",
        "nameAr": "تفصيلات قوالب الكيك",
        "multiple": true,
        "options": [
          {
            "id": "o-7759",
            "nameEn": "Sugar Picture",
            "nameAr": "صورة السكر",
            "priceDelta": 10
          }
        ]
      }
    ]
  },
  {
    "id": "p-10249",
    "categoryId": "cat-10",
    "nameEn": "German Cake Piece",
    "nameAr": "قطعة جيرمن كيك",
    "emoji": "",
    "imageUrl": "/menu/p-10249.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-2918",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10523",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10524",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10526",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10525",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-11774",
    "categoryId": "cat-6",
    "nameEn": "Gf Chicken Quesadilla Wrap",
    "nameAr": "ساندويش راب كاساديا الدجاج الخالي من الجلوتين",
    "emoji": "",
    "imageUrl": "/menu/p-11774.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11381",
    "categoryId": "cat-10",
    "nameEn": "Gianduja Chocolate Cake Piece",
    "nameAr": "قطعة شوكولاتة جياندوجا",
    "emoji": "",
    "imageUrl": "/menu/p-11381.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": [
      {
        "id": "g-2943",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10673",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10674",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10676",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10675",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10791",
    "categoryId": "cat-44",
    "nameEn": "Gift Box",
    "nameAr": "صندوق الهدايا",
    "emoji": "",
    "imageUrl": "/menu/p-10791.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11775",
    "categoryId": "cat-6",
    "nameEn": "Gluten Free Chicken Caesar Wrap",
    "nameAr": "ساندويش راب سيزر الدجاج الخالي من الجلوتين",
    "emoji": "",
    "imageUrl": "/menu/p-11775.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11830",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free Chocolate Chip Cookies",
    "nameAr": "تشوكليت شيب كوكي خالية من الجلوتين",
    "emoji": "",
    "imageUrl": "/menu/p-11830.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10282",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free Crunchy Almond Chocolate Cake (Dark Chocolate)",
    "nameAr": "كيكة الشوكلاتة باللوز المقرمش الخالية من الطحين (شوكلاتة غامقة)",
    "emoji": "",
    "imageUrl": "/menu/p-10282.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10655",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free Crunchy Almond Chocolate Cake (Milk Chocolate)",
    "nameAr": "كيكة الشوكلاتة باللوز المقرمش الخالية من الطحين (شوكلاتة بالحليب)",
    "emoji": "",
    "imageUrl": "/menu/p-10655.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11921",
    "categoryId": "cat-6",
    "nameEn": "Gluten Free Halloumi Wrap",
    "nameAr": "ساندويش راب الحلوم جلوتين فري",
    "emoji": "",
    "imageUrl": "/menu/p-11921.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10284",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free Keto Brownie",
    "nameAr": "براوني كيتو",
    "emoji": "",
    "imageUrl": "/menu/p-10284.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10281",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free Keto Carrot Cake",
    "nameAr": "كيكة جزر كيتو",
    "emoji": "",
    "imageUrl": "/menu/p-10281.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10270",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free Keto Chocolate Cake",
    "nameAr": "كيكة الشوكولاتة الكيتو",
    "emoji": "",
    "imageUrl": "/menu/p-10270.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10274",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free Keto Chocolate Hazelnut Cake",
    "nameAr": "شوكليت هيزلنت كيتو جلوتين فري كيك",
    "emoji": "",
    "imageUrl": "/menu/p-10274.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10280",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free Keto Lemon Poppy Seed Cake",
    "nameAr": "كيكة الليمون وبذور الخشخاش كيتو",
    "emoji": "",
    "imageUrl": "/menu/p-10280.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10279",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free Keto Marble Muffin",
    "nameAr": "ماربل كيتو مافن",
    "emoji": "",
    "imageUrl": "/menu/p-10279.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11590",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free Keto Panna Cotta",
    "nameAr": "بانا كوتا خالية من السكر وخالية من الجلوتين",
    "emoji": "",
    "imageUrl": "/menu/p-11590.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10278",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free Keto Pecan Cheese Cake",
    "nameAr": "كيتو بيكان تشيز كيك",
    "emoji": "",
    "imageUrl": "/menu/p-10278.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10277",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free Keto Red Velvet Cake",
    "nameAr": "كيكة ريد فيلفيت كيتو",
    "emoji": "",
    "imageUrl": "/menu/p-10277.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10273",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free Keto Tiramisu",
    "nameAr": "تيراميسو كيتو",
    "emoji": "",
    "imageUrl": "/menu/p-10273.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10276",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free Refined Sugar Free Banana Chocolate Cake",
    "nameAr": "كيكة شوكولاتة الموز الخالية من السكر المكرر",
    "emoji": "",
    "imageUrl": "/menu/p-10276.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11762",
    "categoryId": "cat-43",
    "nameEn": "Gluten free San Sebastian Full Cake",
    "nameAr": " قالب تشيزكيك سان سيباستيان جلوتين فري ",
    "emoji": "",
    "imageUrl": "/menu/p-11762.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 35
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11591",
    "categoryId": "cat-12",
    "nameEn": "Gluten Free San Sebastian Piece",
    "nameAr": "قطعة تشيزكيك سان سيباستيان خالية من الجلوتين",
    "emoji": "",
    "imageUrl": "/menu/p-11591.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10395",
    "categoryId": "cat-25",
    "nameEn": "Green Apple Mojito",
    "nameAr": "موهيتو التفاح الاخضر",
    "emoji": "",
    "imageUrl": "/menu/p-10395.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-3066",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11187",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-12057",
    "categoryId": "cat-30",
    "nameEn": "Guatemala Specialty Coffee 250 G",
    "nameAr": "جواتيمالا قهوة مختصة 250 جرام",
    "emoji": "",
    "imageUrl": "/menu/p-12057.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 7.25
      }
    ],
    "customizations": [
      {
        "id": "g-3122",
        "nameEn": "Choose Grind Size:",
        "nameAr": "اختر حجم الطحن:",
        "multiple": false,
        "options": [
          {
            "id": "o-11480",
            "nameEn": "Whole Beans",
            "nameAr": "حبوب كاملة",
            "priceDelta": 0
          },
          {
            "id": "o-11481",
            "nameEn": "Turkish Grind",
            "nameAr": "طحن قهوة تركية",
            "priceDelta": 0
          },
          {
            "id": "o-11482",
            "nameEn": "American Grind",
            "nameAr": "طحن قهوة امريكية",
            "priceDelta": 0
          },
          {
            "id": "o-11483",
            "nameEn": "Espresso Grind",
            "nameAr": "طحنة قهوة اسبريسو",
            "priceDelta": 0
          },
          {
            "id": "o-11484",
            "nameEn": "V60 Grind",
            "nameAr": "طحن V60",
            "priceDelta": 0
          },
          {
            "id": "o-11485",
            "nameEn": "French Press Grind",
            "nameAr": "طحنة فرنش بريس",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-3085",
    "categoryId": "cat-36",
    "nameEn": "Hairo V60 Plastic Coffee Dripper",
    "nameAr": "Hairo v60 plastic coffe dripper",
    "emoji": "",
    "imageUrl": "/menu/p-3085.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 7.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-12085",
    "categoryId": "cat-6",
    "nameEn": "Halloumi & Vegetable Sourdough Focaccia Sandwich",
    "nameAr": "ساندويش فوكاشيا ساوردو بالحلّوم والخضار",
    "emoji": "",
    "imageUrl": "/menu/p-12085.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10163",
    "categoryId": "cat-3",
    "nameEn": "Halloumi And Pesto Bagel",
    "nameAr": "بايغل حلوم وبيستو",
    "emoji": "",
    "imageUrl": "/menu/p-10163.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.4
      }
    ],
    "customizations": [
      {
        "id": "g-93",
        "nameEn": "Bagel Type",
        "nameAr": "نوع البيغل",
        "multiple": false,
        "options": [
          {
            "id": "o-318",
            "nameEn": "Plain",
            "nameAr": "سادة",
            "priceDelta": 0
          },
          {
            "id": "o-319",
            "nameEn": "Everything",
            "nameAr": "ايفري ثنج",
            "priceDelta": 0
          },
          {
            "id": "o-320",
            "nameEn": "Multigrain",
            "nameAr": "خلطة حبوب",
            "priceDelta": 0
          },
          {
            "id": "o-321",
            "nameEn": "Poppy Seed",
            "nameAr": "بوبي سيد",
            "priceDelta": 0
          },
          {
            "id": "o-322",
            "nameEn": "Sesame",
            "nameAr": "السمسم",
            "priceDelta": 0
          },
          {
            "id": "o-323",
            "nameEn": "Zatar",
            "nameAr": "زعتر",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3149",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11679",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11681",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11685",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2846",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9851",
            "nameEn": "Extra Halloumi",
            "nameAr": "اكسترا حلوم",
            "priceDelta": 1
          },
          {
            "id": "o-11884",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11952",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-10149",
    "categoryId": "cat-2",
    "nameEn": "Halloumi And Pesto Croissant",
    "nameAr": "كرواسون مع حلوم وبيستو",
    "emoji": "",
    "imageUrl": "/menu/p-10149.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.4
      }
    ],
    "customizations": [
      {
        "id": "g-2837",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9689",
            "nameEn": "Extra Halloumi",
            "nameAr": "اكسترا حلوم",
            "priceDelta": 1
          },
          {
            "id": "o-11860",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11928",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          }
        ]
      },
      {
        "id": "g-3163",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11777",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11779",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11783",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10175",
    "categoryId": "cat-4",
    "nameEn": "Halloumi And Pesto Keto Bagel",
    "nameAr": "كيتو بايغل حلوم وبيستو",
    "emoji": "",
    "imageUrl": "/menu/p-10175.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.4
      }
    ],
    "customizations": [
      {
        "id": "g-3150",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11686",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11688",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11692",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2816",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9311",
            "nameEn": "Extra Halloumi",
            "nameAr": "اكسترا حلوم",
            "priceDelta": 1
          },
          {
            "id": "o-11852",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11920",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-11988",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      },
      {
        "id": "g-256",
        "nameEn": "Without",
        "nameAr": "بدون اضافة",
        "multiple": true,
        "options": [
          {
            "id": "o-661",
            "nameEn": "Without Lettuce",
            "nameAr": "بدون خس",
            "priceDelta": 0
          },
          {
            "id": "o-662",
            "nameEn": "Without Black Olive",
            "nameAr": " بدون زيتون اسود",
            "priceDelta": 0
          },
          {
            "id": "o-663",
            "nameEn": "Without Tomato",
            "nameAr": "بدون بندورة",
            "priceDelta": 0
          },
          {
            "id": "o-667",
            "nameEn": "Without Sun Dried Tomato",
            "nameAr": "بدون بندورة مجففة ",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10192",
    "categoryId": "cat-5",
    "nameEn": "Halloumi Pesto Sourdough Bread",
    "nameAr": "حلوم بيستو خبز سوردو",
    "emoji": "",
    "imageUrl": "/menu/p-10192.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.4
      }
    ],
    "customizations": [
      {
        "id": "g-2825",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9473",
            "nameEn": "Extra Halloumi",
            "nameAr": "اكسترا حلوم",
            "priceDelta": 1
          },
          {
            "id": "o-11872",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11940",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-10195",
    "categoryId": "cat-6",
    "nameEn": "Halloumi Sandwich",
    "nameAr": "ساندويش حلوم",
    "emoji": "",
    "imageUrl": "/menu/p-10195.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.4
      }
    ],
    "customizations": [
      {
        "id": "g-2806",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9143",
            "nameEn": "Extra Halloumi",
            "nameAr": "اكسترا حلوم",
            "priceDelta": 1
          },
          {
            "id": "o-11831",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11899",
            "nameEn": "Extra Guacamole",
            "nameAr": "Extra Guacamole",
            "priceDelta": 1.5
          },
          {
            "id": "o-11967",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-11770",
    "categoryId": "cat-36",
    "nameEn": "Hario Ceramic Coffee Grinder Skerton",
    "nameAr": "Hario Ceramic Coffee Grinder Skerton",
    "emoji": "",
    "imageUrl": "/menu/p-11770.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 45
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11750",
    "categoryId": "cat-36",
    "nameEn": "Hario V60 Craft Coffee Maker",
    "nameAr": "Hario V60 Craft Coffee Maker",
    "emoji": "",
    "imageUrl": "/menu/p-11750.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 25
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10680",
    "categoryId": "cat-36",
    "nameEn": "Hario V60 Range Server",
    "nameAr": "Hario V60 Range Server",
    "emoji": "",
    "imageUrl": "/menu/p-10680.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 18
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10400",
    "categoryId": "cat-30",
    "nameEn": "Honduras Decaf Specialty Coffee 250 G",
    "nameAr": "هندوراس ديكاف قهوة مختصة 250 جرام",
    "emoji": "",
    "imageUrl": "/menu/p-10400.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 7.25
      }
    ],
    "customizations": [
      {
        "id": "g-3074",
        "nameEn": "Choose Grind Size:",
        "nameAr": "اختر حجم الطحن:",
        "multiple": false,
        "options": [
          {
            "id": "o-11202",
            "nameEn": "Whole Beans",
            "nameAr": "حبوب كاملة",
            "priceDelta": 0
          },
          {
            "id": "o-11203",
            "nameEn": "Turkish Grind",
            "nameAr": "طحن قهوة تركية",
            "priceDelta": 0
          },
          {
            "id": "o-11204",
            "nameEn": "American Grind",
            "nameAr": "طحن قهوة امريكية",
            "priceDelta": 0
          },
          {
            "id": "o-11205",
            "nameEn": "Espresso Grind",
            "nameAr": "طحنة قهوة اسبريسو",
            "priceDelta": 0
          },
          {
            "id": "o-11206",
            "nameEn": "V60 Grind",
            "nameAr": "طحن V60",
            "priceDelta": 0
          },
          {
            "id": "o-11207",
            "nameEn": "French Press Grind",
            "nameAr": "طحنة فرنش بريس",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10199",
    "categoryId": "cat-6",
    "nameEn": "Honey Mustard Chicken Sandwich",
    "nameAr": "ساندويش دجاج بالماسترد والعسل",
    "emoji": "",
    "imageUrl": "/menu/p-10199.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": [
      {
        "id": "g-2805",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9122",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9128",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 1.5
          },
          {
            "id": "o-11830",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12034",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10336",
    "categoryId": "cat-22",
    "nameEn": "Hot Almond Latte",
    "nameAr": "لاتيه الموند ساخن",
    "emoji": "",
    "imageUrl": "/menu/p-10336.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.5
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.1
      },
      {
        "id": "L",
        "nameEn": "Short",
        "nameAr": "شورت",
        "price": 3.2
      }
    ],
    "customizations": [
      {
        "id": "g-1972",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7822",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-2535",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-2536",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-2537",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-2538",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-2539",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2540",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2541",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3025",
        "nameEn": "Extra Almond Latte",
        "nameAr": "Extra Almond Latte",
        "multiple": false,
        "options": [
          {
            "id": "o-11087",
            "nameEn": "Extra Whipped Cream Only",
            "nameAr": "Extra Whipped Cream Only",
            "priceDelta": 0.4
          },
          {
            "id": "o-11088",
            "nameEn": "Extra Nuts Only",
            "nameAr": "Extra Nuts Only",
            "priceDelta": 0.4
          },
          {
            "id": "o-11089",
            "nameEn": "Extra Whipped Cream & Nuts",
            "nameAr": "Extra Whipped Cream & Nuts",
            "priceDelta": 0.4
          },
          {
            "id": "o-11090",
            "nameEn": "No Topping",
            "nameAr": "No Topping",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3026",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11091",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11092",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10334",
    "categoryId": "cat-22",
    "nameEn": "Hot Americano",
    "nameAr": "امريكانو ساخن",
    "emoji": "",
    "imageUrl": "/menu/p-10334.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 2.5
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 2.9
      },
      {
        "id": "L",
        "nameEn": "Short",
        "nameAr": "شورت",
        "price": 2.2
      }
    ],
    "customizations": [
      {
        "id": "g-2763",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8519",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8505",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8506",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8517",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8518",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8509",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8510",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8516",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8515",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8513",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8507",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8508",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8514",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8511",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8512",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8520",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8521",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-1973",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-2542",
            "nameEn": "No Milk",
            "nameAr": "بدون حليب",
            "priceDelta": 0
          },
          {
            "id": "o-10924",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-2543",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-2544",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-2545",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-2546",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-2547",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2548",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2549",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2993",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-10972",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-10973",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11063",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11064",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10337",
    "categoryId": "cat-22",
    "nameEn": "Hot Cappuccino",
    "nameAr": "كابتشينو ساخن",
    "emoji": "",
    "imageUrl": "/menu/p-10337.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.5
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.1
      },
      {
        "id": "L",
        "nameEn": "Short",
        "nameAr": "شورت",
        "price": 3.2
      }
    ],
    "customizations": [
      {
        "id": "g-1974",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7824",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-2550",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-2551",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-2552",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-2553",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-2554",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2555",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2556",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2692",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8154",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8155",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8156",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8167",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8168",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8159",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8160",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8166",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8165",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8163",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8157",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8158",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8164",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8161",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8162",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8522",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8523",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10343",
    "categoryId": "cat-22",
    "nameEn": "Hot Caramel Macchiato",
    "nameAr": "كراميل مكياتو ساخن",
    "emoji": "",
    "imageUrl": "/menu/p-10343.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.75
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.35
      },
      {
        "id": "L",
        "nameEn": "Short",
        "nameAr": "شورت",
        "price": 3.45
      }
    ],
    "customizations": [
      {
        "id": "g-1975",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7825",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-2557",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-2558",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-2559",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-2560",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-2561",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2562",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2563",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3028",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11097",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11098",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11099",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11100",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10380",
    "categoryId": "cat-27",
    "nameEn": "Hot Chai Latte",
    "nameAr": "شاي لاتيه",
    "emoji": "",
    "imageUrl": "/menu/p-10380.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 2.9
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 3.5
      }
    ],
    "customizations": [
      {
        "id": "g-2552",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7855",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-7684",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-7685",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-7686",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-7687",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-7688",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-7689",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-7690",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10348",
    "categoryId": "cat-21",
    "nameEn": "Hot Chocolate",
    "nameAr": "هوت شوكليت",
    "emoji": "",
    "imageUrl": "/menu/p-10348.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.75
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.35
      }
    ],
    "customizations": [
      {
        "id": "g-2044",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7832",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-2980",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-2981",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-2982",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-2983",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-2984",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2985",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2986",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2463",
        "nameEn": "Hot Chocolate Flavor",
        "nameAr": "نكهة الشوكلاتة الساخنة",
        "multiple": false,
        "options": [
          {
            "id": "o-7486",
            "nameEn": "Classic",
            "nameAr": "كلاسيك",
            "priceDelta": 0
          },
          {
            "id": "o-7487",
            "nameEn": "White",
            "nameAr": "وايت",
            "priceDelta": 0
          },
          {
            "id": "o-7488",
            "nameEn": "Dark",
            "nameAr": "دارك",
            "priceDelta": 0
          },
          {
            "id": "o-7489",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3019",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11071",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11072",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10205",
    "categoryId": "cat-6",
    "nameEn": "Hot Dog Pastries",
    "nameAr": "معجنات هوت دوغ",
    "emoji": "",
    "imageUrl": "/menu/p-10205.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.8
      }
    ],
    "customizations": [
      {
        "id": "g-2953",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-10738",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-10743",
            "nameEn": "Extra Cream Cheese",
            "nameAr": "اكسترا كريم تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-12050",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10333",
    "categoryId": "cat-22",
    "nameEn": "Hot Flat White",
    "nameAr": "فلات وايت ساخن",
    "emoji": "",
    "imageUrl": "/menu/p-10333.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.8
      }
    ],
    "customizations": [
      {
        "id": "g-1976",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7826",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-2564",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-2565",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-2566",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-2567",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-2568",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2569",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2570",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2765",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8555",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8541",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8542",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8553",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8554",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8545",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8546",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8552",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8551",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8549",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8543",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8544",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8550",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8547",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8548",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8556",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8557",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3030",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11105",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11106",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11107",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11108",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10338",
    "categoryId": "cat-22",
    "nameEn": "Hot Latte",
    "nameAr": "لاتيه ساخن",
    "emoji": "",
    "imageUrl": "/menu/p-10338.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.5
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.1
      },
      {
        "id": "L",
        "nameEn": "Short",
        "nameAr": "شورت",
        "price": 3.2
      }
    ],
    "customizations": [
      {
        "id": "g-1977",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7827",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-2571",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-2572",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-2573",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-2574",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-2575",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2576",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2577",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2690",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8138",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8124",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8125",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8136",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8137",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8128",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8129",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8135",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8134",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8132",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8126",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8127",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8133",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8130",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8131",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3031",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11109",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11110",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11111",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11112",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-12182",
    "categoryId": "cat-48",
    "nameEn": "Hot Macadamia Latte",
    "nameAr": "ماكاديميا لاتيه ساخن",
    "emoji": "",
    "imageUrl": "/menu/p-12182.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.5
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.1
      }
    ],
    "customizations": [
      {
        "id": "g-3167",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-11807",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-11801",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-11802",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-11803",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-11804",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-11805",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-11806",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10335",
    "categoryId": "cat-22",
    "nameEn": "Hot Mocha",
    "nameAr": "موكا ساخن",
    "emoji": "",
    "imageUrl": "/menu/p-10335.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.75
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.35
      },
      {
        "id": "L",
        "nameEn": "Short",
        "nameAr": "شورت",
        "price": 3.45
      }
    ],
    "customizations": [
      {
        "id": "g-1978",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7828",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-2578",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-2579",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-2580",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-2581",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-2582",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2583",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2584",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2627",
        "nameEn": "Mocha Flavor",
        "nameAr": "نكهة الموكا",
        "multiple": false,
        "options": [
          {
            "id": "o-7860",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          },
          {
            "id": "o-7861",
            "nameEn": "White Mocha",
            "nameAr": "موكا بيضاء",
            "priceDelta": 0
          },
          {
            "id": "o-7862",
            "nameEn": "Dark Mint Mocha",
            "nameAr": "موكا غامقة بالنعنع",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2767",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8589",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8575",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8576",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8587",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8588",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8579",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8580",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8586",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8585",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8583",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8577",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8578",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8584",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8581",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8582",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8590",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8591",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-12185",
    "categoryId": "cat-48",
    "nameEn": "Hot Pumpkin Pie Latte",
    "nameAr": "بمكن باي لاتيه ساخن",
    "emoji": "",
    "imageUrl": "/menu/p-12185.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.5
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.1
      }
    ],
    "customizations": [
      {
        "id": "g-3171",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-11825",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-11819",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-11820",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-11821",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-11822",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-11823",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-11824",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-11927",
    "categoryId": "cat-48",
    "nameEn": "Hot Seif Latte",
    "nameAr": "صيف لاتيه الساخن",
    "emoji": "",
    "imageUrl": "/menu/p-11927.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 4.35
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.95
      }
    ],
    "customizations": [
      {
        "id": "g-3106",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-11421",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-11417",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-11418",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-11419",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-11420",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-11398",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-11399",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10339",
    "categoryId": "cat-22",
    "nameEn": "Hot Spanish Latte",
    "nameAr": "سبانيش لاتيه ساخن",
    "emoji": "",
    "imageUrl": "/menu/p-10339.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.75
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.35
      },
      {
        "id": "L",
        "nameEn": "Short",
        "nameAr": "شورت",
        "price": 3.45
      }
    ],
    "customizations": [
      {
        "id": "g-1979",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7829",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-2585",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-2586",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-2587",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-2588",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-2589",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2590",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2591",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2768",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8606",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8592",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8593",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8604",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8605",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8596",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8597",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8603",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8602",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8600",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8594",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8595",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8601",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8598",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8599",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8607",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8608",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10344",
    "categoryId": "cat-22",
    "nameEn": "Hot Specialty Filter Coffee",
    "nameAr": "قهوة مفلترة مختصة ساخن",
    "emoji": "",
    "imageUrl": "/menu/p-10344.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 3.3
      },
      {
        "id": "L",
        "nameEn": "Short",
        "nameAr": "شورت",
        "price": 2.7
      }
    ],
    "customizations": [
      {
        "id": "g-2769",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8623",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8609",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8610",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8621",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8622",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8613",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8614",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8620",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8619",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8617",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8611",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8612",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8618",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8615",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8616",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8624",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8625",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3038",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-11128",
            "nameEn": "No Milk",
            "nameAr": "بدون حليب",
            "priceDelta": 0
          },
          {
            "id": "o-11129",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-11122",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-11123",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-11124",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-11125",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-11126",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-11127",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10379",
    "categoryId": "cat-27",
    "nameEn": "Hot Tchaba Tea",
    "nameAr": "شاي سبيشال",
    "emoji": "",
    "imageUrl": "/menu/p-10379.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-2632",
        "nameEn": "Tea Types",
        "nameAr": "نوع الشاي",
        "multiple": false,
        "options": [
          {
            "id": "o-7891",
            "nameEn": "Green Tea With Mint",
            "nameAr": "شاي أخضر بالنعناع",
            "priceDelta": 0
          },
          {
            "id": "o-7892",
            "nameEn": "Rosa Tea",
            "nameAr": "Rosa Tea",
            "priceDelta": 0
          },
          {
            "id": "o-7893",
            "nameEn": "Chamomile",
            "nameAr": "شاي البابونج",
            "priceDelta": 0
          },
          {
            "id": "o-7894",
            "nameEn": "Black Tea",
            "nameAr": "شاي اسود",
            "priceDelta": 0
          },
          {
            "id": "o-7895",
            "nameEn": "Ginger Tea",
            "nameAr": "شاي الزنجبيل",
            "priceDelta": 0
          },
          {
            "id": "o-7896",
            "nameEn": "Jasmine Tea",
            "nameAr": "شاي بالياسمين",
            "priceDelta": 0
          },
          {
            "id": "o-7897",
            "nameEn": "Green Tea",
            "nameAr": "شاي أخضر",
            "priceDelta": 0
          },
          {
            "id": "o-7898",
            "nameEn": "Masala Tea",
            "nameAr": "شاي ماسالا",
            "priceDelta": 0
          },
          {
            "id": "o-7899",
            "nameEn": "Earl Grey Tea",
            "nameAr": "شاي ايرل جراي",
            "priceDelta": 0
          },
          {
            "id": "o-7900",
            "nameEn": "Peppermint",
            "nameAr": "بيبرمنت",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10353",
    "categoryId": "cat-23",
    "nameEn": "Iced Americano",
    "nameAr": "امريكانو مثلج",
    "emoji": "",
    "imageUrl": "/menu/p-10353.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 2.5
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-2772",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8676",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8662",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8663",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8674",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8675",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8666",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8667",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8673",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8672",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8670",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8664",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8665",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8671",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8668",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8669",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8677",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8678",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2994",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-10980",
            "nameEn": "No Milk",
            "nameAr": "بدون حليب",
            "priceDelta": 0
          },
          {
            "id": "o-10981",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-10974",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-10975",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-10976",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-10977",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-10978",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-10979",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2996",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-10985",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-10986",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11065",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11066",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10354",
    "categoryId": "cat-23",
    "nameEn": "Iced Americano Cold Foam",
    "nameAr": "Iced Americano Cold Foam",
    "emoji": "",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 3.4
      }
    ],
    "customizations": [
      {
        "id": "g-2771",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8657",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8643",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8644",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8655",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8656",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8647",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8648",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8654",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8653",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8651",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8645",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8646",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8652",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8649",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8650",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8658",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8659",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2982",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-10923",
            "nameEn": "No Milk",
            "nameAr": "بدون حليب",
            "priceDelta": 0
          },
          {
            "id": "o-10914",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-10908",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-10909",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-10910",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-10911",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-10912",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-10913",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2988",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-10958",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-10959",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11061",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11062",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10361",
    "categoryId": "cat-23",
    "nameEn": "Iced Cappuccino Cold Foam",
    "nameAr": "Iced Cappuccino Cold Foam",
    "emoji": "",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.75
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.35
      }
    ],
    "customizations": [
      {
        "id": "g-2059",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7847",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3086",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3087",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3088",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3089",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3090",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3091",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3092",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2693",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8169",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8170",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8171",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8182",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8183",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8174",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8175",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8181",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8180",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8178",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8172",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8173",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8179",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8176",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8177",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8660",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8661",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10356",
    "categoryId": "cat-23",
    "nameEn": "Iced Caramel Macchiato",
    "nameAr": "كراميل مكياتو مثلج",
    "emoji": "",
    "imageUrl": "/menu/p-10356.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.75
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.35
      }
    ],
    "customizations": [
      {
        "id": "g-2060",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7848",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3093",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3094",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3095",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3096",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3097",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3098",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3099",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3041",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11138",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11139",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11140",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11141",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-11923",
    "categoryId": "cat-48",
    "nameEn": "Iced Coconut Matcha",
    "nameAr": "ماتشا جوز الهند المثلجة",
    "emoji": "",
    "imageUrl": "/menu/p-11923.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 4.35
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.95
      }
    ],
    "customizations": [
      {
        "id": "g-3096",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11385",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3094",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-11422",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0
          },
          {
            "id": "o-11423",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-11924",
    "categoryId": "cat-24",
    "nameEn": "Iced Ginger Lemonade (sugar free)",
    "nameAr": "الليمون مع الزنجبيل المثلج",
    "emoji": "",
    "imageUrl": "/menu/p-11924.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.5
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.1
      }
    ],
    "customizations": [
      {
        "id": "g-3099",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11388",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10352",
    "categoryId": "cat-23",
    "nameEn": "Iced Latte",
    "nameAr": "لاتيه مثلج",
    "emoji": "",
    "imageUrl": "/menu/p-10352.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.5
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.1
      }
    ],
    "customizations": [
      {
        "id": "g-2061",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7849",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3100",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3101",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3102",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3103",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3104",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3105",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3106",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2691",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8139",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8140",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8141",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8152",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8153",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8144",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8145",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8151",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8150",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8148",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8142",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8143",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8149",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8146",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8147",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8679",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3042",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11142",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11143",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11144",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11145",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-12184",
    "categoryId": "cat-48",
    "nameEn": "Iced Macadamia Latte",
    "nameAr": "ماكاديميا لاتيه مثلّج",
    "emoji": "",
    "imageUrl": "/menu/p-12184.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.75
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.35
      }
    ],
    "customizations": [
      {
        "id": "g-3169",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-11816",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-11810",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-11811",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-11812",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-11813",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-11814",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-11815",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-11370",
    "categoryId": "cat-24",
    "nameEn": "Iced Matcha Blueberry Latte",
    "nameAr": "ماتشا لاتيه مثلجو مع البلوبيري",
    "emoji": "",
    "imageUrl": "/menu/p-11370.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2713",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-8272",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-8273",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-8274",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-8275",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-8276",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-8277",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-8278",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-8279",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3048",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11166",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3056",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11177",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10383",
    "categoryId": "cat-24",
    "nameEn": "Iced Matcha Latte",
    "nameAr": "ماتشا لاتيه مثلج",
    "emoji": "",
    "imageUrl": "/menu/p-10383.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.5
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.1
      }
    ],
    "customizations": [
      {
        "id": "g-2554",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7857",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-7698",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-7699",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-7700",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-7701",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-7702",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-7703",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-7704",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3049",
        "nameEn": "Matcha Flavor",
        "nameAr": "فليفر الماتشا",
        "multiple": true,
        "options": [
          {
            "id": "o-11167",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-11168",
            "nameEn": "Honey",
            "nameAr": "عسل",
            "priceDelta": 0
          },
          {
            "id": "o-11169",
            "nameEn": "Sugar Free Vanilla",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3057",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11178",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-11925",
    "categoryId": "cat-48",
    "nameEn": "Iced Mhai Tai",
    "nameAr": "ماي تاي المثلج",
    "emoji": "",
    "imageUrl": "/menu/p-11925.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-3102",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11391",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3109",
        "nameEn": "Type",
        "nameAr": "Type",
        "multiple": false,
        "options": [
          {
            "id": "o-11415",
            "nameEn": "Sparkling water",
            "nameAr": "Sparkling water",
            "priceDelta": 0
          },
          {
            "id": "o-11416",
            "nameEn": "soft drink",
            "nameAr": "soft drink",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10358",
    "categoryId": "cat-23",
    "nameEn": "Iced Mocha",
    "nameAr": "موكا مثلجة",
    "emoji": "",
    "imageUrl": "/menu/p-10358.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.75
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.35
      }
    ],
    "customizations": [
      {
        "id": "g-2062",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7850",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3107",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3108",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3109",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3110",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3111",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3112",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3113",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2628",
        "nameEn": "Mocha Flavor",
        "nameAr": "نكهة الموكا",
        "multiple": false,
        "options": [
          {
            "id": "o-7863",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          },
          {
            "id": "o-7864",
            "nameEn": "White Mocha",
            "nameAr": "موكا بيضاء",
            "priceDelta": 0
          },
          {
            "id": "o-7865",
            "nameEn": "Dark Mint Mocha",
            "nameAr": "موكا غامقة بالنعنع",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2773",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8694",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8680",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8681",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8692",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8693",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8684",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8685",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8691",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8690",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8688",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8682",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8683",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8689",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8686",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8687",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8695",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8696",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10362",
    "categoryId": "cat-23",
    "nameEn": "Iced Pistachio Latte",
    "nameAr": "Iced Pistachio Latte",
    "emoji": "",
    "imageUrl": "/menu/p-10362.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2063",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7851",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3114",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3115",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3116",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3117",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3118",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3119",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3120",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3043",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11146",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11147",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11148",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11149",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-12187",
    "categoryId": "cat-48",
    "nameEn": "Iced Pumpkin Pie Latte",
    "nameAr": "بمكن باي لاتيه مثلّج",
    "emoji": "",
    "imageUrl": "/menu/p-12187.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.75
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.35
      }
    ],
    "customizations": [
      {
        "id": "g-3173",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-12106",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-12100",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-12101",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-12102",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-12103",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-12104",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-12105",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-11926",
    "categoryId": "cat-48",
    "nameEn": "Iced Seif Latte",
    "nameAr": "صيف لاتيه المثلج",
    "emoji": "",
    "imageUrl": "/menu/p-11926.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 4.35
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.95
      }
    ],
    "customizations": [
      {
        "id": "g-3105",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11394",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3103",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-11406",
            "nameEn": "No Milk",
            "nameAr": "بدون حليب",
            "priceDelta": 0
          },
          {
            "id": "o-11407",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-11400",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-11401",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-11402",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-11403",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-11404",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-11405",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10355",
    "categoryId": "cat-23",
    "nameEn": "Iced Shaken",
    "nameAr": "ايسيد شيكن",
    "emoji": "",
    "imageUrl": "/menu/p-10355.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.75
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.35
      }
    ],
    "customizations": [
      {
        "id": "g-2064",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7852",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3121",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3122",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3123",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3124",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3125",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3126",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3127",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2695",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8199",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8200",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8201",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8212",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8213",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8204",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8205",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8211",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8210",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8208",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8202",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8203",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8209",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8206",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8207",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8214",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8697",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3045",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11154",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11155",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11156",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11157",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10357",
    "categoryId": "cat-23",
    "nameEn": "Iced Spanish Latte",
    "nameAr": "ايس سبانيش لاتيه",
    "emoji": "",
    "imageUrl": "/menu/p-10357.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.75
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.35
      }
    ],
    "customizations": [
      {
        "id": "g-2065",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7853",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3128",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3129",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3130",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3131",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3132",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3133",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3134",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3047",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11162",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11163",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11164",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11165",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-11369",
    "categoryId": "cat-24",
    "nameEn": "Iced Strawberry Matcha Latte",
    "nameAr": "Iced Strawberry Matcha Latte",
    "emoji": "",
    "imageUrl": "/menu/p-11369.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2711",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-8262",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-8263",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-8264",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-8265",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-8266",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-8267",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-8268",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-8269",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3051",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11171",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3055",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11176",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10382",
    "categoryId": "cat-24",
    "nameEn": "Iced Tea",
    "nameAr": "شاي مثلج",
    "emoji": "",
    "imageUrl": "/menu/p-10382.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 2.9
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 3.5
      },
      {
        "id": "L",
        "nameEn": "Short",
        "nameAr": "شورت",
        "price": 2.6
      }
    ],
    "customizations": [
      {
        "id": "g-3059",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11180",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10774",
    "categoryId": "cat-8",
    "nameEn": "Kale Salad",
    "nameAr": "سلطة الكيل",
    "emoji": "",
    "imageUrl": "/menu/p-10774.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 5.5
      }
    ],
    "customizations": [
      {
        "id": "g-2856",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11835",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11971",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          },
          {
            "id": "o-12039",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-11355",
    "categoryId": "cat-43",
    "nameEn": "Keto Carrot Full Cake",
    "nameAr": "قالب الجزر كيتو",
    "emoji": "",
    "imageUrl": "/menu/p-11355.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 30
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11354",
    "categoryId": "cat-43",
    "nameEn": "Keto Chocolate Full Cake",
    "nameAr": "قالب الشوكولاتة كيتو",
    "emoji": "",
    "imageUrl": "/menu/p-11354.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 30
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11360",
    "categoryId": "cat-43",
    "nameEn": "Keto Chocolate Hazelnut Full Cake",
    "nameAr": "قالب شوكولاتة بالبندق كيتو",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 30
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11357",
    "categoryId": "cat-43",
    "nameEn": "Keto Lemon Full Cake",
    "nameAr": "قالب ليمون كيتو",
    "emoji": "",
    "imageUrl": "/menu/p-11357.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 30
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11356",
    "categoryId": "cat-43",
    "nameEn": "Keto Marble Full Cake",
    "nameAr": "قالب كيك ماربل كيتو",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 30
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11358",
    "categoryId": "cat-43",
    "nameEn": "Keto Pecan Full Cheesecake",
    "nameAr": "قالب بيكان تشيز كيك كيتو",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 30
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10349",
    "categoryId": "cat-21",
    "nameEn": "Kids Hot Chocolate",
    "nameAr": "شوكولاتة ساخنة للاطفال",
    "emoji": "",
    "imageUrl": "/menu/p-10349.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Short",
        "nameAr": "شورت",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-2636",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7912",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-7913",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-7914",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-7915",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-7916",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-7917",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-7918",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-7919",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3018",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11069",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11070",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10239",
    "categoryId": "cat-10",
    "nameEn": "Lazy Cake",
    "nameAr": "ليزي كيك",
    "emoji": "",
    "imageUrl": "/menu/p-10239.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.25
      }
    ],
    "customizations": [
      {
        "id": "g-2930",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10595",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10596",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10598",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10597",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10304",
    "categoryId": "cat-14",
    "nameEn": "Lemon Cake",
    "nameAr": "قالب ليمون",
    "emoji": "",
    "imageUrl": "/menu/p-10304.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "(6-8) people",
        "nameAr": "(6-8) أشخاص",
        "price": 16
      },
      {
        "id": "M",
        "nameEn": "(10-12) poeple",
        "nameAr": "(10-12) أشخاص",
        "price": 20
      },
      {
        "id": "L",
        "nameEn": "15 (تواصي)",
        "nameAr": "15 (تواصي)",
        "price": 28
      },
      {
        "id": "L",
        "nameEn": "20 (تواصي)",
        "nameAr": "20 (تواصي)",
        "price": 38
      },
      {
        "id": "L",
        "nameEn": "25 (تواصي)",
        "nameAr": "25 (تواصي)",
        "price": 50
      }
    ],
    "customizations": [
      {
        "id": "g-2583",
        "nameEn": "Customize Cake",
        "nameAr": "تفصيلات قوالب الكيك",
        "multiple": true,
        "options": [
          {
            "id": "o-7758",
            "nameEn": "Sugar Picture",
            "nameAr": "صورة السكر",
            "priceDelta": 10
          }
        ]
      }
    ]
  },
  {
    "id": "p-10229",
    "categoryId": "cat-10",
    "nameEn": "Lemon Cheesecake",
    "nameAr": "شيز كيك الليمون",
    "emoji": "",
    "imageUrl": "/menu/p-10229.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.25
      }
    ],
    "customizations": [
      {
        "id": "g-2922",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10547",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10548",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10550",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10549",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10385",
    "categoryId": "cat-24",
    "nameEn": "Lemon Juice",
    "nameAr": "عصير ليمون",
    "emoji": "",
    "imageUrl": "/menu/p-10385.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.4
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4
      }
    ],
    "customizations": [
      {
        "id": "g-2561",
        "nameEn": "Juice Type",
        "nameAr": "نوع العصير",
        "multiple": true,
        "options": [
          {
            "id": "o-7730",
            "nameEn": "Iced",
            "nameAr": "مكعبات ثلج",
            "priceDelta": 0
          },
          {
            "id": "o-7731",
            "nameEn": "Smoothie",
            "nameAr": "سموذي",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3060",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11181",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10248",
    "categoryId": "cat-10",
    "nameEn": "Lemon Poppy Seed Cake Piece",
    "nameAr": "قطعة كيكة الليمون مع بذور الخشخاش",
    "emoji": "",
    "imageUrl": "/menu/p-10248.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-2917",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10517",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10518",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10520",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10519",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-11634",
    "categoryId": "cat-40",
    "nameEn": "Mamoul Assorted Gf (1 Kg)",
    "nameAr": "كيلو معمول مشكل خالي جلوتين",
    "emoji": "",
    "imageUrl": "/menu/p-11634.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 15.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10296",
    "categoryId": "cat-40",
    "nameEn": "Mamoul Dates (1 Kg)",
    "nameAr": "كيلو معمول تمر",
    "emoji": "",
    "imageUrl": "/menu/p-10296.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 11.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11587",
    "categoryId": "cat-40",
    "nameEn": "Mamoul Dates (1/2 Kg)",
    "nameAr": "نصف كيلو معمول تمر",
    "emoji": "",
    "imageUrl": "/menu/p-11587.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 5.95
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11631",
    "categoryId": "cat-40",
    "nameEn": "Mamoul Dates Gf (1 Kg)",
    "nameAr": "كيلو معمول تمر خالي جلوتين",
    "emoji": "",
    "imageUrl": "/menu/p-11631.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 12.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11611",
    "categoryId": "cat-40",
    "nameEn": "Mamoul Dates Gf (1/2 Kg)",
    "nameAr": "نصف كيلو معمول تمر خالي جلوتين",
    "emoji": "",
    "imageUrl": "/menu/p-11611.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 6.45
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10294",
    "categoryId": "cat-40",
    "nameEn": "Mamoul Jouz (1 Kg)",
    "nameAr": "كيلو معمول جوز",
    "emoji": "",
    "imageUrl": "/menu/p-10294.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 14.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11586",
    "categoryId": "cat-40",
    "nameEn": "Mamoul Jouz (1/2 Kg)",
    "nameAr": "نصف كيلو معمول جوز",
    "emoji": "",
    "imageUrl": "/menu/p-11586.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 7.45
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11632",
    "categoryId": "cat-40",
    "nameEn": "Mamoul Jouz Gf (1 Kg)",
    "nameAr": "كيلو معمول جوز خالي جلوتين",
    "emoji": "",
    "imageUrl": "/menu/p-11632.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 15.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11614",
    "categoryId": "cat-40",
    "nameEn": "Mamoul Jouz Gf (1/2 Kg)",
    "nameAr": "نصف كيلو معمول جوز خالي جلوتين",
    "emoji": "",
    "imageUrl": "/menu/p-11614.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 7.95
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11588",
    "categoryId": "cat-40",
    "nameEn": "Mamoul Mshakkal 1 Kg",
    "nameAr": "كيلو معمول مشكل",
    "emoji": "",
    "imageUrl": "/menu/p-11588.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 14.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11584",
    "categoryId": "cat-40",
    "nameEn": "Mamoul Pistachio (1 Kg)",
    "nameAr": "كيلو معمول فستق",
    "emoji": "",
    "imageUrl": "/menu/p-11584.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 17.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11585",
    "categoryId": "cat-40",
    "nameEn": "Mamoul Pistachio (1/2 Kg)",
    "nameAr": "نصف كيلو معمول فستق",
    "emoji": "",
    "imageUrl": "/menu/p-11585.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 8.95
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11633",
    "categoryId": "cat-40",
    "nameEn": "Mamoul Pistachio Gf (1 Kg)",
    "nameAr": "كيلو معمول فستق خالي جلوتين",
    "emoji": "",
    "imageUrl": "/menu/p-11633.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 18.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11615",
    "categoryId": "cat-40",
    "nameEn": "Mamoul Pistachio Gf (1/2 Kg)",
    "nameAr": "نصف كيلو معمول فستق خالي جلوتين",
    "emoji": "",
    "imageUrl": "/menu/p-11615.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 9.45
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10375",
    "categoryId": "cat-20",
    "nameEn": "Mango & Passion Crème Frappe",
    "nameAr": "مانجا و باشن فراب",
    "emoji": "",
    "imageUrl": "/menu/p-10375.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2053",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7841",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3043",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3044",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3045",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3046",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3047",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3048",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3049",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3014",
        "nameEn": "Extra For Frappe",
        "nameAr": "Extra For Frappe",
        "multiple": true,
        "options": [
          {
            "id": "o-11049",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11050",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11051",
            "nameEn": "No Whipped Cream",
            "nameAr": "No Whipped Cream",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10761",
    "categoryId": "cat-24",
    "nameEn": "Mango & Passion Orange Juice",
    "nameAr": "Mango & Passion Orange Juice",
    "emoji": "",
    "imageUrl": "/menu/p-10761.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 4.35
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.95
      }
    ],
    "customizations": [
      {
        "id": "g-3061",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11182",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10391",
    "categoryId": "cat-25",
    "nameEn": "Mango And Passion Fruit Mojito",
    "nameAr": "موهيتو مانجا وباشن فروت",
    "emoji": "",
    "imageUrl": "/menu/p-10391.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-3067",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11188",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10390",
    "categoryId": "cat-25",
    "nameEn": "Mango Mojito",
    "nameAr": "موهيتو مانجا",
    "emoji": "",
    "imageUrl": "/menu/p-10390.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-3068",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11189",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10225",
    "categoryId": "cat-10",
    "nameEn": "Marble English Cake",
    "nameAr": "ماربل انجليش كيك",
    "emoji": "",
    "imageUrl": "/menu/p-10225.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": [
      {
        "id": "g-2925",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10565",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10566",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10568",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10567",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10324",
    "categoryId": "cat-18",
    "nameEn": "Margherita Pizza",
    "nameAr": "مارغريتا بيتزا",
    "emoji": "",
    "imageUrl": "/menu/p-10324.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "White . Medium",
        "nameAr": "وسط ابيض",
        "price": 4.5
      },
      {
        "id": "M",
        "nameEn": "White . Large",
        "nameAr": "كبير ابيض",
        "price": 6.5
      },
      {
        "id": "L",
        "nameEn": "brown . Medium",
        "nameAr": "وسط اسمر",
        "price": 5
      }
    ],
    "customizations": [
      {
        "id": "g-2784",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8816",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8818",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-8819",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-11307",
            "nameEn": "Extra Green Olive",
            "nameAr": "Extra Green Olive",
            "priceDelta": 0.6
          }
        ]
      },
      {
        "id": "g-1500",
        "nameEn": "Remove:",
        "nameAr": "ازالة:",
        "multiple": true,
        "options": [
          {
            "id": "o-11308",
            "nameEn": "Remove Mozzarella Cheese",
            "nameAr": "أزل الجبنة",
            "priceDelta": 0
          },
          {
            "id": "o-11309",
            "nameEn": "Remove Pizza Sauce",
            "nameAr": "أزل صوص البيتزا",
            "priceDelta": 0
          },
          {
            "id": "o-11306",
            "nameEn": "Remove Basil Leaves",
            "nameAr": "أزل أوراق الريحان",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10419",
    "categoryId": "cat-17",
    "nameEn": "Mini Alfredo Chicken Sandwich",
    "nameAr": "ميني الفريدو ساندوش",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10410",
    "categoryId": "cat-17",
    "nameEn": "Mini Almond Croissant",
    "nameAr": "ميني الموند كرواسان",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.25
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10446",
    "categoryId": "cat-17",
    "nameEn": "Mini Blueberry Cheesecake",
    "nameAr": "ميني بلوبيري تشيز كيك",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10435",
    "categoryId": "cat-17",
    "nameEn": "Mini Blueberry Muffin",
    "nameAr": "ميني بلوبيري مفن",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10438",
    "categoryId": "cat-17",
    "nameEn": "Mini Blueberry Tart",
    "nameAr": "ميني بلوبيري تارت",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10451",
    "categoryId": "cat-17",
    "nameEn": "Mini Blueberry Trifle",
    "nameAr": "ميني بلوبيري مفن كاسة",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10449",
    "categoryId": "cat-17",
    "nameEn": "Mini Brownie",
    "nameAr": "ميني براونيز",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.95
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10289",
    "categoryId": "cat-13",
    "nameEn": "Mini Brownies Box 8 Pieces",
    "nameAr": "بوكس ميني براونيز ٨ قطعة",
    "emoji": "",
    "imageUrl": "/menu/p-10289.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10420",
    "categoryId": "cat-17",
    "nameEn": "Mini Bufallo Chicken Sandwich",
    "nameAr": "ميني بافلو ساندويش",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10427",
    "categoryId": "cat-17",
    "nameEn": "Mini Caprese Salad Skewer",
    "nameAr": "ميني كابريس سلطة",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10445",
    "categoryId": "cat-17",
    "nameEn": "Mini Carrot Cake",
    "nameAr": "ميني كاروت كيك",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10409",
    "categoryId": "cat-17",
    "nameEn": "Mini Cheese Croissant",
    "nameAr": "ميني كرواسان جبنة",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10426",
    "categoryId": "cat-17",
    "nameEn": "Mini Chicken Ceaser Salad",
    "nameAr": "ميني سلطة سيزر",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10423",
    "categoryId": "cat-17",
    "nameEn": "Mini Chicken Pasta Salad",
    "nameAr": "ميني سلطة باستا",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10418",
    "categoryId": "cat-17",
    "nameEn": "Mini Chinese Chicken Sandwich",
    "nameAr": "ميني تشاينيز ساندويش",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10431",
    "categoryId": "cat-17",
    "nameEn": "Mini Chives Cheese Danish",
    "nameAr": "ميني تشايف دانش",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.95
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10432",
    "categoryId": "cat-17",
    "nameEn": "Mini Chocolate Chip Cookie",
    "nameAr": "ميني شوكلت شيب كوكي",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.45
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10288",
    "categoryId": "cat-13",
    "nameEn": "Mini Chocolate Chip Cookies Box 12 Pieces",
    "nameAr": "ميني تشوكليت شيب كوكي بوكس ١٢ حبة",
    "emoji": "",
    "imageUrl": "/menu/p-10288.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10443",
    "categoryId": "cat-17",
    "nameEn": "Mini Chocolate Eclair",
    "nameAr": "ميني شوكلت ايكلير",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10450",
    "categoryId": "cat-17",
    "nameEn": "Mini Chocolate Mousse Cup",
    "nameAr": "ميني شوكلت موس",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11577",
    "categoryId": "cat-17",
    "nameEn": "Mini Chocolate Muffin",
    "nameAr": "ميني شوكلت مفن",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10439",
    "categoryId": "cat-17",
    "nameEn": "Mini Chocolate Tart",
    "nameAr": "ميني شوكلت تارت",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10433",
    "categoryId": "cat-17",
    "nameEn": "Mini Crinkle Cookie",
    "nameAr": "ميني كرنكل كوكي",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.35
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10287",
    "categoryId": "cat-13",
    "nameEn": "Mini Crinkle Cookies Box 12 Pieces",
    "nameAr": "ميني كرينكيل كوكي بوكس ١٢ حبة",
    "emoji": "",
    "imageUrl": "/menu/p-10287.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10428",
    "categoryId": "cat-17",
    "nameEn": "Mini Crudits",
    "nameAr": "ميني كردتس",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10442",
    "categoryId": "cat-17",
    "nameEn": "Mini Custard Eclair",
    "nameAr": "ميني كاسترد ايكلير",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-5210",
    "categoryId": "cat-36",
    "nameEn": "Mini Hairo Ceramic Coffe Grinder Skerton",
    "nameAr": "Mini hairo ceramic coffe grinder skerton",
    "emoji": "",
    "imageUrl": "/menu/p-5210.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 40
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10413",
    "categoryId": "cat-17",
    "nameEn": "Mini Halloum Bagel",
    "nameAr": "ميني حلوم بيجل",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10416",
    "categoryId": "cat-17",
    "nameEn": "Mini Halloumi Sandwich",
    "nameAr": "ميني حلوم ساندويش",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.25
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10421",
    "categoryId": "cat-17",
    "nameEn": "Mini Honey Mustard Chicken Sandwich",
    "nameAr": "ميني ماسترد ساندويش",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10448",
    "categoryId": "cat-17",
    "nameEn": "Mini Lemon Cheesecake",
    "nameAr": "ميني ليمون تشيز كيك",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10447",
    "categoryId": "cat-17",
    "nameEn": "Mini Lemon Poppyseed Cake",
    "nameAr": "ميني ليمون بوبي سيد كيك",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10429",
    "categoryId": "cat-17",
    "nameEn": "Mini Mango Danish",
    "nameAr": "ميني مانجو دانش",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.95
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10437",
    "categoryId": "cat-17",
    "nameEn": "Mini Mango Tart",
    "nameAr": "ميني مانجو تارت",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-12044",
    "categoryId": "cat-18",
    "nameEn": "Mini Margherita Pizza",
    "nameAr": "Mini Margherita Pizza",
    "emoji": "",
    "imageUrl": "/menu/p-12044.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10417",
    "categoryId": "cat-17",
    "nameEn": "Mini Mexican Checken Sandwich",
    "nameAr": "ميني ميكسيكان ساندويش",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11391",
    "categoryId": "cat-17",
    "nameEn": "Mini Mille Feuille Vanille",
    "nameAr": "MINI MILLE FEUILLE VANILLE",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10422",
    "categoryId": "cat-17",
    "nameEn": "Mini Nachos Salad",
    "nameAr": "ميني سلطة ناتشوز",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10434",
    "categoryId": "cat-17",
    "nameEn": "Mini Nutella Muffin",
    "nameAr": "ميني نوتيلا مفن",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-12043",
    "categoryId": "cat-18",
    "nameEn": "Mini Pepperoni Pizza",
    "nameAr": "Mini Pepperoni Pizza",
    "emoji": "",
    "imageUrl": "/menu/p-12043.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11390",
    "categoryId": "cat-17",
    "nameEn": "Mini Pistachio Eclair",
    "nameAr": "ميني اكلير بيستاشيو",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10440",
    "categoryId": "cat-17",
    "nameEn": "Mini Pistachio Tart",
    "nameAr": "ميني بيستاشيو تارت",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10406",
    "categoryId": "cat-17",
    "nameEn": "Mini Plain Croissant",
    "nameAr": "ميني كرواسان عادي",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11389",
    "categoryId": "cat-17",
    "nameEn": "Mini Pomegranate Cheesecake",
    "nameAr": "ميني رمان تشيز كيك",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10425",
    "categoryId": "cat-17",
    "nameEn": "Mini Quinoa Salad",
    "nameAr": "ميني سلطة كينوا",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10441",
    "categoryId": "cat-17",
    "nameEn": "Mini Raspberry Panna Cotta",
    "nameAr": "ميني رازبيري بانا كوتا",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.25
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11420",
    "categoryId": "cat-17",
    "nameEn": "Mini Roast Beef Bagel",
    "nameAr": "ميني روست بيف بيجل",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10414",
    "categoryId": "cat-17",
    "nameEn": "Mini Roast Beef Sandwich",
    "nameAr": "ميني روست بيف ساندويش",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.25
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10424",
    "categoryId": "cat-17",
    "nameEn": "Mini Rocca Salad",
    "nameAr": "ميني سلطة روكا",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10412",
    "categoryId": "cat-17",
    "nameEn": "Mini Salmon Bagel",
    "nameAr": "ميني سالمون بيغل",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10430",
    "categoryId": "cat-17",
    "nameEn": "Mini Strawberry Danish",
    "nameAr": "ميني فراولة دانش",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.95
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10436",
    "categoryId": "cat-17",
    "nameEn": "Mini Strawberry Tart",
    "nameAr": "ميني تارت الفراولة",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10444",
    "categoryId": "cat-17",
    "nameEn": "Mini Tiramisu Cup",
    "nameAr": "ميني تيراميسو",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10411",
    "categoryId": "cat-17",
    "nameEn": "Mini Turkey Cheese Bagel",
    "nameAr": "ميني تيركي تشيز بيجل",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10407",
    "categoryId": "cat-17",
    "nameEn": "Mini Turkey Croissant",
    "nameAr": "ميني تيركي كرواسان",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.25
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10415",
    "categoryId": "cat-17",
    "nameEn": "Mini Turkey Sandwich",
    "nameAr": "ميني تيركي ساندويش",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.25
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10408",
    "categoryId": "cat-17",
    "nameEn": "Mini Zatar Croissant",
    "nameAr": "ميني زعتر كرواسان",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.95
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10309",
    "categoryId": "cat-14",
    "nameEn": "Mix Cake",
    "nameAr": "ميكس كيك",
    "emoji": "",
    "imageUrl": "/menu/p-10309.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 20
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10366",
    "categoryId": "cat-19",
    "nameEn": "Mocha Coffee Frappe",
    "nameAr": "موكا فرابيه بالقهوة",
    "emoji": "",
    "imageUrl": "/menu/p-10366.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2048",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7836",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3008",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3009",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3010",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3011",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3012",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3013",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3014",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2629",
        "nameEn": "Mocha Flavor",
        "nameAr": "نكهة الموكا",
        "multiple": false,
        "options": [
          {
            "id": "o-7866",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          },
          {
            "id": "o-7867",
            "nameEn": "White Mocha",
            "nameAr": "موكا بيضاء",
            "priceDelta": 0
          },
          {
            "id": "o-7868",
            "nameEn": "Dark Mint Mocha",
            "nameAr": "موكا غامقة بالنعنع",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3015",
        "nameEn": "Extra For Frappe",
        "nameAr": "Extra For Frappe",
        "multiple": true,
        "options": [
          {
            "id": "o-11052",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11053",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11054",
            "nameEn": "No Whipped Cream",
            "nameAr": "No Whipped Cream",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-12058",
    "categoryId": "cat-30",
    "nameEn": "Nicaragua Specialty Coffee 250 G",
    "nameAr": "نيكاراغوا قهوة مختصة 250 جرام",
    "emoji": "",
    "imageUrl": "/menu/p-12058.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 7.25
      }
    ],
    "customizations": [
      {
        "id": "g-3121",
        "nameEn": "Choose Grind Size:",
        "nameAr": "اختر حجم الطحن:",
        "multiple": false,
        "options": [
          {
            "id": "o-11474",
            "nameEn": "Whole Beans",
            "nameAr": "حبوب كاملة",
            "priceDelta": 0
          },
          {
            "id": "o-11475",
            "nameEn": "Turkish Grind",
            "nameAr": "طحن قهوة تركية",
            "priceDelta": 0
          },
          {
            "id": "o-11476",
            "nameEn": "American Grind",
            "nameAr": "طحن قهوة امريكية",
            "priceDelta": 0
          },
          {
            "id": "o-11477",
            "nameEn": "Espresso Grind",
            "nameAr": "طحنة قهوة اسبريسو",
            "priceDelta": 0
          },
          {
            "id": "o-11478",
            "nameEn": "V60 Grind",
            "nameAr": "طحن V60",
            "priceDelta": 0
          },
          {
            "id": "o-11479",
            "nameEn": "French Press Grind",
            "nameAr": "طحنة فرنش بريس",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10303",
    "categoryId": "cat-14",
    "nameEn": "Nutella Cake",
    "nameAr": "كيكة النوتيلا",
    "emoji": "",
    "imageUrl": "/menu/p-10303.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "(6-8) people",
        "nameAr": "(6-8) أشخاص",
        "price": 16
      },
      {
        "id": "M",
        "nameEn": "(10-12) poeple",
        "nameAr": "(10-12) أشخاص",
        "price": 20
      },
      {
        "id": "L",
        "nameEn": "15 (تواصي)",
        "nameAr": "15 (تواصي)",
        "price": 28
      },
      {
        "id": "L",
        "nameEn": "20 (تواصي)",
        "nameAr": "20 (تواصي)",
        "price": 38
      },
      {
        "id": "L",
        "nameEn": "25 (تواصي)",
        "nameAr": "25 (تواصي)",
        "price": 50
      }
    ],
    "customizations": [
      {
        "id": "g-2582",
        "nameEn": "Customize Cake",
        "nameAr": "تفصيلات قوالب الكيك",
        "multiple": true,
        "options": [
          {
            "id": "o-7757",
            "nameEn": "Sugar Picture",
            "nameAr": "صورة السكر",
            "priceDelta": 10
          }
        ]
      }
    ]
  },
  {
    "id": "p-10258",
    "categoryId": "cat-11",
    "nameEn": "Nutella Cookie",
    "nameAr": "نوتيلا كوكيز",
    "emoji": "",
    "imageUrl": "/menu/p-10258.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": [
      {
        "id": "g-2870",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10163",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10164",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10166",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10167",
            "nameEn": "Extra Cream",
            "nameAr": "Extra Cream",
            "priceDelta": 0.45
          },
          {
            "id": "o-10168",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.45
          },
          {
            "id": "o-10165",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-11667",
    "categoryId": "cat-14",
    "nameEn": "Nutella Cookies Pan - Large",
    "nameAr": "كوكيز بان بالنوتيلا - كبير",
    "emoji": "",
    "imageUrl": "/menu/p-11667.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 16
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11668",
    "categoryId": "cat-10",
    "nameEn": "Nutella Cookies Pan - Small",
    "nameAr": "كوكيز بان بالنوتيلا - صغير",
    "emoji": "",
    "imageUrl": "/menu/p-11668.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": [
      {
        "id": "g-2951",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10721",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10722",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10724",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10723",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10233",
    "categoryId": "cat-10",
    "nameEn": "Nutella Cruffin",
    "nameAr": "كرفن النوتيلا",
    "emoji": "",
    "imageUrl": "/menu/p-10233.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.25
      }
    ],
    "customizations": [
      {
        "id": "g-2868",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10151",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10152",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10154",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10153",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10263",
    "categoryId": "cat-11",
    "nameEn": "Nutella Muffin",
    "nameAr": "مفن نوتيلا",
    "emoji": "",
    "imageUrl": "/menu/p-10263.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": [
      {
        "id": "g-2863",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10121",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10122",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10124",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10125",
            "nameEn": "Extra Cream",
            "nameAr": "Extra Cream",
            "priceDelta": 0.45
          },
          {
            "id": "o-10126",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.45
          },
          {
            "id": "o-10123",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10257",
    "categoryId": "cat-11",
    "nameEn": "Oat Cookie",
    "nameAr": "شوفان كوكيز",
    "emoji": "",
    "imageUrl": "/menu/p-10257.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": [
      {
        "id": "g-2869",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10157",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10158",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10160",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10161",
            "nameEn": "Extra Cream",
            "nameAr": "Extra Cream",
            "priceDelta": 0.45
          },
          {
            "id": "o-10162",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.45
          },
          {
            "id": "o-10159",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10162",
    "categoryId": "cat-3",
    "nameEn": "Omelette Bagel",
    "nameAr": "بايغل أومليت",
    "emoji": "",
    "imageUrl": "/menu/p-10162.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-96",
        "nameEn": "Bagel Type",
        "nameAr": "نوع البيغل",
        "multiple": false,
        "options": [
          {
            "id": "o-346",
            "nameEn": "Plain",
            "nameAr": "سادة",
            "priceDelta": 0
          },
          {
            "id": "o-347",
            "nameEn": "Everything",
            "nameAr": "ايفري ثنج",
            "priceDelta": 0
          },
          {
            "id": "o-348",
            "nameEn": "Multigrain",
            "nameAr": "خلطة حبوب",
            "priceDelta": 0
          },
          {
            "id": "o-349",
            "nameEn": "Poppy Seed",
            "nameAr": "بوبي سيد",
            "priceDelta": 0
          },
          {
            "id": "o-350",
            "nameEn": "Sesame",
            "nameAr": "السمسم",
            "priceDelta": 0
          },
          {
            "id": "o-351",
            "nameEn": "Zatar",
            "nameAr": "زعتر",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3151",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11693",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11695",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11699",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2845",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9823",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9830",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9831",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-9834",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-9835",
            "nameEn": "Extra Cream Cheese",
            "nameAr": "اكسترا كريم تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-11883",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12087",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10193",
    "categoryId": "cat-5",
    "nameEn": "Omelette Cheese Sourdough",
    "nameAr": "Omelette Cheese Sourdough",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-3177",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-12122",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-12123",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-12124",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2824",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9445",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9452",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9456",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-9457",
            "nameEn": "Extra Cream Cheese",
            "nameAr": "اكسترا كريم تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-11871",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12075",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10148",
    "categoryId": "cat-2",
    "nameEn": "Omelette Croissant",
    "nameAr": "كرواسون مع أومليت",
    "emoji": "",
    "imageUrl": "/menu/p-10148.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-3164",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11784",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11786",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11790",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2836",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9661",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9668",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9672",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-9673",
            "nameEn": "Extra Cream Cheese",
            "nameAr": "اكسترا كريم تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-11859",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12063",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10174",
    "categoryId": "cat-4",
    "nameEn": "Omelette Keto Bagel",
    "nameAr": "كيتو بايغل أومليت",
    "emoji": "",
    "imageUrl": "/menu/p-10174.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": [
      {
        "id": "g-3152",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11700",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11702",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11706",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2815",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9283",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9290",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9291",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-9294",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-9295",
            "nameEn": "Extra Cream Cheese",
            "nameAr": "اكسترا كريم تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-11851",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11987",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          },
          {
            "id": "o-12055",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10549",
    "categoryId": "cat-6",
    "nameEn": "Omelette Plate",
    "nameAr": "صحن اومليت",
    "emoji": "",
    "imageUrl": "/menu/p-10549.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10384",
    "categoryId": "cat-24",
    "nameEn": "Orange Juice",
    "nameAr": "عصير برتقال",
    "emoji": "",
    "imageUrl": "/menu/p-10384.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.4
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4
      },
      {
        "id": "L",
        "nameEn": "Short",
        "nameAr": "شورت",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-3053",
        "nameEn": "Juice Type",
        "nameAr": "نوع العصير",
        "multiple": true,
        "options": [
          {
            "id": "o-11173",
            "nameEn": "Iced",
            "nameAr": "مكعبات ثلج",
            "priceDelta": 0
          },
          {
            "id": "o-11174",
            "nameEn": "Smoothie",
            "nameAr": "سموذي",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3062",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11183",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10285",
    "categoryId": "cat-13",
    "nameEn": "Pack Of Dates",
    "nameAr": "علبه تمر مغطس بالشوكلاتة",
    "emoji": "",
    "imageUrl": "/menu/p-10285.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10389",
    "categoryId": "cat-25",
    "nameEn": "Passion Fruit Mojito",
    "nameAr": "موهيتو باشن فروت",
    "emoji": "",
    "imageUrl": "/menu/p-10389.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-3069",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11190",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10318",
    "categoryId": "cat-15",
    "nameEn": "Pastrami And Cheese Manousheh",
    "nameAr": "منقوشة بسطرمة وجبنة",
    "emoji": "",
    "imageUrl": "/menu/p-10318.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.9
      }
    ],
    "customizations": [
      {
        "id": "g-1952",
        "nameEn": "Dough Type",
        "nameAr": "نوع العجين",
        "multiple": false,
        "options": [
          {
            "id": "o-7876",
            "nameEn": "White Dough",
            "nameAr": "عجينة أبيض",
            "priceDelta": 0
          },
          {
            "id": "o-2442",
            "nameEn": "Whole Brown Dough",
            "nameAr": "عجينة القمح البلدي الكامل",
            "priceDelta": 0.5
          }
        ]
      },
      {
        "id": "g-2788",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8861",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-8862",
            "nameEn": "Extra Blue Cheese",
            "nameAr": "اكسترا بلو تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-8863",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8864",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8865",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-8866",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-8867",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-8869",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-8870",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8871",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-8872",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-11363",
    "categoryId": "cat-25",
    "nameEn": "Peach Mojito",
    "nameAr": "موهيتو الدراق",
    "emoji": "",
    "imageUrl": "/menu/p-11363.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-3070",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11191",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-12157",
    "categoryId": "cat-10",
    "nameEn": "Peanut Butter & Date Tart",
    "nameAr": "قطعة تارت الفول السوداني",
    "emoji": "",
    "imageUrl": "/menu/p-12157.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11994",
    "categoryId": "cat-47",
    "nameEn": "Peanut oat bar",
    "nameAr": "بار الشوفان بالفول السوداني",
    "emoji": "",
    "imageUrl": "/menu/p-11994.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11991",
    "categoryId": "cat-47",
    "nameEn": "Peanut protein Bar",
    "nameAr": "بار بروتين بالفول السوداني",
    "emoji": "",
    "imageUrl": "/menu/p-11991.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-12158",
    "categoryId": "cat-10",
    "nameEn": "Pear & Almond Puff Pastry",
    "nameAr": "باف بيستري الأجاص و اللوز",
    "emoji": "",
    "imageUrl": "/menu/p-12158.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10330",
    "categoryId": "cat-16",
    "nameEn": "Penne Rose Pasta",
    "nameAr": "بيني روزيه باستا",
    "emoji": "",
    "imageUrl": "/menu/p-10330.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": [
      {
        "id": "g-2813",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9254",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9260",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 1.5
          },
          {
            "id": "o-11834",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10323",
    "categoryId": "cat-18",
    "nameEn": "Pepperoni Pizza",
    "nameAr": "بيبروني بيتزا",
    "emoji": "",
    "imageUrl": "/menu/p-10323.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "White . Medium",
        "nameAr": "وسط ابيض",
        "price": 5.5
      },
      {
        "id": "M",
        "nameEn": "White . Large",
        "nameAr": "كبير ابيض",
        "price": 7.5
      },
      {
        "id": "L",
        "nameEn": "brown . Medium",
        "nameAr": "وسط اسمر",
        "price": 6
      }
    ],
    "customizations": [
      {
        "id": "g-2785",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8825",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-8827",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8828",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8829",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-8830",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-8833",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-8834",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8835",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-8836",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          },
          {
            "id": "o-11340",
            "nameEn": "Extra Green Olive",
            "nameAr": "Extra Green Olive",
            "priceDelta": 0.6
          }
        ]
      },
      {
        "id": "g-1462",
        "nameEn": "Remove:",
        "nameAr": "ازالة:",
        "multiple": true,
        "options": [
          {
            "id": "o-11341",
            "nameEn": "Remove Mozzarella Cheese",
            "nameAr": "أزل الجبنة",
            "priceDelta": 0
          },
          {
            "id": "o-11342",
            "nameEn": "Remove Pizza Sauce",
            "nameAr": "أزل صوص البيتزا",
            "priceDelta": 0
          },
          {
            "id": "o-11343",
            "nameEn": "Remove Basil Leaves",
            "nameAr": "أزل أوراق الريحان",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10317",
    "categoryId": "cat-15",
    "nameEn": "Pesto And Cheese Manousheh",
    "nameAr": "منقوشة بيستو وجبنة",
    "emoji": "",
    "imageUrl": "/menu/p-10317.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": [
      {
        "id": "g-1953",
        "nameEn": "Dough Type",
        "nameAr": "نوع العجين",
        "multiple": false,
        "options": [
          {
            "id": "o-7877",
            "nameEn": "White Dough",
            "nameAr": "عجينة أبيض",
            "priceDelta": 0
          },
          {
            "id": "o-2443",
            "nameEn": "Whole Brown Dough",
            "nameAr": "عجينة القمح البلدي الكامل",
            "priceDelta": 0.5
          }
        ]
      },
      {
        "id": "g-2789",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8873",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-8874",
            "nameEn": "Extra Blue Cheese",
            "nameAr": "اكسترا بلو تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-8875",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8876",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8877",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-8878",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-8879",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-8881",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-8882",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8883",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-8884",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10331",
    "categoryId": "cat-16",
    "nameEn": "Pesto Pasta",
    "nameAr": "بيستو باستا",
    "emoji": "",
    "imageUrl": "/menu/p-10331.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.9
      }
    ],
    "customizations": [
      {
        "id": "g-2812",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-9235",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-9237",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-9239",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-9240",
            "nameEn": "Extra Pasta Sauce",
            "nameAr": "اكسترا باستا صوص",
            "priceDelta": 0.6
          },
          {
            "id": "o-9244",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          }
        ]
      },
      {
        "id": "g-3091",
        "nameEn": "Remove:",
        "nameAr": "ازالة:",
        "multiple": true,
        "options": [
          {
            "id": "o-11361",
            "nameEn": "Remove Parmesan Cheese",
            "nameAr": "أزل جبنة البارمزان",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10203",
    "categoryId": "cat-6",
    "nameEn": "Philly Steak Sandwich",
    "nameAr": "فيليه ستيك ساندويش",
    "emoji": "",
    "imageUrl": "/menu/p-10203.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.9
      }
    ],
    "customizations": [
      {
        "id": "g-2807",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9158",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-11832",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12036",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-11776",
    "categoryId": "cat-10",
    "nameEn": "Pina Colada Danish",
    "nameAr": "دانيش البينا كولادا",
    "emoji": "",
    "imageUrl": "/menu/p-11776.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-2956",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10783",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10784",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10786",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10785",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10347",
    "categoryId": "cat-22",
    "nameEn": "Pistachio Latte",
    "nameAr": "Pistachio Latte",
    "emoji": "",
    "imageUrl": "/menu/p-10347.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-1980",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7830",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-2592",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-2593",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-2594",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-2595",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-2596",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2597",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-2598",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3039",
        "nameEn": "Extra Drink",
        "nameAr": "EXTRA Drink",
        "multiple": true,
        "options": [
          {
            "id": "o-11130",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11131",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11132",
            "nameEn": "Extra Whipped Cream",
            "nameAr": "Extra Whipped Cream",
            "priceDelta": 0.4
          },
          {
            "id": "o-11133",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10158",
    "categoryId": "cat-3",
    "nameEn": "Plain Bagel",
    "nameAr": "بايغل سادة",
    "emoji": "",
    "imageUrl": "/menu/p-10158.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.25
      }
    ],
    "customizations": [
      {
        "id": "g-102",
        "nameEn": "Bagel Type",
        "nameAr": "نوع البيغل",
        "multiple": false,
        "options": [
          {
            "id": "o-402",
            "nameEn": "Plain",
            "nameAr": "سادة",
            "priceDelta": 0
          },
          {
            "id": "o-403",
            "nameEn": "Everything",
            "nameAr": "ايفري ثنج",
            "priceDelta": 0
          },
          {
            "id": "o-404",
            "nameEn": "Multigrain",
            "nameAr": "خلطة حبوب",
            "priceDelta": 0
          },
          {
            "id": "o-405",
            "nameEn": "Poppy Seed",
            "nameAr": "بوبي سيد",
            "priceDelta": 0
          },
          {
            "id": "o-406",
            "nameEn": "Sesame",
            "nameAr": "السمسم",
            "priceDelta": 0
          },
          {
            "id": "o-407",
            "nameEn": "Zatar",
            "nameAr": "زعتر",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10144",
    "categoryId": "cat-2",
    "nameEn": "Plain Croissant",
    "nameAr": "كرواسون سادة",
    "emoji": "",
    "imageUrl": "/menu/p-10144.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10173",
    "categoryId": "cat-4",
    "nameEn": "Plain Keto Bagel",
    "nameAr": "كيتو بايغل سادة",
    "emoji": "",
    "imageUrl": "/menu/p-10173.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10648",
    "categoryId": "cat-14",
    "nameEn": "Pomegranate Cheesecake",
    "nameAr": "تشيز كيك الرمان",
    "emoji": "",
    "imageUrl": "/menu/p-10648.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "(6-8) people",
        "nameAr": "(6-8) أشخاص",
        "price": 16
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10653",
    "categoryId": "cat-10",
    "nameEn": "Pomegranate Cheesecake Piece",
    "nameAr": "قطعة تشيز كيك الرمان",
    "emoji": "",
    "imageUrl": "/menu/p-10653.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-2938",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10643",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10644",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10646",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10645",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10659",
    "categoryId": "cat-27",
    "nameEn": "Pumpkin Chai Latte",
    "nameAr": "شاي لاتيه البامكن",
    "emoji": "",
    "imageUrl": "/menu/p-10659.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.5
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.1
      }
    ],
    "customizations": [
      {
        "id": "g-2683",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-8086",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-8087",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-8088",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-8089",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-8090",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-8091",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-8092",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-8093",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-12154",
    "categoryId": "cat-10",
    "nameEn": "Pumpkin Danish",
    "nameAr": "دنش القرع",
    "emoji": "",
    "imageUrl": "/menu/p-12154.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10322",
    "categoryId": "cat-18",
    "nameEn": "Quattro Pizza",
    "nameAr": "كواترو بيتزا",
    "emoji": "",
    "imageUrl": "/menu/p-10322.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "White . Medium",
        "nameAr": "وسط ابيض",
        "price": 5.5
      },
      {
        "id": "M",
        "nameEn": "White . Large",
        "nameAr": "كبير ابيض",
        "price": 7.5
      },
      {
        "id": "L",
        "nameEn": "brown . Medium",
        "nameAr": "وسط اسمر",
        "price": 6
      }
    ],
    "customizations": [
      {
        "id": "g-2786",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8837",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-8838",
            "nameEn": "Extra Blue Cheese",
            "nameAr": "اكسترا بلو تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-8839",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8840",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8841",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-8842",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-8843",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-8845",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-8846",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8847",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-8848",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          },
          {
            "id": "o-11310",
            "nameEn": "Extra Green Olive",
            "nameAr": "Extra Green Olive",
            "priceDelta": 0.6
          }
        ]
      },
      {
        "id": "g-1502",
        "nameEn": "Remove:",
        "nameAr": "ازالة:",
        "multiple": true,
        "options": [
          {
            "id": "o-11314",
            "nameEn": "Remove Pizza Sauce",
            "nameAr": "أزل صوص البيتزا",
            "priceDelta": 0
          },
          {
            "id": "o-11311",
            "nameEn": "Remove Basil Leaves",
            "nameAr": "أزل أوراق الريحان",
            "priceDelta": 0
          },
          {
            "id": "o-11312",
            "nameEn": "Remove Blue Cheese",
            "nameAr": "أزل الجبنة الزرقاء",
            "priceDelta": 0
          },
          {
            "id": "o-11313",
            "nameEn": "Remove Cheddar Cheese",
            "nameAr": "أزل جبنة الشيدر",
            "priceDelta": 0
          },
          {
            "id": "o-11315",
            "nameEn": "Remove Parmesan Cheese",
            "nameAr": "أزل جبنة البارمزان",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10210",
    "categoryId": "cat-8",
    "nameEn": "Quinoa Salad",
    "nameAr": "سلطة كينوا",
    "emoji": "",
    "imageUrl": "/menu/p-10210.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": [
      {
        "id": "g-2878",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-10238",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 1.5
          },
          {
            "id": "o-11841",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10301",
    "categoryId": "cat-14",
    "nameEn": "Red Velvet Cake",
    "nameAr": "كيكة ريد فيلفيت",
    "emoji": "",
    "imageUrl": "/menu/p-10301.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "(6-8) people",
        "nameAr": "(6-8) أشخاص",
        "price": 16
      },
      {
        "id": "M",
        "nameEn": "(10-12) poeple",
        "nameAr": "(10-12) أشخاص",
        "price": 20
      },
      {
        "id": "L",
        "nameEn": "15 (تواصي)",
        "nameAr": "15 (تواصي)",
        "price": 38
      },
      {
        "id": "L",
        "nameEn": "20 (تواصي)",
        "nameAr": "20 (تواصي)",
        "price": 50
      },
      {
        "id": "L",
        "nameEn": "25 (تواصي)",
        "nameAr": "25 (تواصي)",
        "price": 58
      }
    ],
    "customizations": [
      {
        "id": "g-2580",
        "nameEn": "Customize Cake",
        "nameAr": "تفصيلات قوالب الكيك",
        "multiple": true,
        "options": [
          {
            "id": "o-7755",
            "nameEn": "Sugar Picture",
            "nameAr": "صورة السكر",
            "priceDelta": 10
          }
        ]
      }
    ]
  },
  {
    "id": "p-10247",
    "categoryId": "cat-10",
    "nameEn": "Red Velvet Cake Piece",
    "nameAr": "قطعة كيك ريد فيلفيت",
    "emoji": "",
    "imageUrl": "/menu/p-10247.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-2916",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10511",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10512",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10514",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10513",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-12083",
    "categoryId": "cat-6",
    "nameEn": "Ricotta & Spinach Sourdough Ciabatta Sandwich",
    "nameAr": "ساندويش شباتا ساوردو بالريكوتا والسبانخ",
    "emoji": "",
    "imageUrl": "/menu/p-12083.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10160",
    "categoryId": "cat-3",
    "nameEn": "Roast Beef And Cheddar Cheese",
    "nameAr": "بايغل مع روست بيف وجبنة شيدر",
    "emoji": "",
    "imageUrl": "/menu/p-10160.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.1
      }
    ],
    "customizations": [
      {
        "id": "g-99",
        "nameEn": "Bagel Type",
        "nameAr": "نوع البيغل",
        "multiple": false,
        "options": [
          {
            "id": "o-374",
            "nameEn": "Plain",
            "nameAr": "سادة",
            "priceDelta": 0
          },
          {
            "id": "o-375",
            "nameEn": "Everything",
            "nameAr": "ايفري ثنج",
            "priceDelta": 0
          },
          {
            "id": "o-376",
            "nameEn": "Multigrain",
            "nameAr": "خلطة حبوب",
            "priceDelta": 0
          },
          {
            "id": "o-377",
            "nameEn": "Poppy Seed",
            "nameAr": "بوبي سيد",
            "priceDelta": 0
          },
          {
            "id": "o-378",
            "nameEn": "Sesame",
            "nameAr": "السمسم",
            "priceDelta": 0
          },
          {
            "id": "o-379",
            "nameEn": "Zatar",
            "nameAr": "زعتر",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2854",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9992",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9993",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-9996",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11891",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12095",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10209",
    "categoryId": "cat-8",
    "nameEn": "Rocca Salad",
    "nameAr": "سلطة جرجير",
    "emoji": "",
    "imageUrl": "/menu/p-10209.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": [
      {
        "id": "g-2877",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-10217",
            "nameEn": "Extra Halloumi",
            "nameAr": "اكسترا حلوم",
            "priceDelta": 1
          },
          {
            "id": "o-10220",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 1.5
          },
          {
            "id": "o-11840",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10161",
    "categoryId": "cat-3",
    "nameEn": "Salmon And Cheese Bagel",
    "nameAr": "بايغل مع سلمون وجبنة",
    "emoji": "",
    "imageUrl": "/menu/p-10161.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": [
      {
        "id": "g-103",
        "nameEn": "Bagel Type",
        "nameAr": "نوع البيغل",
        "multiple": false,
        "options": [
          {
            "id": "o-408",
            "nameEn": "Plain",
            "nameAr": "سادة",
            "priceDelta": 0
          },
          {
            "id": "o-409",
            "nameEn": "Everything",
            "nameAr": "ايفري ثنج",
            "priceDelta": 0
          },
          {
            "id": "o-410",
            "nameEn": "Multigrain",
            "nameAr": "خلطة حبوب",
            "priceDelta": 0
          },
          {
            "id": "o-411",
            "nameEn": "Poppy Seed",
            "nameAr": "بوبي سيد",
            "priceDelta": 0
          },
          {
            "id": "o-412",
            "nameEn": "Sesame",
            "nameAr": "السمسم",
            "priceDelta": 0
          },
          {
            "id": "o-413",
            "nameEn": "Zatar",
            "nameAr": "زعتر",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3153",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11707",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11709",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11713",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2834",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9624",
            "nameEn": "Extra Salmon",
            "nameAr": "اكسترا سالمون",
            "priceDelta": 1.5
          },
          {
            "id": "o-9637",
            "nameEn": "Extra Cream Cheese",
            "nameAr": "اكسترا كريم تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-11881",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10147",
    "categoryId": "cat-2",
    "nameEn": "Salmon And Cheese Croissant",
    "nameAr": "كرواسون مع سلمون وجبنة",
    "emoji": "",
    "imageUrl": "/menu/p-10147.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": [
      {
        "id": "g-3165",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11791",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11793",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11797",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2835",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9642",
            "nameEn": "Extra Salmon",
            "nameAr": "اكسترا سالمون",
            "priceDelta": 1.5
          },
          {
            "id": "o-9655",
            "nameEn": "Extra Cream Cheese",
            "nameAr": "اكسترا كريم تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-11882",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10172",
    "categoryId": "cat-4",
    "nameEn": "Salmon And Cheese Keto Bagel",
    "nameAr": "كيتو بايغل مع سلمون وجبنة",
    "emoji": "",
    "imageUrl": "/menu/p-10172.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.9
      }
    ],
    "customizations": [
      {
        "id": "g-3134",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11574",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11576",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11580",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2814",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9264",
            "nameEn": "Extra Salmon",
            "nameAr": "اكسترا سالمون",
            "priceDelta": 1.5
          },
          {
            "id": "o-9277",
            "nameEn": "Extra Cream Cheese",
            "nameAr": "اكسترا كريم تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-11850",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10194",
    "categoryId": "cat-5",
    "nameEn": "Salmon Cheese Sourdough",
    "nameAr": "Salmon Cheese Sourdough",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": [
      {
        "id": "g-1939",
        "nameEn": "Without",
        "nameAr": "بدون اضافة",
        "multiple": true,
        "options": [
          {
            "id": "o-2415",
            "nameEn": "Without Lettuce",
            "nameAr": "بدون خس",
            "priceDelta": 0
          },
          {
            "id": "o-2416",
            "nameEn": "Without Black Olive",
            "nameAr": " بدون زيتون اسود",
            "priceDelta": 0
          },
          {
            "id": "o-2417",
            "nameEn": "Without Tomato",
            "nameAr": "بدون بندورة",
            "priceDelta": 0
          },
          {
            "id": "o-2418",
            "nameEn": "Without Roast Beef",
            "nameAr": " بدون روست بيف",
            "priceDelta": 0
          },
          {
            "id": "o-2419",
            "nameEn": "Without Turkey",
            "nameAr": "بدون تيركي",
            "priceDelta": 0
          },
          {
            "id": "o-2420",
            "nameEn": "Withoout Egg",
            "nameAr": "بدون بيض",
            "priceDelta": 0
          },
          {
            "id": "o-2421",
            "nameEn": "Without Sun Dried Tomato",
            "nameAr": "بدون بندورة مجففة ",
            "priceDelta": 0
          },
          {
            "id": "o-2422",
            "nameEn": "Without Cream Cheese",
            "nameAr": "بدون كريم تشيز ",
            "priceDelta": 0
          },
          {
            "id": "o-2423",
            "nameEn": "Without Cheddar Cheese",
            "nameAr": "بدون تشيدر تشيز ",
            "priceDelta": 0
          },
          {
            "id": "o-2424",
            "nameEn": "Without Avocado",
            "nameAr": "بدون افوكادو ",
            "priceDelta": 0
          },
          {
            "id": "o-2425",
            "nameEn": "Without Guacamole",
            "nameAr": "بدون جواكامولي",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10298",
    "categoryId": "cat-14",
    "nameEn": "San Sebastian Cake",
    "nameAr": "قالب كيك سان سيباستيان",
    "emoji": "",
    "imageUrl": "/menu/p-10298.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "(6-8) people",
        "nameAr": "(6-8) أشخاص",
        "price": 20
      },
      {
        "id": "M",
        "nameEn": "(10-12) poeple",
        "nameAr": "(10-12) أشخاص",
        "price": 25
      }
    ],
    "customizations": [
      {
        "id": "g-2936",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10631",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10632",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10634",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10635",
            "nameEn": "Extra Cream",
            "nameAr": "Extra Cream",
            "priceDelta": 0.45
          },
          {
            "id": "o-10636",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.45
          },
          {
            "id": "o-10633",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10231",
    "categoryId": "cat-10",
    "nameEn": "San Sebastian Cake Piece",
    "nameAr": "قطعة كيكة سان سيباستيان",
    "emoji": "",
    "imageUrl": "/menu/p-10231.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": [
      {
        "id": "g-2920",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10535",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10536",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10538",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10537",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10793",
    "categoryId": "cat-8",
    "nameEn": "Sesame Beef Salad",
    "nameAr": "سلطة اللحم البقري بالسمسم",
    "emoji": "",
    "imageUrl": "/menu/p-10793.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.9
      }
    ],
    "customizations": [
      {
        "id": "g-2857",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11836",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-11972",
            "nameEn": "Extra Avocado",
            "nameAr": "Extra Avocado",
            "priceDelta": 1.5
          }
        ]
      }
    ]
  },
  {
    "id": "p-11797",
    "categoryId": "cat-2",
    "nameEn": "Signature Cream Cheese Danish",
    "nameAr": " دانيش سيغنتشر بالكريم تشيز",
    "emoji": "",
    "imageUrl": "/menu/p-11797.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-5123",
    "categoryId": "cat-6",
    "nameEn": "Sourdough Loaf Piece",
    "nameAr": "خبزة ساوردو حبه",
    "emoji": "",
    "imageUrl": "/menu/p-5123.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10387",
    "categoryId": "cat-44",
    "nameEn": "Sparkling Water200 m",
    "nameAr": "مياه غازية 200 مل",
    "emoji": "",
    "imageUrl": "/menu/p-10387.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10319",
    "categoryId": "cat-15",
    "nameEn": "Special Falafel Manousheh",
    "nameAr": "منقوشة فلافل سبيشال",
    "emoji": "",
    "imageUrl": "/menu/p-10319.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": [
      {
        "id": "g-1954",
        "nameEn": "Dough Type",
        "nameAr": "نوع العجين",
        "multiple": false,
        "options": [
          {
            "id": "o-7878",
            "nameEn": "White Dough",
            "nameAr": "عجينة أبيض",
            "priceDelta": 0
          },
          {
            "id": "o-2444",
            "nameEn": "Whole Brown Dough",
            "nameAr": "عجينة القمح البلدي الكامل",
            "priceDelta": 0.5
          }
        ]
      },
      {
        "id": "g-2794",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8933",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-8934",
            "nameEn": "Extra Blue Cheese",
            "nameAr": "اكسترا بلو تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-8935",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8936",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8937",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-8938",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-8939",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-8941",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-8942",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8943",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-8944",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10316",
    "categoryId": "cat-15",
    "nameEn": "Special Zaatar Manousheh",
    "nameAr": "منقوشة زعتر سبيشال",
    "emoji": "",
    "imageUrl": "/menu/p-10316.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-1955",
        "nameEn": "Dough Type",
        "nameAr": "نوع العجين",
        "multiple": false,
        "options": [
          {
            "id": "o-7879",
            "nameEn": "White Dough",
            "nameAr": "عجينة أبيض",
            "priceDelta": 0
          },
          {
            "id": "o-2445",
            "nameEn": "Whole Brown Dough",
            "nameAr": "عجينة القمح البلدي الكامل",
            "priceDelta": 0.5
          }
        ]
      },
      {
        "id": "g-2790",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8885",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-8886",
            "nameEn": "Extra Blue Cheese",
            "nameAr": "اكسترا بلو تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-8887",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8888",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8889",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-8890",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-8891",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-8893",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-8894",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8895",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-8896",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10312",
    "categoryId": "cat-15",
    "nameEn": "Spinach Manousheh",
    "nameAr": "منقوشة سبانخ",
    "emoji": "",
    "imageUrl": "/menu/p-10312.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": [
      {
        "id": "g-1956",
        "nameEn": "Dough Type",
        "nameAr": "نوع العجين",
        "multiple": false,
        "options": [
          {
            "id": "o-7880",
            "nameEn": "White Dough",
            "nameAr": "عجينة أبيض",
            "priceDelta": 0
          },
          {
            "id": "o-2446",
            "nameEn": "Whole Brown Dough",
            "nameAr": "عجينة القمح البلدي الكامل",
            "priceDelta": 0.5
          }
        ]
      },
      {
        "id": "g-3087",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-11294",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-11295",
            "nameEn": "Extra Blue Cheese",
            "nameAr": "اكسترا بلو تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-11296",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-11297",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-11298",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-11299",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-11300",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-11301",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-11302",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-11303",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-11304",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10350",
    "categoryId": "cat-21",
    "nameEn": "Steamed Milk",
    "nameAr": "Steamed Milk",
    "emoji": "",
    "imageUrl": "/menu/p-10350.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 2.5
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-2642",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7932",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-7933",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-7934",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-7935",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-7936",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-7937",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-7938",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-7939",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-2759",
        "nameEn": "Coffee Flavor",
        "nameAr": "نكهة القهوة",
        "multiple": false,
        "options": [
          {
            "id": "o-8451",
            "nameEn": "No Flavor",
            "nameAr": "بدون نكهة",
            "priceDelta": 0
          },
          {
            "id": "o-8437",
            "nameEn": "Caramel",
            "nameAr": "كراميل",
            "priceDelta": 0
          },
          {
            "id": "o-8438",
            "nameEn": "Caramel Sugar Free",
            "nameAr": "كارميل خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8449",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-8450",
            "nameEn": "Vanilla Sugar Free",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8441",
            "nameEn": "Hazelnut",
            "nameAr": "بندق",
            "priceDelta": 0
          },
          {
            "id": "o-8442",
            "nameEn": "Hazelnut Sugar Free",
            "nameAr": "بندق خالي من السكر",
            "priceDelta": 0
          },
          {
            "id": "o-8448",
            "nameEn": "Toffee Nut",
            "nameAr": "توفي نت",
            "priceDelta": 0
          },
          {
            "id": "o-8447",
            "nameEn": "Salted Caramel",
            "nameAr": "كراميل مملح",
            "priceDelta": 0
          },
          {
            "id": "o-8445",
            "nameEn": "Praline",
            "nameAr": "برالين",
            "priceDelta": 0
          },
          {
            "id": "o-8439",
            "nameEn": "Cinnamon",
            "nameAr": "قرفة",
            "priceDelta": 0
          },
          {
            "id": "o-8440",
            "nameEn": "Gingerbread",
            "nameAr": "جينجر بريد",
            "priceDelta": 0
          },
          {
            "id": "o-8446",
            "nameEn": "Pumpkin Spice",
            "nameAr": "بامكن سبايس",
            "priceDelta": 0
          },
          {
            "id": "o-8443",
            "nameEn": "Irish",
            "nameAr": "ايرش",
            "priceDelta": 0
          },
          {
            "id": "o-8444",
            "nameEn": "Mint",
            "nameAr": "نعنع",
            "priceDelta": 0
          },
          {
            "id": "o-8452",
            "nameEn": "White Mocha",
            "nameAr": "وايت موكا",
            "priceDelta": 0
          },
          {
            "id": "o-8453",
            "nameEn": "Dark Mocha",
            "nameAr": "موكا غامقة",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10300",
    "categoryId": "cat-14",
    "nameEn": "Strawberry Cake",
    "nameAr": "كيكة الفراولة",
    "emoji": "",
    "imageUrl": "/menu/p-10300.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "(6-8) people",
        "nameAr": "(6-8) أشخاص",
        "price": 16
      },
      {
        "id": "M",
        "nameEn": "(10-12) poeple",
        "nameAr": "(10-12) أشخاص",
        "price": 20
      },
      {
        "id": "L",
        "nameEn": "15 (تواصي)",
        "nameAr": "15 (تواصي)",
        "price": 38
      },
      {
        "id": "L",
        "nameEn": "20 (تواصي)",
        "nameAr": "20 (تواصي)",
        "price": 50
      },
      {
        "id": "L",
        "nameEn": "25 (تواصي)",
        "nameAr": "25 (تواصي)",
        "price": 58
      },
      {
        "id": "L",
        "nameEn": "30 (تواصي)",
        "nameAr": "30 (تواصي)",
        "price": 70
      }
    ],
    "customizations": [
      {
        "id": "g-2579",
        "nameEn": "Customize Cake",
        "nameAr": "تفصيلات قوالب الكيك",
        "multiple": true,
        "options": [
          {
            "id": "o-7754",
            "nameEn": "Sugar Picture",
            "nameAr": "صورة السكر",
            "priceDelta": 10
          }
        ]
      }
    ]
  },
  {
    "id": "p-10220",
    "categoryId": "cat-9",
    "nameEn": "Strawberry Chia Pudding",
    "nameAr": "فراولة شيا بودينغ",
    "emoji": "",
    "imageUrl": "/menu/p-10220.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11983",
    "categoryId": "cat-2",
    "nameEn": "Strawberry Cream Cheese Croissant",
    "nameAr": "كرواسون كريم تشيز الفراولة",
    "emoji": "",
    "imageUrl": "/menu/p-11983.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10373",
    "categoryId": "cat-20",
    "nameEn": "Strawberry Crème Frappe",
    "nameAr": "فراولة فراب",
    "emoji": "",
    "imageUrl": "/menu/p-10373.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2054",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7842",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3050",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3051",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3052",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3053",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3054",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3055",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3056",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3011",
        "nameEn": "Extra For Frappe",
        "nameAr": "Extra For Frappe",
        "multiple": true,
        "options": [
          {
            "id": "o-11040",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11041",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11042",
            "nameEn": "No Whipped Cream",
            "nameAr": "No Whipped Cream",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10238",
    "categoryId": "cat-10",
    "nameEn": "Strawberry Danish",
    "nameAr": "دانش فراولة",
    "emoji": "",
    "imageUrl": "/menu/p-10238.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.25
      }
    ],
    "customizations": [
      {
        "id": "g-2912",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10487",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10488",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10490",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10489",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10219",
    "categoryId": "cat-9",
    "nameEn": "Strawberry Granola",
    "nameAr": "جرانولا فراولة",
    "emoji": "",
    "imageUrl": "/menu/p-10219.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10394",
    "categoryId": "cat-25",
    "nameEn": "Strawberry Mojito",
    "nameAr": "موهيتو الفراولة",
    "emoji": "",
    "imageUrl": "/menu/p-10394.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-3071",
        "nameEn": "Add Bubbles",
        "nameAr": "اضافة ببلز",
        "multiple": true,
        "options": [
          {
            "id": "o-11192",
            "nameEn": "Extra Bubbles",
            "nameAr": "اكسترا ببلز",
            "priceDelta": 0.4
          }
        ]
      }
    ]
  },
  {
    "id": "p-10237",
    "categoryId": "cat-10",
    "nameEn": "Strawberry Tart",
    "nameAr": "تارت الفراولة",
    "emoji": "",
    "imageUrl": "/menu/p-10237.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.75
      }
    ],
    "customizations": [
      {
        "id": "g-2928",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10583",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10584",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10586",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10585",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-11573",
    "categoryId": "cat-43",
    "nameEn": "Sugar Free Banana Chocolate Full Cake",
    "nameAr": "قالب كيك شوكولاتة بالموز كيتو",
    "emoji": "",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 30
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11777",
    "categoryId": "cat-14",
    "nameEn": "Sugar Free Date Sesame Cake",
    "nameAr": "قالب كيك التمر و السمسم الخالي من السكر",
    "emoji": "",
    "imageUrl": "/menu/p-11777.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 10
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11834",
    "categoryId": "cat-10",
    "nameEn": "Sugar Free Date Sesame Cake Piece",
    "nameAr": "قطعة كيك التمر و السمسم الخالي من السكر",
    "emoji": "",
    "imageUrl": "/menu/p-11834.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.25
      }
    ],
    "customizations": []
  },
  {
    "id": "p-12051",
    "categoryId": "cat-13",
    "nameEn": "Swirls Box",
    "nameAr": "بوكس سويرلز",
    "emoji": "",
    "imageUrl": "/menu/p-12051.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": []
  },
  {
    "id": "p-11371",
    "categoryId": "cat-27",
    "nameEn": "Tea Bag To Go",
    "nameAr": "Tea Bag To Go",
    "emoji": "",
    "imageUrl": "/menu/p-11371.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.25
      }
    ],
    "customizations": [
      {
        "id": "g-2715",
        "nameEn": "Tea Types",
        "nameAr": "نوع الشاي",
        "multiple": false,
        "options": [
          {
            "id": "o-8282",
            "nameEn": "Green Tea With Mint",
            "nameAr": "شاي أخضر بالنعناع",
            "priceDelta": 0
          },
          {
            "id": "o-8283",
            "nameEn": "Rosa Tea",
            "nameAr": "Rosa Tea",
            "priceDelta": 0
          },
          {
            "id": "o-8284",
            "nameEn": "Chamomile",
            "nameAr": "شاي البابونج",
            "priceDelta": 0
          },
          {
            "id": "o-8285",
            "nameEn": "Black Tea",
            "nameAr": "شاي اسود",
            "priceDelta": 0
          },
          {
            "id": "o-8286",
            "nameEn": "Ginger Tea",
            "nameAr": "شاي الزنجبيل",
            "priceDelta": 0
          },
          {
            "id": "o-8287",
            "nameEn": "Jasmine Tea",
            "nameAr": "شاي بالياسمين",
            "priceDelta": 0
          },
          {
            "id": "o-8288",
            "nameEn": "Green Tea",
            "nameAr": "شاي أخضر",
            "priceDelta": 0
          },
          {
            "id": "o-8289",
            "nameEn": "Masala Tea",
            "nameAr": "شاي ماسالا",
            "priceDelta": 0
          },
          {
            "id": "o-8290",
            "nameEn": "Earl Grey Tea",
            "nameAr": "شاي ايرل جراي",
            "priceDelta": 0
          },
          {
            "id": "o-8291",
            "nameEn": "Peppermint",
            "nameAr": "بيبرمنت",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10321",
    "categoryId": "cat-18",
    "nameEn": "Three Meats Pizza",
    "nameAr": "بيتزا ٣ انواع لحمة",
    "emoji": "",
    "imageUrl": "/menu/p-10321.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "White . Medium",
        "nameAr": "وسط ابيض",
        "price": 5.5
      },
      {
        "id": "M",
        "nameEn": "White . Large",
        "nameAr": "كبير ابيض",
        "price": 7.5
      },
      {
        "id": "L",
        "nameEn": "brown . Medium",
        "nameAr": "وسط اسمر",
        "price": 6
      }
    ],
    "customizations": [
      {
        "id": "g-2787",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8849",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-8850",
            "nameEn": "Extra Blue Cheese",
            "nameAr": "اكسترا بلو تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-8851",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8852",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8853",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-8854",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-8855",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-8856",
            "nameEn": "Extra Pasta Sauce",
            "nameAr": "اكسترا باستا صوص",
            "priceDelta": 0.6
          },
          {
            "id": "o-8857",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-8858",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8859",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-8860",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          }
        ]
      },
      {
        "id": "g-1504",
        "nameEn": "Remove:",
        "nameAr": "ازالة:",
        "multiple": true,
        "options": [
          {
            "id": "o-902",
            "nameEn": "Remove Beef Bacon",
            "nameAr": "أزل البيف بيكون",
            "priceDelta": 0
          },
          {
            "id": "o-903",
            "nameEn": "Remove Roast Beef",
            "nameAr": "أزل الروست بيف",
            "priceDelta": 0
          },
          {
            "id": "o-904",
            "nameEn": "Remove Pepperoni",
            "nameAr": "أزل التيركي",
            "priceDelta": 0
          },
          {
            "id": "o-11330",
            "nameEn": "Remove Mozzarella Cheese",
            "nameAr": "أزل الجبنة",
            "priceDelta": 0
          },
          {
            "id": "o-11331",
            "nameEn": "Remove Pizza Sauce",
            "nameAr": "أزل صوص البيتزا",
            "priceDelta": 0
          },
          {
            "id": "o-11334",
            "nameEn": "Remove Basil Leaves",
            "nameAr": "أزل أوراق الريحان",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10299",
    "categoryId": "cat-14",
    "nameEn": "Tiramisu Cake",
    "nameAr": "قالب كيك تيراميسو",
    "emoji": "",
    "imageUrl": "/menu/p-10299.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "(6-8) people",
        "nameAr": "(6-8) أشخاص",
        "price": 16
      },
      {
        "id": "M",
        "nameEn": "(10-12) poeple",
        "nameAr": "(10-12) أشخاص",
        "price": 20
      },
      {
        "id": "L",
        "nameEn": "15 (تواصي)",
        "nameAr": "15 (تواصي)",
        "price": 30
      },
      {
        "id": "L",
        "nameEn": "20 (تواصي)",
        "nameAr": "20 (تواصي)",
        "price": 40
      },
      {
        "id": "L",
        "nameEn": "25 (تواصي)",
        "nameAr": "25 (تواصي)",
        "price": 50
      },
      {
        "id": "L",
        "nameEn": "(6-8) people تواصي",
        "nameAr": "(6-8) people تواصي",
        "price": 16
      }
    ],
    "customizations": [
      {
        "id": "g-2578",
        "nameEn": "Customize Cake",
        "nameAr": "تفصيلات قوالب الكيك",
        "multiple": true,
        "options": [
          {
            "id": "o-7753",
            "nameEn": "Sugar Picture",
            "nameAr": "صورة السكر",
            "priceDelta": 10
          }
        ]
      }
    ]
  },
  {
    "id": "p-10222",
    "categoryId": "cat-10",
    "nameEn": "Tiramisu Danish",
    "nameAr": "تيراميسو دانيش",
    "emoji": "",
    "imageUrl": "/menu/p-10222.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-2910",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10475",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10476",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10478",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10477",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10246",
    "categoryId": "cat-10",
    "nameEn": "Tiramisu Piece",
    "nameAr": "قطعة تيرامسو",
    "emoji": "",
    "imageUrl": "/menu/p-10246.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.9
      }
    ],
    "customizations": [
      {
        "id": "g-2915",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10505",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10506",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10508",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10507",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10254",
    "categoryId": "cat-10",
    "nameEn": "Toffee Caramel Profiterole",
    "nameAr": "بروفيتيرول التوفي كراميل",
    "emoji": "",
    "imageUrl": "/menu/p-10254.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": [
      {
        "id": "g-2913",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10493",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10494",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10496",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10495",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-11380",
    "categoryId": "cat-18",
    "nameEn": "Truffle Pizza",
    "nameAr": "ترافل بيتزا",
    "emoji": "",
    "imageUrl": "/menu/p-11380.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "White . Medium",
        "nameAr": "وسط ابيض",
        "price": 6.5
      },
      {
        "id": "M",
        "nameEn": "White . Large",
        "nameAr": "كبير ابيض",
        "price": 8.5
      },
      {
        "id": "L",
        "nameEn": "brown . Medium",
        "nameAr": "وسط اسمر",
        "price": 7
      }
    ],
    "customizations": [
      {
        "id": "g-2796",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8957",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-8959",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8960",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8965",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-8966",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8967",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-8968",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          }
        ]
      },
      {
        "id": "g-2718",
        "nameEn": "Remove:",
        "nameAr": "ازالة:",
        "multiple": true,
        "options": [
          {
            "id": "o-8296",
            "nameEn": "Remove Mushroom",
            "nameAr": "أزل الفطر",
            "priceDelta": 0
          },
          {
            "id": "o-11344",
            "nameEn": "Remove Mozzarella Cheese",
            "nameAr": "أزل الجبنة",
            "priceDelta": 0
          },
          {
            "id": "o-11345",
            "nameEn": "Remove Basil Leaves",
            "nameAr": "أزل أوراق الريحان",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10783",
    "categoryId": "cat-6",
    "nameEn": "Tuna Sandwich",
    "nameAr": "ساندويش تونا",
    "emoji": "",
    "imageUrl": "/menu/p-10783.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.5
      }
    ],
    "customizations": [
      {
        "id": "g-2859",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11838",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-12084",
    "categoryId": "cat-6",
    "nameEn": "Turkey & Cheese Sourdough Sandwich",
    "nameAr": "ساندويش ساوردو بالتيركي والجبنة",
    "emoji": "",
    "imageUrl": "/menu/p-12084.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10159",
    "categoryId": "cat-3",
    "nameEn": "Turkey And Cheddar Cheese Bagel",
    "nameAr": "بايغل مع تيركي وجبنة شيدر",
    "emoji": "",
    "imageUrl": "/menu/p-10159.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.1
      }
    ],
    "customizations": [
      {
        "id": "g-106",
        "nameEn": "Bagel Type",
        "nameAr": "نوع البيغل",
        "multiple": false,
        "options": [
          {
            "id": "o-436",
            "nameEn": "Plain",
            "nameAr": "سادة",
            "priceDelta": 0
          },
          {
            "id": "o-437",
            "nameEn": "Everything",
            "nameAr": "ايفري ثنج",
            "priceDelta": 0
          },
          {
            "id": "o-438",
            "nameEn": "Multigrain",
            "nameAr": "خلطة حبوب",
            "priceDelta": 0
          },
          {
            "id": "o-439",
            "nameEn": "Poppy Seed",
            "nameAr": "بوبي سيد",
            "priceDelta": 0
          },
          {
            "id": "o-440",
            "nameEn": "Sesame",
            "nameAr": "السمسم",
            "priceDelta": 0
          },
          {
            "id": "o-441",
            "nameEn": "Zatar",
            "nameAr": "زعتر",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3154",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11714",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11716",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11720",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2853",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-9967",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-9974",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-9978",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11890",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12094",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-11418",
    "categoryId": "cat-4",
    "nameEn": "Turkey And Cheddar Cheese Keto Bagel",
    "nameAr": "كيتو بايغل مع تيركي وجبنة شيدر",
    "emoji": "",
    "imageUrl": "/menu/p-11418.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 4.1
      }
    ],
    "customizations": [
      {
        "id": "g-3155",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-11721",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-11723",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-11727",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2855",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-10003",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-10010",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-10014",
            "nameEn": "Extra Egg",
            "nameAr": "اكسترا بيض",
            "priceDelta": 0.45
          },
          {
            "id": "o-11892",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12096",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      }
    ]
  },
  {
    "id": "p-10197",
    "categoryId": "cat-6",
    "nameEn": "Turkey Sandwich",
    "nameAr": "ساندويش تيركي",
    "emoji": "",
    "imageUrl": "/menu/p-10197.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.4
      }
    ],
    "customizations": [
      {
        "id": "g-1943",
        "nameEn": "Bread Type",
        "nameAr": "نوع الخبز",
        "multiple": false,
        "options": [
          {
            "id": "o-2432",
            "nameEn": "White Bread",
            "nameAr": "خبز أبيض",
            "priceDelta": 0
          },
          {
            "id": "o-2433",
            "nameEn": "Brown Bread",
            "nameAr": "خبز نخالة أسمر",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-2798",
        "nameEn": "Extra Food",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-8989",
            "nameEn": "Extra Turkey",
            "nameAr": "اكسترا تيركي",
            "priceDelta": 0.6
          },
          {
            "id": "o-8996",
            "nameEn": "Extra 3 Cheese",
            "nameAr": "اكسترا 3 أجبان",
            "priceDelta": 1
          },
          {
            "id": "o-11849",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "Extra Sundried Tomato",
            "priceDelta": 0.6
          },
          {
            "id": "o-12053",
            "nameEn": "Extra Chedder Cheese",
            "nameAr": "Extra Chedder Cheese",
            "priceDelta": 0.2
          }
        ]
      },
      {
        "id": "g-3176",
        "nameEn": "Extra vegetables",
        "nameAr": "أضافات على الطعام",
        "multiple": true,
        "options": [
          {
            "id": "o-12119",
            "nameEn": "Extra Tomato",
            "nameAr": "اكسترا طماطم",
            "priceDelta": 0
          },
          {
            "id": "o-12120",
            "nameEn": "Extra Olives",
            "nameAr": "اكسترا زيتون",
            "priceDelta": 0
          },
          {
            "id": "o-12121",
            "nameEn": "Extra Lettuce",
            "nameAr": "Extra Lettuce",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10351",
    "categoryId": "cat-22",
    "nameEn": "Turkish Coffee",
    "nameAr": "TURKISH COFFEE",
    "emoji": "",
    "imageUrl": "/menu/p-10351.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10405",
    "categoryId": "cat-30",
    "nameEn": "Turkish Coffee Blend With Cardamom 250 Grams",
    "nameAr": "مزيج قهوة تركية مع هيل ٢٥٠ جرام",
    "emoji": "",
    "imageUrl": "/menu/p-10405.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 6
      }
    ],
    "customizations": [
      {
        "id": "g-3083",
        "nameEn": "Choose Grind Size:",
        "nameAr": "اختر حجم الطحن:",
        "multiple": false,
        "options": [
          {
            "id": "o-11256",
            "nameEn": "Whole Beans",
            "nameAr": "حبوب كاملة",
            "priceDelta": 0
          },
          {
            "id": "o-11257",
            "nameEn": "Turkish Grind",
            "nameAr": "طحن قهوة تركية",
            "priceDelta": 0
          },
          {
            "id": "o-11258",
            "nameEn": "American Grind",
            "nameAr": "طحن قهوة امريكية",
            "priceDelta": 0
          },
          {
            "id": "o-11259",
            "nameEn": "Espresso Grind",
            "nameAr": "طحنة قهوة اسبريسو",
            "priceDelta": 0
          },
          {
            "id": "o-11260",
            "nameEn": "V60 Grind",
            "nameAr": "طحن V60",
            "priceDelta": 0
          },
          {
            "id": "o-11261",
            "nameEn": "French Press Grind",
            "nameAr": "طحنة فرنش بريس",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-11372",
    "categoryId": "cat-30",
    "nameEn": "Uganda Single Origin Specialty Coffee 250 Grams",
    "nameAr": "أوغندا سينجل اوريجن قهوة مختصة ٢٥٠ جرام",
    "emoji": "",
    "imageUrl": "/menu/p-11372.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 7
      }
    ],
    "customizations": [
      {
        "id": "g-3084",
        "nameEn": "Choose Grind Size:",
        "nameAr": "اختر حجم الطحن:",
        "multiple": false,
        "options": [
          {
            "id": "o-11262",
            "nameEn": "Whole Beans",
            "nameAr": "حبوب كاملة",
            "priceDelta": 0
          },
          {
            "id": "o-11263",
            "nameEn": "Turkish Grind",
            "nameAr": "طحن قهوة تركية",
            "priceDelta": 0
          },
          {
            "id": "o-11264",
            "nameEn": "American Grind",
            "nameAr": "طحن قهوة امريكية",
            "priceDelta": 0
          },
          {
            "id": "o-11265",
            "nameEn": "Espresso Grind",
            "nameAr": "طحنة قهوة اسبريسو",
            "priceDelta": 0
          },
          {
            "id": "o-11266",
            "nameEn": "V60 Grind",
            "nameAr": "طحن V60",
            "priceDelta": 0
          },
          {
            "id": "o-11267",
            "nameEn": "French Press Grind",
            "nameAr": "طحنة فرنش بريس",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-11431",
    "categoryId": "cat-36",
    "nameEn": "V60 Filters / Size 02",
    "nameAr": "V60 Filters / Size 02",
    "emoji": "",
    "imageUrl": "/menu/p-11431.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 5.5
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10372",
    "categoryId": "cat-20",
    "nameEn": "Vanilla Crème Frappe",
    "nameAr": "فانيلا فراب",
    "emoji": "",
    "imageUrl": "/menu/p-10372.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2055",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7843",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3057",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3058",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3059",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3060",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3061",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3062",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3063",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3009",
        "nameEn": "Extra For Frappe",
        "nameAr": "Extra For Frappe",
        "multiple": true,
        "options": [
          {
            "id": "o-11034",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11035",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11036",
            "nameEn": "No Whipped Cream",
            "nameAr": "No Whipped Cream",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10378",
    "categoryId": "cat-20",
    "nameEn": "Vanilla Matcha Frappe",
    "nameAr": "فانيلا ماتشا فراب",
    "emoji": "",
    "imageUrl": "/menu/p-10378.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "Small",
        "nameAr": "صغير",
        "price": 3.95
      },
      {
        "id": "M",
        "nameEn": "Medium",
        "nameAr": "وسط",
        "price": 4.55
      }
    ],
    "customizations": [
      {
        "id": "g-2056",
        "nameEn": "Milk Type",
        "nameAr": "نوع الحليب",
        "multiple": false,
        "options": [
          {
            "id": "o-7844",
            "nameEn": "Fresh Milk",
            "nameAr": "حليب بقري طازج",
            "priceDelta": 0
          },
          {
            "id": "o-3064",
            "nameEn": "Full Fat Milk",
            "nameAr": "Full Fat Milk",
            "priceDelta": 0
          },
          {
            "id": "o-3065",
            "nameEn": "Skimmed Milk",
            "nameAr": "حليب خالي الدسم",
            "priceDelta": 0
          },
          {
            "id": "o-3066",
            "nameEn": "Oat Milk",
            "nameAr": "حليب شوفان",
            "priceDelta": 0.4
          },
          {
            "id": "o-3067",
            "nameEn": "Soy Milk",
            "nameAr": "حليب صويا",
            "priceDelta": 0.4
          },
          {
            "id": "o-3068",
            "nameEn": "Almond Milk",
            "nameAr": "حليب اللوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3069",
            "nameEn": "Lactose Free Milk",
            "nameAr": "حليب خالي اللاكتوز",
            "priceDelta": 0.4
          },
          {
            "id": "o-3070",
            "nameEn": "Coconut Milk",
            "nameAr": "حليب جوز الهند",
            "priceDelta": 0.4
          }
        ]
      },
      {
        "id": "g-3010",
        "nameEn": "Extra For Frappe",
        "nameAr": "Extra For Frappe",
        "multiple": true,
        "options": [
          {
            "id": "o-11037",
            "nameEn": "Extra Shot",
            "nameAr": "Extra Shot",
            "priceDelta": 0.4
          },
          {
            "id": "o-11038",
            "nameEn": "Decaf",
            "nameAr": "Decaf",
            "priceDelta": 0.4
          },
          {
            "id": "o-11039",
            "nameEn": "No Whipped Cream",
            "nameAr": "No Whipped Cream",
            "priceDelta": 0
          }
        ]
      },
      {
        "id": "g-3017",
        "nameEn": "Matcha Flavor",
        "nameAr": "فليفر الماتشا",
        "multiple": true,
        "options": [
          {
            "id": "o-11058",
            "nameEn": "Vanilla",
            "nameAr": "فانيلا",
            "priceDelta": 0
          },
          {
            "id": "o-11059",
            "nameEn": "Honey",
            "nameAr": "عسل",
            "priceDelta": 0
          },
          {
            "id": "o-11060",
            "nameEn": "Sugar Free Vanilla",
            "nameAr": "فانيلا خالية من السكر",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10264",
    "categoryId": "cat-11",
    "nameEn": "Vanilla Muffin",
    "nameAr": "مفن فانيلا",
    "emoji": "",
    "imageUrl": "/menu/p-10264.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 1.9
      }
    ],
    "customizations": [
      {
        "id": "g-2864",
        "nameEn": "Extra Sweet",
        "nameAr": "Extra Sweet",
        "multiple": true,
        "options": [
          {
            "id": "o-10127",
            "nameEn": "Extra Strawberry",
            "nameAr": "Extra Strawberry",
            "priceDelta": 0.6
          },
          {
            "id": "o-10128",
            "nameEn": "Extra Nutella",
            "nameAr": "Extra Nutella",
            "priceDelta": 0.6
          },
          {
            "id": "o-10130",
            "nameEn": "Extra Pistachio",
            "nameAr": "Extra Pistachio",
            "priceDelta": 1
          },
          {
            "id": "o-10131",
            "nameEn": "Extra Cream",
            "nameAr": "Extra Cream",
            "priceDelta": 0.45
          },
          {
            "id": "o-10132",
            "nameEn": "Extra Nuts",
            "nameAr": "Extra Nuts",
            "priceDelta": 0.45
          },
          {
            "id": "o-10129",
            "nameEn": "Ice Cream",
            "nameAr": "Ice Cream",
            "priceDelta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "p-10320",
    "categoryId": "cat-18",
    "nameEn": "Veggie Pizza",
    "nameAr": "خضار بيتزا",
    "emoji": "",
    "imageUrl": "/menu/p-10320.webp",
    "sizes": [
      {
        "id": "S",
        "nameEn": "White . Medium",
        "nameAr": "وسط ابيض",
        "price": 5.5
      },
      {
        "id": "M",
        "nameEn": "White . Large",
        "nameAr": "كبير ابيض",
        "price": 7.5
      },
      {
        "id": "L",
        "nameEn": "brown . Medium",
        "nameAr": "وسط اسمر",
        "price": 6
      }
    ],
    "customizations": [
      {
        "id": "g-2981",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-10896",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-10897",
            "nameEn": "Extra Blue Cheese",
            "nameAr": "اكسترا بلو تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-10898",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-10899",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-10900",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-10901",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-10902",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-10904",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-10905",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-10906",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-10907",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          },
          {
            "id": "o-11428",
            "nameEn": "Extra Green Olive",
            "nameAr": "Extra Green Olive",
            "priceDelta": 0.6
          }
        ]
      },
      {
        "id": "g-1506",
        "nameEn": "Remove:",
        "nameAr": "ازالة:",
        "multiple": true,
        "options": [
          {
            "id": "o-912",
            "nameEn": "Remove Mushroom",
            "nameAr": "أزل الفطر",
            "priceDelta": 0
          },
          {
            "id": "o-913",
            "nameEn": "Remove Black Olive",
            "nameAr": "أزل الزيتون الأسود",
            "priceDelta": 0
          },
          {
            "id": "o-914",
            "nameEn": "Remove Green Olive",
            "nameAr": "أزل الزيتون الأخضر",
            "priceDelta": 0
          },
          {
            "id": "o-11324",
            "nameEn": "Remove Mozzarella Cheese",
            "nameAr": "أزل الجبنة",
            "priceDelta": 0
          },
          {
            "id": "o-11326",
            "nameEn": "Remove Pizza Sauce",
            "nameAr": "أزل صوص البيتزا",
            "priceDelta": 0
          },
          {
            "id": "o-11325",
            "nameEn": "Remove Basil Leaves",
            "nameAr": "أزل أوراق الريحان",
            "priceDelta": 0
          },
          {
            "id": "o-11327",
            "nameEn": "Remove Bell Pepper",
            "nameAr": "أزل الفلفل الأخضر",
            "priceDelta": 0
          }
        ]
      }
    ]
  },
  {
    "id": "p-10386",
    "categoryId": "cat-44",
    "nameEn": "Water 500 Ml",
    "nameAr": "مياه 500 مل",
    "emoji": "",
    "imageUrl": "/menu/p-10386.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 0.75
      }
    ],
    "customizations": []
  },
  {
    "id": "p-10314",
    "categoryId": "cat-15",
    "nameEn": "White Cheese Manousheh",
    "nameAr": "منقوشة جبنة بيضاء",
    "emoji": "",
    "imageUrl": "/menu/p-10314.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": [
      {
        "id": "g-1958",
        "nameEn": "Dough Type",
        "nameAr": "نوع العجين",
        "multiple": false,
        "options": [
          {
            "id": "o-7882",
            "nameEn": "White Dough",
            "nameAr": "عجينة أبيض",
            "priceDelta": 0
          },
          {
            "id": "o-2448",
            "nameEn": "Whole Brown Dough",
            "nameAr": "عجينة القمح البلدي الكامل",
            "priceDelta": 0.5
          }
        ]
      },
      {
        "id": "g-2792",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8909",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-8910",
            "nameEn": "Extra Blue Cheese",
            "nameAr": "اكسترا بلو تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-8911",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8912",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8913",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-8914",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-8915",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-8917",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-8918",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8919",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-8920",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10313",
    "categoryId": "cat-15",
    "nameEn": "Zaatar And Cheese Manousheh",
    "nameAr": "منقوشة زعتر وجبنة",
    "emoji": "",
    "imageUrl": "/menu/p-10313.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 3.5
      }
    ],
    "customizations": [
      {
        "id": "g-1959",
        "nameEn": "Dough Type",
        "nameAr": "نوع العجين",
        "multiple": false,
        "options": [
          {
            "id": "o-7883",
            "nameEn": "White Dough",
            "nameAr": "عجينة أبيض",
            "priceDelta": 0
          },
          {
            "id": "o-2449",
            "nameEn": "Whole Brown Dough",
            "nameAr": "عجينة القمح البلدي الكامل",
            "priceDelta": 0.5
          }
        ]
      },
      {
        "id": "g-2793",
        "nameEn": "Extras:",
        "nameAr": "إضافات",
        "multiple": true,
        "options": [
          {
            "id": "o-8921",
            "nameEn": "Extra Beef Bacon",
            "nameAr": "اكسترا بيف بيكون",
            "priceDelta": 0.9
          },
          {
            "id": "o-8922",
            "nameEn": "Extra Blue Cheese",
            "nameAr": "اكسترا بلو تشيز",
            "priceDelta": 0.6
          },
          {
            "id": "o-8923",
            "nameEn": "Extra Chicken",
            "nameAr": "اكسترا دجاج",
            "priceDelta": 0.9
          },
          {
            "id": "o-8924",
            "nameEn": "Extra Mozarella Cheese",
            "nameAr": "اكسترا جبنة موزاريلا",
            "priceDelta": 0.9
          },
          {
            "id": "o-8925",
            "nameEn": "Extra Mushroom",
            "nameAr": "اكسترا فطر",
            "priceDelta": 0.6
          },
          {
            "id": "o-8926",
            "nameEn": "Extra Black Olive",
            "nameAr": "اكسترا زيتون اسود",
            "priceDelta": 0.6
          },
          {
            "id": "o-8927",
            "nameEn": "Extra Parmasan Cheese",
            "nameAr": "اكسترا جبنة بارمزان",
            "priceDelta": 0.6
          },
          {
            "id": "o-8929",
            "nameEn": "Extra Pastrami",
            "nameAr": "اكسترا بسطرمة",
            "priceDelta": 1.5
          },
          {
            "id": "o-8930",
            "nameEn": "Extra Pepperoni",
            "nameAr": "اكسترا ببروني",
            "priceDelta": 0.9
          },
          {
            "id": "o-8931",
            "nameEn": "Extra Roast Beef",
            "nameAr": "اكسترا روست بيف",
            "priceDelta": 0.6
          },
          {
            "id": "o-8932",
            "nameEn": "Extra Sundried Tomato",
            "nameAr": "اكسترا بندورة مجففة",
            "priceDelta": 0.6
          }
        ]
      }
    ]
  },
  {
    "id": "p-10145",
    "categoryId": "cat-2",
    "nameEn": "Zaatar Croissant",
    "nameAr": "كرواسون زعتر",
    "emoji": "",
    "imageUrl": "/menu/p-10145.webp",
    "sizes": [
      {
        "id": "M",
        "nameEn": "Regular",
        "nameAr": "عادي",
        "price": 2.5
      }
    ],
    "customizations": []
  }
];
