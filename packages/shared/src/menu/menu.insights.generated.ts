// AUTO-GENERATED — do not edit by hand. Regenerate with:
//   ODOO_URL=… ODOO_DB=… ODOO_LOGIN=… ODOO_API_KEY=… npx tsx scripts/odoo-menu-insights.ts
//
// Aggregates only (counts and shares per product) from paid Odoo POS orders.
// No order, customer, cashier or branch data. See the script header.

export interface ItemInsight {
  lines: number;
  orders: number;
  /** Share of this item's lines sold in each size (by Odoo size name). */
  sizes: { name: string; share: number }[];
  /** Paid choices customers add most, share of this item's lines. */
  choices: { optionId: string; share: number }[];
  /** Separate add-on products rung straight after this item. */
  modifiers: { modifierId: string; share: number }[];
  /** Items from another category in the same order: P(B|A) and lift. */
  crossSell: { itemId: string; attach: number; lift: number }[];
}
export interface ModifierProduct { id: string; categoryId: string; nameEn: string; nameAr: string; price: number }

export const insightsWindow = {"from":"2026-08-11","to":"2026-09-25","days":45,"orders":134306,"lines":273906} as const;

export const modifierProducts: ModifierProduct[] = [
  {
    "id": "m-10596",
    "categoryId": "cat-32",
    "nameEn": "Extra Avocado",
    "nameAr": "Extra Avocado",
    "price": 1.5
  },
  {
    "id": "m-11374",
    "categoryId": "cat-34",
    "nameEn": "Extra Cold Foam",
    "nameAr": "Extra Cold Foam",
    "price": 0.6
  },
  {
    "id": "m-10613",
    "categoryId": "cat-34",
    "nameEn": "Extra Decaf Coffee",
    "nameAr": "Extra Decaf Coffee",
    "price": 0.4
  },
  {
    "id": "m-10603",
    "categoryId": "cat-33",
    "nameEn": "Extra Mushroom",
    "nameAr": "Extra Mushroom",
    "price": 0.6
  },
  {
    "id": "m-10762",
    "categoryId": "cat-38",
    "nameEn": "Extra Nutella",
    "nameAr": "Extra Nutella",
    "price": 1
  },
  {
    "id": "m-10616",
    "categoryId": "cat-34",
    "nameEn": "Extra Nuts",
    "nameAr": "Extra Nuts",
    "price": 0.45
  },
  {
    "id": "m-10614",
    "categoryId": "cat-34",
    "nameEn": "Extra Shot",
    "nameAr": "Extra Shot",
    "price": 0.4
  },
  {
    "id": "m-10835",
    "categoryId": "cat-32",
    "nameEn": "Extra Strawberry",
    "nameAr": "Extra Strawberry",
    "price": 0.6
  },
  {
    "id": "m-10792",
    "categoryId": "cat-32",
    "nameEn": "Ice Cream",
    "nameAr": "Ice Cream",
    "price": 1
  }
];

export const itemInsights: Record<string, ItemInsight> = {
 "p-11830": {
  "lines": 691,
  "orders": 672,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10352",
    "attach": 0.118,
    "lift": 1.43
   },
   {
    "itemId": "p-10334",
    "attach": 0.071,
    "lift": 1.15
   }
  ]
 },
 "p-10144": {
  "lines": 892,
  "orders": 882,
  "sizes": [],
  "choices": [],
  "modifiers": [
   {
    "modifierId": "m-10762",
    "share": 0.035
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10337",
    "attach": 0.08,
    "lift": 2.82
   },
   {
    "itemId": "p-10338",
    "attach": 0.07,
    "lift": 1.43
   },
   {
    "itemId": "p-10379",
    "attach": 0.034,
    "lift": 1.93
   }
  ]
 },
 "p-10162": {
  "lines": 1636,
  "orders": 1567,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-9834",
    "share": 0.028
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.068,
    "lift": 2.43
   },
   {
    "itemId": "p-10334",
    "attach": 0.101,
    "lift": 1.63
   },
   {
    "itemId": "p-10338",
    "attach": 0.08,
    "lift": 1.62
   }
  ]
 },
 "p-10169": {
  "lines": 1340,
  "orders": 1303,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-11889",
    "share": 0.028
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.088,
    "lift": 3.17
   },
   {
    "itemId": "p-10379",
    "attach": 0.055,
    "lift": 3.13
   },
   {
    "itemId": "p-10338",
    "attach": 0.087,
    "lift": 1.78
   }
  ]
 },
 "p-10384": {
  "lines": 3788,
  "orders": 3738,
  "sizes": [
   {
    "name": "Small",
    "share": 0.473
   },
   {
    "name": "Medium",
    "share": 0.388
   },
   {
    "name": "Short",
    "share": 0.01
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10163",
    "attach": 0.044,
    "lift": 2.99
   },
   {
    "itemId": "p-10159",
    "attach": 0.039,
    "lift": 2.81
   },
   {
    "itemId": "p-10169",
    "attach": 0.031,
    "lift": 3.17
   }
  ]
 },
 "p-10352": {
  "lines": 11591,
  "orders": 11018,
  "sizes": [
   {
    "name": "Small",
    "share": 0.445
   },
   {
    "name": "Medium",
    "share": 0.358
   }
  ],
  "choices": [
   {
    "optionId": "o-3105",
    "share": 0.085
   },
   {
    "optionId": "o-3102",
    "share": 0.044
   },
   {
    "optionId": "o-3104",
    "share": 0.044
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-11374",
    "share": 0.022
   }
  ],
  "crossSell": []
 },
 "p-10338": {
  "lines": 6887,
  "orders": 6598,
  "sizes": [
   {
    "name": "Small",
    "share": 0.515
   },
   {
    "name": "Medium",
    "share": 0.266
   },
   {
    "name": "Short",
    "share": 0.006
   }
  ],
  "choices": [
   {
    "optionId": "o-2576",
    "share": 0.098
   },
   {
    "optionId": "o-11110",
    "share": 0.042
   },
   {
    "optionId": "o-2575",
    "share": 0.04
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10163",
    "attach": 0.021,
    "lift": 1.42
   }
  ]
 },
 "p-10334": {
  "lines": 8469,
  "orders": 8315,
  "sizes": [
   {
    "name": "Small",
    "share": 0.586
   },
   {
    "name": "Medium",
    "share": 0.203
   },
   {
    "name": "Short",
    "share": 0.036
   }
  ],
  "choices": [
   {
    "optionId": "o-10973",
    "share": 0.051
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10164",
    "attach": 0.031,
    "lift": 2.68
   }
  ]
 },
 "p-10387": {
  "lines": 1381,
  "orders": 1312,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10342",
    "attach": 0.043,
    "lift": 2.38
   },
   {
    "itemId": "p-10382",
    "attach": 0.024,
    "lift": 1.18
   }
  ]
 },
 "p-10353": {
  "lines": 9218,
  "orders": 9088,
  "sizes": [
   {
    "name": "Small",
    "share": 0.516
   },
   {
    "name": "Medium",
    "share": 0.38
   }
  ],
  "choices": [
   {
    "optionId": "o-10986",
    "share": 0.031
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10164",
    "attach": 0.022,
    "lift": 1.9
   },
   {
    "itemId": "p-10260",
    "attach": 0.027,
    "lift": 1.12
   }
  ]
 },
 "p-10151": {
  "lines": 707,
  "orders": 695,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10353",
    "attach": 0.128,
    "lift": 1.89
   },
   {
    "itemId": "p-10165",
    "attach": 0.036,
    "lift": 3.53
   },
   {
    "itemId": "p-10338",
    "attach": 0.081,
    "lift": 1.64
   }
  ]
 },
 "p-10333": {
  "lines": 3556,
  "orders": 3494,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-2569",
    "share": 0.068
   },
   {
    "optionId": "o-2566",
    "share": 0.043
   },
   {
    "optionId": "o-11106",
    "share": 0.031
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10166": {
  "lines": 676,
  "orders": 657,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-9895",
    "share": 0.459
   },
   {
    "optionId": "o-9903",
    "share": 0.158
   },
   {
    "optionId": "o-9902",
    "share": 0.031
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.061,
    "lift": 2.19
   },
   {
    "itemId": "p-10334",
    "attach": 0.073,
    "lift": 1.18
   },
   {
    "itemId": "p-10352",
    "attach": 0.093,
    "lift": 1.13
   }
  ]
 },
 "p-10245": {
  "lines": 816,
  "orders": 813,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-10469",
    "share": 0.027
   },
   {
    "optionId": "o-10470",
    "share": 0.023
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10337",
    "attach": 0.07,
    "lift": 2.46
   },
   {
    "itemId": "p-10338",
    "attach": 0.089,
    "lift": 1.8
   },
   {
    "itemId": "p-10344",
    "attach": 0.092,
    "lift": 1.38
   }
  ]
 },
 "p-10386": {
  "lines": 20659,
  "orders": 18908,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10351",
    "attach": 0.057,
    "lift": 1.91
   },
   {
    "itemId": "p-10344",
    "attach": 0.093,
    "lift": 1.38
   },
   {
    "itemId": "p-10379",
    "attach": 0.027,
    "lift": 1.52
   }
  ]
 },
 "p-10378": {
  "lines": 1263,
  "orders": 1216,
  "sizes": [
   {
    "name": "Medium",
    "share": 0.422
   },
   {
    "name": "Small",
    "share": 0.35
   }
  ],
  "choices": [
   {
    "optionId": "o-3070",
    "share": 0.174
   },
   {
    "optionId": "o-3069",
    "share": 0.044
   },
   {
    "optionId": "o-3068",
    "share": 0.041
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-11374",
    "share": 0.034
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10165",
    "attach": 0.024,
    "lift": 2.34
   },
   {
    "itemId": "p-10383",
    "attach": 0.021,
    "lift": 1.64
   },
   {
    "itemId": "p-10243",
    "attach": 0.049,
    "lift": 1.21
   }
  ]
 },
 "p-10357": {
  "lines": 11865,
  "orders": 11508,
  "sizes": [
   {
    "name": "Small",
    "share": 0.453
   },
   {
    "name": "Medium",
    "share": 0.392
   }
  ],
  "choices": [
   {
    "optionId": "o-3133",
    "share": 0.047
   },
   {
    "optionId": "o-3130",
    "share": 0.025
   },
   {
    "optionId": "o-11163",
    "share": 0.02
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-11374",
    "share": 0.022
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10260",
    "attach": 0.031,
    "lift": 1.31
   }
  ]
 },
 "p-10197": {
  "lines": 1043,
  "orders": 1033,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.077,
    "lift": 2.78
   },
   {
    "itemId": "p-10352",
    "attach": 0.1,
    "lift": 1.22
   },
   {
    "itemId": "p-10339",
    "attach": 0.029,
    "lift": 1.92
   }
  ]
 },
 "p-10383": {
  "lines": 1717,
  "orders": 1684,
  "sizes": [
   {
    "name": "Small",
    "share": 0.464
   },
   {
    "name": "Medium",
    "share": 0.404
   }
  ],
  "choices": [
   {
    "optionId": "o-7704",
    "share": 0.147
   },
   {
    "optionId": "o-7703",
    "share": 0.062
   },
   {
    "optionId": "o-7700",
    "share": 0.058
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-11374",
    "share": 0.031
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10260",
    "attach": 0.027,
    "lift": 1.13
   }
  ]
 },
 "p-10159": {
  "lines": 1931,
  "orders": 1879,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.078,
    "lift": 2.81
   },
   {
    "itemId": "p-10352",
    "attach": 0.115,
    "lift": 1.41
   },
   {
    "itemId": "p-10205",
    "attach": 0.03,
    "lift": 1.93
   }
  ]
 },
 "p-10355": {
  "lines": 1625,
  "orders": 1561,
  "sizes": [
   {
    "name": "Small",
    "share": 0.362
   },
   {
    "name": "Medium",
    "share": 0.298
   }
  ],
  "choices": [
   {
    "optionId": "o-3123",
    "share": 0.06
   },
   {
    "optionId": "o-3126",
    "share": 0.052
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-11374",
    "share": 0.022
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10243",
    "attach": 0.05,
    "lift": 1.24
   },
   {
    "itemId": "p-10159",
    "attach": 0.021,
    "lift": 1.51
   }
  ]
 },
 "p-10168": {
  "lines": 516,
  "orders": 505,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.113,
    "lift": 4.06
   },
   {
    "itemId": "p-10379",
    "attach": 0.065,
    "lift": 3.7
   },
   {
    "itemId": "p-10334",
    "attach": 0.097,
    "lift": 1.57
   }
  ]
 },
 "p-4469": {
  "lines": 2611,
  "orders": 2588,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-12059",
    "attach": 0.249,
    "lift": 18.28
   },
   {
    "itemId": "p-10357",
    "attach": 0.187,
    "lift": 2.18
   },
   {
    "itemId": "p-10334",
    "attach": 0.117,
    "lift": 1.88
   }
  ]
 },
 "p-10319": {
  "lines": 416,
  "orders": 415,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-2444",
    "share": 0.178
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10379",
    "attach": 0.082,
    "lift": 4.64
   }
  ]
 },
 "p-11799": {
  "lines": 412,
  "orders": 410,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10334",
    "attach": 0.085,
    "lift": 1.38
   },
   {
    "itemId": "p-10352",
    "attach": 0.098,
    "lift": 1.19
   }
  ]
 },
 "p-10339": {
  "lines": 2064,
  "orders": 2029,
  "sizes": [
   {
    "name": "Small",
    "share": 0.554
   },
   {
    "name": "Medium",
    "share": 0.251
   },
   {
    "name": "Short",
    "share": 0.005
   }
  ],
  "choices": [
   {
    "optionId": "o-2590",
    "share": 0.049
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10163",
    "attach": 0.024,
    "lift": 1.62
   },
   {
    "itemId": "p-10260",
    "attach": 0.028,
    "lift": 1.19
   }
  ]
 },
 "p-10335": {
  "lines": 817,
  "orders": 803,
  "sizes": [
   {
    "name": "Small",
    "share": 0.562
   },
   {
    "name": "Medium",
    "share": 0.306
   }
  ],
  "choices": [
   {
    "optionId": "o-2583",
    "share": 0.086
   },
   {
    "optionId": "o-2580",
    "share": 0.026
   },
   {
    "optionId": "o-2584",
    "share": 0.023
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-10613",
    "share": 0.026
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10260",
    "attach": 0.034,
    "lift": 1.42
   }
  ]
 },
 "p-11797": {
  "lines": 1205,
  "orders": 1188,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10205",
    "attach": 0.058,
    "lift": 3.69
   },
   {
    "itemId": "p-10384",
    "attach": 0.055,
    "lift": 1.97
   },
   {
    "itemId": "p-10338",
    "attach": 0.072,
    "lift": 1.46
   }
  ]
 },
 "p-10248": {
  "lines": 1541,
  "orders": 1535,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10344",
    "attach": 0.087,
    "lift": 1.3
   },
   {
    "itemId": "p-10338",
    "attach": 0.058,
    "lift": 1.18
   },
   {
    "itemId": "p-10337",
    "attach": 0.036,
    "lift": 1.26
   }
  ]
 },
 "p-10199": {
  "lines": 554,
  "orders": 551,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10243",
    "attach": 0.051,
    "lift": 1.27
   }
  ]
 },
 "p-10160": {
  "lines": 768,
  "orders": 756,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.07,
    "lift": 2.52
   },
   {
    "itemId": "p-10205",
    "attach": 0.037,
    "lift": 2.36
   },
   {
    "itemId": "p-10382",
    "attach": 0.041,
    "lift": 1.99
   }
  ]
 },
 "p-10351": {
  "lines": 4292,
  "orders": 4023,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10379",
    "attach": 0.021,
    "lift": 1.17
   }
  ]
 },
 "p-11668": {
  "lines": 818,
  "orders": 812,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-10723",
    "share": 0.353
   },
   {
    "optionId": "o-10722",
    "share": 0.075
   },
   {
    "optionId": "o-10721",
    "share": 0.072
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10357",
    "attach": 0.108,
    "lift": 1.26
   },
   {
    "itemId": "p-10382",
    "attach": 0.031,
    "lift": 1.49
   },
   {
    "itemId": "p-10365",
    "attach": 0.044,
    "lift": 1.1
   }
  ]
 },
 "p-10149": {
  "lines": 767,
  "orders": 760,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.062,
    "lift": 2.22
   },
   {
    "itemId": "p-10159",
    "attach": 0.036,
    "lift": 2.54
   },
   {
    "itemId": "p-10334",
    "attach": 0.086,
    "lift": 1.38
   }
  ]
 },
 "p-10244": {
  "lines": 1531,
  "orders": 1517,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-10621",
    "share": 0.155
   },
   {
    "optionId": "o-10619",
    "share": 0.031
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10357",
    "attach": 0.119,
    "lift": 1.39
   },
   {
    "itemId": "p-10258",
    "attach": 0.028,
    "lift": 2.25
   },
   {
    "itemId": "p-10260",
    "attach": 0.038,
    "lift": 1.59
   }
  ]
 },
 "p-10306": {
  "lines": 1010,
  "orders": 1010,
  "sizes": [
   {
    "name": "(6-8) people",
    "share": 0.371
   },
   {
    "name": "(10-12) poeple",
    "share": 0.3
   },
   {
    "name": "25 (تواصي)",
    "share": 0.002
   },
   {
    "name": "15 (تواصي)",
    "share": 0.002
   },
   {
    "name": "20 (تواصي)",
    "share": 0.001
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-12059",
    "attach": 0.027,
    "lift": 1.96
   }
  ]
 },
 "p-10362": {
  "lines": 271,
  "orders": 266,
  "sizes": [
   {
    "name": "Small",
    "share": 0.373
   },
   {
    "name": "Medium",
    "share": 0.317
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10201": {
  "lines": 538,
  "orders": 533,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10213",
    "attach": 0.049,
    "lift": 3.65
   },
   {
    "itemId": "p-10384",
    "attach": 0.062,
    "lift": 2.22
   }
  ]
 },
 "p-10165": {
  "lines": 1413,
  "orders": 1368,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-9877",
    "share": 0.109
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10334",
    "attach": 0.11,
    "lift": 1.78
   },
   {
    "itemId": "p-10353",
    "attach": 0.11,
    "lift": 1.63
   },
   {
    "itemId": "p-10352",
    "attach": 0.109,
    "lift": 1.33
   }
  ]
 },
 "p-10375": {
  "lines": 692,
  "orders": 680,
  "sizes": [
   {
    "name": "Small",
    "share": 0.487
   },
   {
    "name": "Medium",
    "share": 0.455
   }
  ],
  "choices": [
   {
    "optionId": "o-3048",
    "share": 0.035
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-10792",
    "share": 0.064
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10365",
    "attach": 0.056,
    "lift": 1.39
   }
  ]
 },
 "p-10225": {
  "lines": 816,
  "orders": 813,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-10566",
    "share": 0.054
   },
   {
    "optionId": "o-10565",
    "share": 0.031
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10344",
    "attach": 0.113,
    "lift": 1.69
   },
   {
    "itemId": "p-10334",
    "attach": 0.098,
    "lift": 1.59
   },
   {
    "itemId": "p-10338",
    "attach": 0.081,
    "lift": 1.65
   }
  ]
 },
 "p-10342": {
  "lines": 2500,
  "orders": 2452,
  "sizes": [
   {
    "name": "Short",
    "share": 0.968
   }
  ],
  "choices": [
   {
    "optionId": "o-11077",
    "share": 0.719
   },
   {
    "optionId": "o-11078",
    "share": 0.023
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-10614",
    "share": 0.036
   }
  ],
  "crossSell": []
 },
 "p-10356": {
  "lines": 2147,
  "orders": 2112,
  "sizes": [
   {
    "name": "Small",
    "share": 0.384
   },
   {
    "name": "Medium",
    "share": 0.375
   }
  ],
  "choices": [
   {
    "optionId": "o-3098",
    "share": 0.047
   },
   {
    "optionId": "o-11139",
    "share": 0.021
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-11374",
    "share": 0.036
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10246",
    "attach": 0.02,
    "lift": 1.62
   },
   {
    "itemId": "p-10243",
    "attach": 0.046,
    "lift": 1.16
   },
   {
    "itemId": "p-10260",
    "attach": 0.028,
    "lift": 1.18
   }
  ]
 },
 "p-10249": {
  "lines": 1204,
  "orders": 1201,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-10523",
    "share": 0.039
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10356",
    "attach": 0.022,
    "lift": 1.38
   }
  ]
 },
 "p-10163": {
  "lines": 2007,
  "orders": 1962,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.083,
    "lift": 2.99
   },
   {
    "itemId": "p-10379",
    "attach": 0.048,
    "lift": 2.74
   },
   {
    "itemId": "p-10334",
    "attach": 0.084,
    "lift": 1.36
   }
  ]
 },
 "p-10358": {
  "lines": 1638,
  "orders": 1604,
  "sizes": [
   {
    "name": "Small",
    "share": 0.482
   },
   {
    "name": "Medium",
    "share": 0.393
   }
  ],
  "choices": [
   {
    "optionId": "o-3112",
    "share": 0.044
   },
   {
    "optionId": "o-3109",
    "share": 0.032
   },
   {
    "optionId": "o-3111",
    "share": 0.021
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-10613",
    "share": 0.023
   },
   {
    "modifierId": "m-11374",
    "share": 0.021
   }
  ],
  "crossSell": []
 },
 "p-11926": {
  "lines": 379,
  "orders": 374,
  "sizes": [
   {
    "name": "Small",
    "share": 0.53
   },
   {
    "name": "Medium",
    "share": 0.393
   }
  ],
  "choices": [
   {
    "optionId": "o-11404",
    "share": 0.045
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10371": {
  "lines": 378,
  "orders": 371,
  "sizes": [
   {
    "name": "Small",
    "share": 0.357
   },
   {
    "name": "Medium",
    "share": 0.267
   }
  ],
  "choices": [],
  "modifiers": [
   {
    "modifierId": "m-10792",
    "share": 0.053
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10243",
    "attach": 0.075,
    "lift": 1.88
   }
  ]
 },
 "p-10313": {
  "lines": 762,
  "orders": 761,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-2449",
    "share": 0.278
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10379",
    "attach": 0.092,
    "lift": 5.21
   },
   {
    "itemId": "p-10384",
    "attach": 0.068,
    "lift": 2.46
   },
   {
    "itemId": "p-10162",
    "attach": 0.034,
    "lift": 2.93
   }
  ]
 },
 "p-10337": {
  "lines": 3992,
  "orders": 3831,
  "sizes": [
   {
    "name": "Small",
    "share": 0.607
   },
   {
    "name": "Medium",
    "share": 0.241
   },
   {
    "name": "Short",
    "share": 0.002
   }
  ],
  "choices": [
   {
    "optionId": "o-2555",
    "share": 0.068
   },
   {
    "optionId": "o-2552",
    "share": 0.029
   },
   {
    "optionId": "o-2554",
    "share": 0.028
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-10613",
    "share": 0.027
   },
   {
    "modifierId": "m-10614",
    "share": 0.021
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10251",
    "attach": 0.025,
    "lift": 2.42
   },
   {
    "itemId": "p-10246",
    "attach": 0.02,
    "lift": 1.6
   },
   {
    "itemId": "p-10163",
    "attach": 0.022,
    "lift": 1.52
   }
  ]
 },
 "p-10170": {
  "lines": 652,
  "orders": 640,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10379",
    "attach": 0.08,
    "lift": 4.51
   },
   {
    "itemId": "p-10384",
    "attach": 0.083,
    "lift": 2.98
   },
   {
    "itemId": "p-10344",
    "attach": 0.119,
    "lift": 1.77
   }
  ]
 },
 "p-10348": {
  "lines": 869,
  "orders": 853,
  "sizes": [
   {
    "name": "Small",
    "share": 0.633
   },
   {
    "name": "Medium",
    "share": 0.252
   }
  ],
  "choices": [
   {
    "optionId": "o-2985",
    "share": 0.036
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10260",
    "attach": 0.042,
    "lift": 1.79
   }
  ]
 },
 "p-10344": {
  "lines": 9212,
  "orders": 9002,
  "sizes": [
   {
    "name": "Small",
    "share": 0.601
   },
   {
    "name": "Medium",
    "share": 0.325
   },
   {
    "name": "Short",
    "share": 0.037
   }
  ],
  "choices": [],
  "modifiers": [
   {
    "modifierId": "m-10614",
    "share": 0.02
   }
  ],
  "crossSell": []
 },
 "p-10205": {
  "lines": 2138,
  "orders": 2112,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-10738",
    "share": 0.084
   },
   {
    "optionId": "o-10743",
    "share": 0.052
   },
   {
    "optionId": "o-12050",
    "share": 0.02
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-11797",
    "attach": 0.033,
    "lift": 3.69
   },
   {
    "itemId": "p-10243",
    "attach": 0.058,
    "lift": 1.44
   },
   {
    "itemId": "p-10384",
    "attach": 0.043,
    "lift": 1.53
   }
  ]
 },
 "p-10152": {
  "lines": 1201,
  "orders": 1172,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-9733",
    "share": 0.49
   },
   {
    "optionId": "o-9741",
    "share": 0.126
   },
   {
    "optionId": "o-9740",
    "share": 0.042
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.067,
    "lift": 2.42
   },
   {
    "itemId": "p-10163",
    "attach": 0.037,
    "lift": 2.51
   },
   {
    "itemId": "p-10357",
    "attach": 0.113,
    "lift": 1.32
   }
  ]
 },
 "p-10246": {
  "lines": 1693,
  "orders": 1687,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10337",
    "attach": 0.046,
    "lift": 1.6
   },
   {
    "itemId": "p-10356",
    "attach": 0.025,
    "lift": 1.62
   },
   {
    "itemId": "p-10344",
    "attach": 0.077,
    "lift": 1.15
   }
  ]
 },
 "p-11925": {
  "lines": 552,
  "orders": 548,
  "sizes": [
   {
    "name": "Small",
    "share": 0.489
   },
   {
    "name": "Medium",
    "share": 0.487
   }
  ],
  "choices": [
   {
    "optionId": "o-11391",
    "share": 0.116
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10385": {
  "lines": 1821,
  "orders": 1807,
  "sizes": [
   {
    "name": "Small",
    "share": 0.495
   },
   {
    "name": "Medium",
    "share": 0.453
   }
  ],
  "choices": [],
  "modifiers": [
   {
    "modifierId": "m-10835",
    "share": 0.048
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10260",
    "attach": 0.029,
    "lift": 1.22
   }
  ]
 },
 "p-12051": {
  "lines": 416,
  "orders": 412,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10243",
    "attach": 0.068,
    "lift": 1.69
   },
   {
    "itemId": "p-10365",
    "attach": 0.061,
    "lift": 1.51
   }
  ]
 },
 "p-10388": {
  "lines": 636,
  "orders": 627,
  "sizes": [
   {
    "name": "Small",
    "share": 0.451
   },
   {
    "name": "Medium",
    "share": 0.403
   }
  ],
  "choices": [
   {
    "optionId": "o-11185",
    "share": 0.126
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10222": {
  "lines": 657,
  "orders": 656,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10344",
    "attach": 0.111,
    "lift": 1.66
   },
   {
    "itemId": "p-10337",
    "attach": 0.047,
    "lift": 1.66
   },
   {
    "itemId": "p-10338",
    "attach": 0.063,
    "lift": 1.27
   }
  ]
 },
 "p-11923": {
  "lines": 455,
  "orders": 453,
  "sizes": [
   {
    "name": "Small",
    "share": 0.453
   },
   {
    "name": "Medium",
    "share": 0.409
   }
  ],
  "choices": [],
  "modifiers": [
   {
    "modifierId": "m-11374",
    "share": 0.042
   }
  ],
  "crossSell": []
 },
 "p-10211": {
  "lines": 830,
  "orders": 825,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.039,
    "lift": 1.39
   }
  ]
 },
 "p-11369": {
  "lines": 383,
  "orders": 375,
  "sizes": [
   {
    "name": "Medium",
    "share": 0.36
   },
   {
    "name": "Small",
    "share": 0.355
   }
  ],
  "choices": [
   {
    "optionId": "o-8269",
    "share": 0.091
   },
   {
    "optionId": "o-8268",
    "share": 0.052
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-11374",
    "share": 0.123
   }
  ],
  "crossSell": []
 },
 "p-10155": {
  "lines": 358,
  "orders": 356,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.096,
    "lift": 3.43
   },
   {
    "itemId": "p-10334",
    "attach": 0.073,
    "lift": 1.18
   },
   {
    "itemId": "p-10357",
    "attach": 0.096,
    "lift": 1.11
   }
  ]
 },
 "p-10366": {
  "lines": 360,
  "orders": 356,
  "sizes": [
   {
    "name": "Medium",
    "share": 0.483
   },
   {
    "name": "Small",
    "share": 0.344
   }
  ],
  "choices": [
   {
    "optionId": "o-3013",
    "share": 0.072
   },
   {
    "optionId": "o-3014",
    "share": 0.042
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-10792",
    "share": 0.061
   }
  ],
  "crossSell": []
 },
 "p-10365": {
  "lines": 5665,
  "orders": 5412,
  "sizes": [
   {
    "name": "Medium",
    "share": 0.478
   },
   {
    "name": "Small",
    "share": 0.454
   }
  ],
  "choices": [
   {
    "optionId": "o-3006",
    "share": 0.067
   },
   {
    "optionId": "o-3005",
    "share": 0.044
   },
   {
    "optionId": "o-11025",
    "share": 0.042
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-10792",
    "share": 0.058
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10260",
    "attach": 0.026,
    "lift": 1.11
   }
  ]
 },
 "p-10276": {
  "lines": 332,
  "orders": 330,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10352",
    "attach": 0.103,
    "lift": 1.26
   }
  ]
 },
 "p-10367": {
  "lines": 395,
  "orders": 382,
  "sizes": [
   {
    "name": "Small",
    "share": 0.294
   },
   {
    "name": "Medium",
    "share": 0.271
   }
  ],
  "choices": [
   {
    "optionId": "o-2991",
    "share": 0.096
   },
   {
    "optionId": "o-2992",
    "share": 0.043
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-10616",
    "share": 0.053
   }
  ],
  "crossSell": []
 },
 "p-10289": {
  "lines": 883,
  "orders": 877,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10243",
    "attach": 0.052,
    "lift": 1.31
   }
  ]
 },
 "p-10259": {
  "lines": 592,
  "orders": 584,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10243",
    "attach": 0.072,
    "lift": 1.79
   },
   {
    "itemId": "p-10357",
    "attach": 0.104,
    "lift": 1.22
   },
   {
    "itemId": "p-10352",
    "attach": 0.094,
    "lift": 1.15
   }
  ]
 },
 "p-10258": {
  "lines": 1671,
  "orders": 1656,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10357",
    "attach": 0.136,
    "lift": 1.59
   },
   {
    "itemId": "p-10243",
    "attach": 0.06,
    "lift": 1.49
   },
   {
    "itemId": "p-10244",
    "attach": 0.025,
    "lift": 2.25
   }
  ]
 },
 "p-10359": {
  "lines": 670,
  "orders": 663,
  "sizes": [
   {
    "name": "Medium",
    "share": 0.436
   },
   {
    "name": "Small",
    "share": 0.4
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10761": {
  "lines": 1842,
  "orders": 1835,
  "sizes": [
   {
    "name": "Medium",
    "share": 0.496
   },
   {
    "name": "Small",
    "share": 0.44
   }
  ],
  "choices": [
   {
    "optionId": "o-11182",
    "share": 0.048
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10395": {
  "lines": 164,
  "orders": 163,
  "sizes": [
   {
    "name": "Medium",
    "share": 0.409
   },
   {
    "name": "Small",
    "share": 0.39
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10345": {
  "lines": 846,
  "orders": 828,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-2530",
    "share": 0.079
   },
   {
    "optionId": "o-2533",
    "share": 0.047
   },
   {
    "optionId": "o-11074",
    "share": 0.039
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10377": {
  "lines": 375,
  "orders": 367,
  "sizes": [
   {
    "name": "Small",
    "share": 0.528
   },
   {
    "name": "Medium",
    "share": 0.32
   }
  ],
  "choices": [],
  "modifiers": [
   {
    "modifierId": "m-10792",
    "share": 0.141
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10357",
    "attach": 0.109,
    "lift": 1.27
   }
  ]
 },
 "p-10300": {
  "lines": 1832,
  "orders": 1830,
  "sizes": [
   {
    "name": "(6-8) people",
    "share": 0.389
   },
   {
    "name": "(10-12) poeple",
    "share": 0.321
   },
   {
    "name": "15 (تواصي)",
    "share": 0.001
   },
   {
    "name": "20 (تواصي)",
    "share": 0.001
   },
   {
    "name": "25 (تواصي)",
    "share": 0.001
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-12059",
    "attach": 0.036,
    "lift": 2.61
   }
  ]
 },
 "p-10379": {
  "lines": 2431,
  "orders": 2372,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10313",
    "attach": 0.03,
    "lift": 5.21
   },
   {
    "itemId": "p-10163",
    "attach": 0.04,
    "lift": 2.74
   },
   {
    "itemId": "p-10169",
    "attach": 0.03,
    "lift": 3.13
   }
  ]
 },
 "p-10317": {
  "lines": 639,
  "orders": 637,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-2443",
    "share": 0.271
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10379",
    "attach": 0.057,
    "lift": 3.2
   },
   {
    "itemId": "p-10384",
    "attach": 0.058,
    "lift": 2.09
   }
  ]
 },
 "p-10314": {
  "lines": 585,
  "orders": 583,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-2448",
    "share": 0.215
   },
   {
    "optionId": "o-8914",
    "share": 0.027
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10379",
    "attach": 0.081,
    "lift": 4.56
   },
   {
    "itemId": "p-10384",
    "attach": 0.082,
    "lift": 2.96
   },
   {
    "itemId": "p-10243",
    "attach": 0.051,
    "lift": 1.28
   }
  ]
 },
 "p-10231": {
  "lines": 1230,
  "orders": 1224,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10344",
    "attach": 0.091,
    "lift": 1.35
   },
   {
    "itemId": "p-10357",
    "attach": 0.096,
    "lift": 1.13
   },
   {
    "itemId": "p-12059",
    "attach": 0.02,
    "lift": 1.5
   }
  ]
 },
 "p-10793": {
  "lines": 222,
  "orders": 222,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10382": {
  "lines": 2810,
  "orders": 2768,
  "sizes": [
   {
    "name": "Small",
    "share": 0.503
   },
   {
    "name": "Medium",
    "share": 0.44
   },
   {
    "name": "Short",
    "share": 0
   }
  ],
  "choices": [
   {
    "optionId": "o-11180",
    "share": 0.091
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10260",
    "attach": 0.029,
    "lift": 1.21
   }
  ]
 },
 "p-10161": {
  "lines": 1029,
  "orders": 986,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.069,
    "lift": 2.48
   },
   {
    "itemId": "p-10352",
    "attach": 0.095,
    "lift": 1.16
   },
   {
    "itemId": "p-10337",
    "attach": 0.039,
    "lift": 1.35
   }
  ]
 },
 "p-10280": {
  "lines": 488,
  "orders": 483,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10338",
    "attach": 0.056,
    "lift": 1.14
   }
  ]
 },
 "p-10287": {
  "lines": 538,
  "orders": 534,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10243",
    "attach": 0.054,
    "lift": 1.35
   }
  ]
 },
 "p-10298": {
  "lines": 413,
  "orders": 413,
  "sizes": [
   {
    "name": "(10-12) poeple",
    "share": 0.341
   },
   {
    "name": "(6-8) people",
    "share": 0.312
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10655": {
  "lines": 181,
  "orders": 180,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10285": {
  "lines": 88,
  "orders": 87,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10243": {
  "lines": 6165,
  "orders": 5392,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10260",
    "attach": 0.033,
    "lift": 1.39
   },
   {
    "itemId": "p-10205",
    "attach": 0.023,
    "lift": 1.44
   }
  ]
 },
 "p-10369": {
  "lines": 1085,
  "orders": 1063,
  "sizes": [
   {
    "name": "Medium",
    "share": 0.355
   },
   {
    "name": "Small",
    "share": 0.276
   }
  ],
  "choices": [
   {
    "optionId": "o-7948",
    "share": 0.035
   },
   {
    "optionId": "o-11022",
    "share": 0.023
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-10792",
    "share": 0.11
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10356",
    "attach": 0.04,
    "lift": 2.51
   },
   {
    "itemId": "p-10260",
    "attach": 0.031,
    "lift": 1.31
   }
  ]
 },
 "p-10195": {
  "lines": 884,
  "orders": 880,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.095,
    "lift": 3.43
   },
   {
    "itemId": "p-12059",
    "attach": 0.04,
    "lift": 2.92
   },
   {
    "itemId": "p-10379",
    "attach": 0.036,
    "lift": 2.06
   }
  ]
 },
 "p-10774": {
  "lines": 201,
  "orders": 201,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10202": {
  "lines": 557,
  "orders": 555,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10338",
    "attach": 0.054,
    "lift": 1.1
   }
  ]
 },
 "p-10150": {
  "lines": 609,
  "orders": 594,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-9697",
    "share": 0.036
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10334",
    "attach": 0.133,
    "lift": 2.15
   },
   {
    "itemId": "p-10384",
    "attach": 0.044,
    "lift": 1.57
   },
   {
    "itemId": "p-10353",
    "attach": 0.082,
    "lift": 1.22
   }
  ]
 },
 "p-10156": {
  "lines": 276,
  "orders": 272,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10210": {
  "lines": 1025,
  "orders": 1011,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-10238",
    "share": 0.11
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.045,
    "lift": 1.6
   },
   {
    "itemId": "p-12059",
    "attach": 0.027,
    "lift": 1.96
   },
   {
    "itemId": "p-10163",
    "attach": 0.026,
    "lift": 1.76
   }
  ]
 },
 "p-10361": {
  "lines": 36,
  "orders": 35,
  "sizes": [
   {
    "name": "Small",
    "share": 0.667
   },
   {
    "name": "Medium",
    "share": 0.306
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10213": {
  "lines": 1801,
  "orders": 1794,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-10274",
    "share": 0.024
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.046,
    "lift": 1.64
   },
   {
    "itemId": "p-10163",
    "attach": 0.02,
    "lift": 1.37
   }
  ]
 },
 "p-12059": {
  "lines": 1849,
  "orders": 1831,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10300",
    "attach": 0.035,
    "lift": 2.61
   },
   {
    "itemId": "p-10260",
    "attach": 0.042,
    "lift": 1.76
   },
   {
    "itemId": "p-10152",
    "attach": 0.022,
    "lift": 2.5
   }
  ]
 },
 "p-10228": {
  "lines": 518,
  "orders": 515,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10338",
    "attach": 0.083,
    "lift": 1.7
   },
   {
    "itemId": "p-10334",
    "attach": 0.085,
    "lift": 1.38
   }
  ]
 },
 "p-10260": {
  "lines": 3205,
  "orders": 3171,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10357",
    "attach": 0.113,
    "lift": 1.31
   },
   {
    "itemId": "p-10243",
    "attach": 0.056,
    "lift": 1.39
   },
   {
    "itemId": "p-12059",
    "attach": 0.024,
    "lift": 1.76
   }
  ]
 },
 "p-10316": {
  "lines": 415,
  "orders": 406,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-2445",
    "share": 0.222
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10379",
    "attach": 0.084,
    "lift": 4.74
   },
   {
    "itemId": "p-10337",
    "attach": 0.074,
    "lift": 2.59
   },
   {
    "itemId": "p-10344",
    "attach": 0.084,
    "lift": 1.25
   }
  ]
 },
 "p-10257": {
  "lines": 417,
  "orders": 415,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10338",
    "attach": 0.108,
    "lift": 2.21
   },
   {
    "itemId": "p-10344",
    "attach": 0.123,
    "lift": 1.83
   },
   {
    "itemId": "p-10334",
    "attach": 0.082,
    "lift": 1.32
   }
  ]
 },
 "p-10331": {
  "lines": 214,
  "orders": 210,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-9235",
    "share": 0.57
   },
   {
    "optionId": "o-9244",
    "share": 0.126
   },
   {
    "optionId": "o-9237",
    "share": 0.103
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10167": {
  "lines": 410,
  "orders": 406,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.071,
    "lift": 2.57
   },
   {
    "itemId": "p-10353",
    "attach": 0.111,
    "lift": 1.64
   },
   {
    "itemId": "p-10334",
    "attach": 0.089,
    "lift": 1.43
   }
  ]
 },
 "p-10247": {
  "lines": 1034,
  "orders": 1029,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10761",
    "attach": 0.026,
    "lift": 1.92
   }
  ]
 },
 "p-10215": {
  "lines": 604,
  "orders": 603,
  "sizes": [],
  "choices": [],
  "modifiers": [
   {
    "modifierId": "m-10835",
    "share": 0.04
   }
  ],
  "crossSell": []
 },
 "p-11591": {
  "lines": 354,
  "orders": 350,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10273": {
  "lines": 486,
  "orders": 484,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10338",
    "attach": 0.064,
    "lift": 1.3
   }
  ]
 },
 "p-10234": {
  "lines": 333,
  "orders": 333,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11774": {
  "lines": 271,
  "orders": 271,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.096,
    "lift": 3.45
   }
  ]
 },
 "p-10394": {
  "lines": 1229,
  "orders": 1210,
  "sizes": [
   {
    "name": "Small",
    "share": 0.508
   },
   {
    "name": "Medium",
    "share": 0.404
   }
  ],
  "choices": [
   {
    "optionId": "o-11192",
    "share": 0.119
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-11983",
    "attach": 0.08,
    "lift": 53.83
   },
   {
    "itemId": "p-10230",
    "attach": 0.022,
    "lift": 2.86
   },
   {
    "itemId": "p-10243",
    "attach": 0.057,
    "lift": 1.42
   }
  ]
 },
 "p-10239": {
  "lines": 732,
  "orders": 725,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10337",
    "attach": 0.051,
    "lift": 1.79
   },
   {
    "itemId": "p-10344",
    "attach": 0.084,
    "lift": 1.26
   },
   {
    "itemId": "p-10357",
    "attach": 0.101,
    "lift": 1.18
   }
  ]
 },
 "p-11834": {
  "lines": 820,
  "orders": 811,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10337",
    "attach": 0.06,
    "lift": 2.12
   },
   {
    "itemId": "p-10338",
    "attach": 0.079,
    "lift": 1.61
   },
   {
    "itemId": "p-10333",
    "attach": 0.047,
    "lift": 1.8
   }
  ]
 },
 "p-10229": {
  "lines": 1014,
  "orders": 1012,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10761",
    "attach": 0.029,
    "lift": 2.1
   },
   {
    "itemId": "p-10344",
    "attach": 0.085,
    "lift": 1.27
   },
   {
    "itemId": "p-10337",
    "attach": 0.043,
    "lift": 1.52
   }
  ]
 },
 "p-11590": {
  "lines": 179,
  "orders": 176,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10653": {
  "lines": 332,
  "orders": 332,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10230": {
  "lines": 1050,
  "orders": 1048,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10394",
    "attach": 0.026,
    "lift": 2.86
   },
   {
    "itemId": "p-10761",
    "attach": 0.027,
    "lift": 1.96
   },
   {
    "itemId": "p-10356",
    "attach": 0.026,
    "lift": 1.64
   }
  ]
 },
 "p-10251": {
  "lines": 1381,
  "orders": 1378,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10337",
    "attach": 0.069,
    "lift": 2.42
   },
   {
    "itemId": "p-10351",
    "attach": 0.04,
    "lift": 1.33
   },
   {
    "itemId": "p-10379",
    "attach": 0.025,
    "lift": 1.44
   }
  ]
 },
 "p-10320": {
  "lines": 356,
  "orders": 350,
  "sizes": [
   {
    "name": "White . Medium",
    "share": 0.402
   },
   {
    "name": "brown . Medium",
    "share": 0.183
   },
   {
    "name": "White . Large",
    "share": 0.143
   }
  ],
  "choices": [
   {
    "optionId": "o-10898",
    "share": 0.053
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10263": {
  "lines": 525,
  "orders": 523,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10243",
    "attach": 0.061,
    "lift": 1.52
   },
   {
    "itemId": "p-10338",
    "attach": 0.063,
    "lift": 1.28
   }
  ]
 },
 "p-10267": {
  "lines": 516,
  "orders": 514,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10334",
    "attach": 0.107,
    "lift": 1.73
   },
   {
    "itemId": "p-10338",
    "attach": 0.08,
    "lift": 1.62
   },
   {
    "itemId": "p-10344",
    "attach": 0.086,
    "lift": 1.28
   }
  ]
 },
 "p-10323": {
  "lines": 499,
  "orders": 497,
  "sizes": [
   {
    "name": "White . Medium",
    "share": 0.591
   },
   {
    "name": "White . Large",
    "share": 0.142
   },
   {
    "name": "brown . Medium",
    "share": 0.11
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10324": {
  "lines": 517,
  "orders": 513,
  "sizes": [
   {
    "name": "White . Medium",
    "share": 0.571
   },
   {
    "name": "White . Large",
    "share": 0.126
   },
   {
    "name": "brown . Medium",
    "share": 0.097
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.057,
    "lift": 2.03
   }
  ]
 },
 "p-10332": {
  "lines": 434,
  "orders": 430,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-9223",
    "share": 0.594
   },
   {
    "optionId": "o-9225",
    "share": 0.191
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10237": {
  "lines": 531,
  "orders": 530,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10365",
    "attach": 0.047,
    "lift": 1.17
   }
  ]
 },
 "p-11370": {
  "lines": 109,
  "orders": 107,
  "sizes": [
   {
    "name": "Medium",
    "share": 0.312
   },
   {
    "name": "Small",
    "share": 0.257
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11921": {
  "lines": 317,
  "orders": 317,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10338",
    "attach": 0.085,
    "lift": 1.73
   },
   {
    "itemId": "p-10352",
    "attach": 0.098,
    "lift": 1.19
   }
  ]
 },
 "p-10279": {
  "lines": 206,
  "orders": 204,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10783": {
  "lines": 398,
  "orders": 398,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.078,
    "lift": 2.8
   }
  ]
 },
 "p-10400": {
  "lines": 57,
  "orders": 53,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11798": {
  "lines": 293,
  "orders": 293,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10252": {
  "lines": 1412,
  "orders": 1408,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-10553",
    "share": 0.025
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10337",
    "attach": 0.038,
    "lift": 1.34
   },
   {
    "itemId": "p-10344",
    "attach": 0.077,
    "lift": 1.14
   },
   {
    "itemId": "p-10356",
    "attach": 0.021,
    "lift": 1.31
   }
  ]
 },
 "p-11775": {
  "lines": 388,
  "orders": 388,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10299": {
  "lines": 405,
  "orders": 405,
  "sizes": [
   {
    "name": "(10-12) poeple",
    "share": 0.519
   },
   {
    "name": "(6-8) people",
    "share": 0.01
   },
   {
    "name": "25 (تواصي)",
    "share": 0.005
   },
   {
    "name": "(6-8) people تواصي",
    "share": 0.002
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10373": {
  "lines": 518,
  "orders": 517,
  "sizes": [
   {
    "name": "Small",
    "share": 0.556
   },
   {
    "name": "Medium",
    "share": 0.376
   }
  ],
  "choices": [],
  "modifiers": [
   {
    "modifierId": "m-10792",
    "share": 0.129
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10365",
    "attach": 0.07,
    "lift": 1.73
   },
   {
    "itemId": "p-10384",
    "attach": 0.052,
    "lift": 1.88
   }
  ]
 },
 "p-10307": {
  "lines": 444,
  "orders": 444,
  "sizes": [
   {
    "name": "(6-8) people",
    "share": 0.363
   },
   {
    "name": "(10-12) poeple",
    "share": 0.282
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10209": {
  "lines": 386,
  "orders": 384,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-10220",
    "share": 0.122
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10368": {
  "lines": 536,
  "orders": 528,
  "sizes": [
   {
    "name": "Medium",
    "share": 0.453
   },
   {
    "name": "Small",
    "share": 0.371
   }
  ],
  "choices": [
   {
    "optionId": "o-2999",
    "share": 0.034
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-10792",
    "share": 0.073
   }
  ],
  "crossSell": [
   {
    "itemId": "p-10357",
    "attach": 0.1,
    "lift": 1.17
   }
  ]
 },
 "p-10164": {
  "lines": 1587,
  "orders": 1537,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-9870",
    "share": 0.039
   },
   {
    "optionId": "o-9859",
    "share": 0.035
   }
  ],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10334",
    "attach": 0.166,
    "lift": 2.68
   },
   {
    "itemId": "p-10353",
    "attach": 0.129,
    "lift": 1.9
   },
   {
    "itemId": "p-10384",
    "attach": 0.04,
    "lift": 1.45
   }
  ]
 },
 "p-11933": {
  "lines": 603,
  "orders": 603,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10337",
    "attach": 0.056,
    "lift": 1.98
   },
   {
    "itemId": "p-10344",
    "attach": 0.086,
    "lift": 1.29
   }
  ]
 },
 "p-10301": {
  "lines": 430,
  "orders": 430,
  "sizes": [
   {
    "name": "(6-8) people",
    "share": 0.381
   },
   {
    "name": "(10-12) poeple",
    "share": 0.314
   },
   {
    "name": "20 (تواصي)",
    "share": 0.002
   },
   {
    "name": "15 (تواصي)",
    "share": 0.002
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10256": {
  "lines": 1162,
  "orders": 1156,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-10435",
    "share": 0.033
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10791": {
  "lines": 442,
  "orders": 442,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10163",
    "attach": 0.109,
    "lift": 7.43
   },
   {
    "itemId": "p-10149",
    "attach": 0.075,
    "lift": 13.19
   },
   {
    "itemId": "p-12059",
    "attach": 0.084,
    "lift": 6.14
   }
  ]
 },
 "p-10148": {
  "lines": 373,
  "orders": 362,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10162",
    "attach": 0.075,
    "lift": 6.39
   },
   {
    "itemId": "p-10352",
    "attach": 0.124,
    "lift": 1.52
   },
   {
    "itemId": "p-10243",
    "attach": 0.075,
    "lift": 1.86
   }
  ]
 },
 "p-10180": {
  "lines": 60,
  "orders": 60,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10175": {
  "lines": 204,
  "orders": 203,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10233": {
  "lines": 386,
  "orders": 384,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10357",
    "attach": 0.109,
    "lift": 1.28
   }
  ]
 },
 "p-10240": {
  "lines": 655,
  "orders": 653,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10337",
    "attach": 0.038,
    "lift": 1.34
   },
   {
    "itemId": "p-10338",
    "attach": 0.055,
    "lift": 1.12
   }
  ]
 },
 "p-10321": {
  "lines": 228,
  "orders": 228,
  "sizes": [
   {
    "name": "White . Medium",
    "share": 0.443
   },
   {
    "name": "White . Large",
    "share": 0.25
   },
   {
    "name": "brown . Medium",
    "share": 0.154
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10389": {
  "lines": 306,
  "orders": 303,
  "sizes": [
   {
    "name": "Medium",
    "share": 0.441
   },
   {
    "name": "Small",
    "share": 0.428
   }
  ],
  "choices": [
   {
    "optionId": "o-11190",
    "share": 0.085
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10219": {
  "lines": 921,
  "orders": 915,
  "sizes": [],
  "choices": [],
  "modifiers": [
   {
    "modifierId": "m-10835",
    "share": 0.022
   }
  ],
  "crossSell": []
 },
 "p-5123": {
  "lines": 114,
  "orders": 114,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10194": {
  "lines": 56,
  "orders": 55,
  "sizes": [],
  "choices": [],
  "modifiers": [
   {
    "modifierId": "m-10596",
    "share": 0.339
   }
  ],
  "crossSell": []
 },
 "p-10330": {
  "lines": 294,
  "orders": 291,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-9260",
    "share": 0.378
   }
  ],
  "modifiers": [
   {
    "modifierId": "m-10603",
    "share": 0.058
   }
  ],
  "crossSell": []
 },
 "p-10172": {
  "lines": 156,
  "orders": 153,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10238": {
  "lines": 882,
  "orders": 876,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10337",
    "attach": 0.055,
    "lift": 1.92
   },
   {
    "itemId": "p-10344",
    "attach": 0.084,
    "lift": 1.26
   },
   {
    "itemId": "p-10334",
    "attach": 0.073,
    "lift": 1.18
   }
  ]
 },
 "p-10648": {
  "lines": 235,
  "orders": 235,
  "sizes": [
   {
    "name": "(6-8) people",
    "share": 0.413
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10303": {
  "lines": 1019,
  "orders": 1019,
  "sizes": [
   {
    "name": "(6-8) people",
    "share": 0.331
   },
   {
    "name": "(10-12) poeple",
    "share": 0.313
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-12059",
    "attach": 0.027,
    "lift": 2.02
   }
  ]
 },
 "p-10181": {
  "lines": 119,
  "orders": 118,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10288": {
  "lines": 660,
  "orders": 655,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10243",
    "attach": 0.053,
    "lift": 1.33
   }
  ]
 },
 "p-10402": {
  "lines": 179,
  "orders": 177,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11380": {
  "lines": 214,
  "orders": 212,
  "sizes": [
   {
    "name": "White . Medium",
    "share": 0.388
   },
   {
    "name": "White . Large",
    "share": 0.196
   },
   {
    "name": "brown . Medium",
    "share": 0.187
   }
  ],
  "choices": [
   {
    "optionId": "o-8959",
    "share": 0.168
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10203": {
  "lines": 389,
  "orders": 388,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10213",
    "attach": 0.064,
    "lift": 4.82
   }
  ]
 },
 "p-11776": {
  "lines": 278,
  "orders": 278,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10344",
    "attach": 0.097,
    "lift": 1.45
   }
  ]
 },
 "p-10282": {
  "lines": 208,
  "orders": 206,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10270": {
  "lines": 460,
  "orders": 457,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10177": {
  "lines": 176,
  "orders": 176,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10334",
    "attach": 0.165,
    "lift": 2.66
   }
  ]
 },
 "p-11379": {
  "lines": 272,
  "orders": 271,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-8293",
    "share": 0.346
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10304": {
  "lines": 828,
  "orders": 828,
  "sizes": [
   {
    "name": "(10-12) poeple",
    "share": 0.575
   },
   {
    "name": "(6-8) people",
    "share": 0.016
   },
   {
    "name": "25 (تواصي)",
    "share": 0.001
   },
   {
    "name": "15 (تواصي)",
    "share": 0.001
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-12059",
    "attach": 0.04,
    "lift": 2.92
   }
  ]
 },
 "p-10192": {
  "lines": 99,
  "orders": 97,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10158": {
  "lines": 187,
  "orders": 140,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10391": {
  "lines": 514,
  "orders": 507,
  "sizes": [
   {
    "name": "Medium",
    "share": 0.457
   },
   {
    "name": "Small",
    "share": 0.374
   }
  ],
  "choices": [
   {
    "optionId": "o-11188",
    "share": 0.103
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-11983": {
  "lines": 200,
  "orders": 200,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10394",
    "attach": 0.485,
    "lift": 53.83
   },
   {
    "itemId": "p-10357",
    "attach": 0.125,
    "lift": 1.46
   }
  ]
 },
 "p-10654": {
  "lines": 449,
  "orders": 449,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10337",
    "attach": 0.069,
    "lift": 2.42
   },
   {
    "itemId": "p-10351",
    "attach": 0.067,
    "lift": 2.23
   },
   {
    "itemId": "p-10365",
    "attach": 0.058,
    "lift": 1.44
   }
  ]
 },
 "p-10392": {
  "lines": 117,
  "orders": 116,
  "sizes": [
   {
    "name": "Small",
    "share": 0.333
   },
   {
    "name": "Medium",
    "share": 0.274
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11991": {
  "lines": 207,
  "orders": 207,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10352",
    "attach": 0.159,
    "lift": 1.94
   }
  ]
 },
 "p-10264": {
  "lines": 24,
  "orders": 24,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10154": {
  "lines": 112,
  "orders": 112,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10274": {
  "lines": 267,
  "orders": 262,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10836": {
  "lines": 446,
  "orders": 432,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10300",
    "attach": 0.116,
    "lift": 8.49
   },
   {
    "itemId": "p-10303",
    "attach": 0.065,
    "lift": 8.54
   }
  ]
 },
 "p-11761": {
  "lines": 506,
  "orders": 506,
  "sizes": [
   {
    "name": "(6-8) people",
    "share": 0.431
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10842": {
  "lines": 14,
  "orders": 14,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10372": {
  "lines": 287,
  "orders": 280,
  "sizes": [
   {
    "name": "Small",
    "share": 0.526
   },
   {
    "name": "Medium",
    "share": 0.345
   }
  ],
  "choices": [],
  "modifiers": [
   {
    "modifierId": "m-10792",
    "share": 0.143
   }
  ],
  "crossSell": []
 },
 "p-10650": {
  "lines": 376,
  "orders": 374,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10344",
    "attach": 0.078,
    "lift": 1.16
   }
  ]
 },
 "p-10380": {
  "lines": 461,
  "orders": 454,
  "sizes": [
   {
    "name": "Small",
    "share": 0.577
   },
   {
    "name": "Medium",
    "share": 0.33
   }
  ],
  "choices": [
   {
    "optionId": "o-7689",
    "share": 0.134
   },
   {
    "optionId": "o-7688",
    "share": 0.05
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10254": {
  "lines": 223,
  "orders": 223,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11363": {
  "lines": 107,
  "orders": 107,
  "sizes": [
   {
    "name": "Small",
    "share": 0.346
   },
   {
    "name": "Medium",
    "share": 0.308
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10309": {
  "lines": 522,
  "orders": 522,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10265": {
  "lines": 552,
  "orders": 550,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10338",
    "attach": 0.075,
    "lift": 1.52
   },
   {
    "itemId": "p-10351",
    "attach": 0.049,
    "lift": 1.64
   },
   {
    "itemId": "p-10334",
    "attach": 0.082,
    "lift": 1.32
   }
  ]
 },
 "p-10649": {
  "lines": 341,
  "orders": 340,
  "sizes": [
   {
    "name": "(6-8) people",
    "share": 0.446
   },
   {
    "name": "(10-12) poeple",
    "share": 0.199
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11924": {
  "lines": 107,
  "orders": 106,
  "sizes": [
   {
    "name": "Medium",
    "share": 0.327
   },
   {
    "name": "Small",
    "share": 0.318
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10327": {
  "lines": 81,
  "orders": 80,
  "sizes": [
   {
    "name": "White . Medium",
    "share": 0.469
   },
   {
    "name": "brown . Medium",
    "share": 0.21
   },
   {
    "name": "White . Large",
    "share": 0.012
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10393": {
  "lines": 143,
  "orders": 140,
  "sizes": [
   {
    "name": "Medium",
    "share": 0.441
   },
   {
    "name": "Small",
    "share": 0.413
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11355": {
  "lines": 5,
  "orders": 5,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12058": {
  "lines": 93,
  "orders": 93,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10308": {
  "lines": 69,
  "orders": 69,
  "sizes": [
   {
    "name": "(6-8) people",
    "share": 0.58
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10347": {
  "lines": 108,
  "orders": 108,
  "sizes": [
   {
    "name": "Small",
    "share": 0.593
   },
   {
    "name": "Medium",
    "share": 0.13
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10278": {
  "lines": 255,
  "orders": 254,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10284": {
  "lines": 305,
  "orders": 302,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10281": {
  "lines": 376,
  "orders": 374,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11431": {
  "lines": 39,
  "orders": 39,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10374": {
  "lines": 286,
  "orders": 285,
  "sizes": [
   {
    "name": "Small",
    "share": 0.462
   },
   {
    "name": "Medium",
    "share": 0.406
   }
  ],
  "choices": [],
  "modifiers": [
   {
    "modifierId": "m-10792",
    "share": 0.119
   }
  ],
  "crossSell": []
 },
 "p-11418": {
  "lines": 246,
  "orders": 245,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10352",
    "attach": 0.159,
    "lift": 1.94
   }
  ]
 },
 "p-10645": {
  "lines": 101,
  "orders": 101,
  "sizes": [
   {
    "name": "(6-8) people",
    "share": 0.515
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11357": {
  "lines": 7,
  "orders": 7,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11381": {
  "lines": 416,
  "orders": 414,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10344",
    "attach": 0.097,
    "lift": 1.44
   }
  ]
 },
 "p-10318": {
  "lines": 169,
  "orders": 169,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-2442",
    "share": 0.26
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10349": {
  "lines": 112,
  "orders": 112,
  "sizes": [
   {
    "name": "Short",
    "share": 0.786
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10326": {
  "lines": 354,
  "orders": 352,
  "sizes": [
   {
    "name": "White . Medium",
    "share": 0.517
   },
   {
    "name": "White . Large",
    "share": 0.198
   },
   {
    "name": "brown . Medium",
    "share": 0.099
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11927": {
  "lines": 12,
  "orders": 12,
  "sizes": [
   {
    "name": "Small",
    "share": 0.583
   },
   {
    "name": "Medium",
    "share": 0.25
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11995": {
  "lines": 91,
  "orders": 91,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10147": {
  "lines": 282,
  "orders": 281,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10352",
    "attach": 0.107,
    "lift": 1.3
   }
  ]
 },
 "p-11354": {
  "lines": 11,
  "orders": 11,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10837": {
  "lines": 414,
  "orders": 414,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10300",
    "attach": 0.08,
    "lift": 5.85
   },
   {
    "itemId": "p-10303",
    "attach": 0.06,
    "lift": 7.96
   }
  ]
 },
 "p-10390": {
  "lines": 120,
  "orders": 118,
  "sizes": [
   {
    "name": "Small",
    "share": 0.475
   },
   {
    "name": "Medium",
    "share": 0.433
   }
  ],
  "choices": [
   {
    "optionId": "o-11189",
    "share": 0.125
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-12057": {
  "lines": 121,
  "orders": 121,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10336": {
  "lines": 442,
  "orders": 434,
  "sizes": [
   {
    "name": "Small",
    "share": 0.305
   },
   {
    "name": "Medium",
    "share": 0.152
   }
  ],
  "choices": [
   {
    "optionId": "o-11087",
    "share": 0.24
   },
   {
    "optionId": "o-11088",
    "share": 0.109
   },
   {
    "optionId": "o-2539",
    "share": 0.075
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-11994": {
  "lines": 117,
  "orders": 117,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10343": {
  "lines": 582,
  "orders": 572,
  "sizes": [
   {
    "name": "Small",
    "share": 0.4
   },
   {
    "name": "Medium",
    "share": 0.314
   }
  ],
  "choices": [
   {
    "optionId": "o-2562",
    "share": 0.058
   },
   {
    "optionId": "o-11097",
    "share": 0.053
   },
   {
    "optionId": "o-11098",
    "share": 0.027
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10399": {
  "lines": 115,
  "orders": 115,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11993": {
  "lines": 106,
  "orders": 106,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10178": {
  "lines": 76,
  "orders": 76,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11372": {
  "lines": 11,
  "orders": 11,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11777": {
  "lines": 393,
  "orders": 393,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11992": {
  "lines": 223,
  "orders": 223,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10277": {
  "lines": 23,
  "orders": 23,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10182": {
  "lines": 224,
  "orders": 222,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10334",
    "attach": 0.122,
    "lift": 1.96
   }
  ]
 },
 "p-10322": {
  "lines": 125,
  "orders": 124,
  "sizes": [
   {
    "name": "White . Medium",
    "share": 0.504
   },
   {
    "name": "White . Large",
    "share": 0.2
   },
   {
    "name": "brown . Medium",
    "share": 0.16
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10328": {
  "lines": 90,
  "orders": 90,
  "sizes": [
   {
    "name": "White . Medium",
    "share": 0.522
   },
   {
    "name": "brown . Medium",
    "share": 0.178
   },
   {
    "name": "White . Large",
    "share": 0.122
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10312": {
  "lines": 177,
  "orders": 175,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-2446",
    "share": 0.333
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-5042": {
  "lines": 34,
  "orders": 32,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11996": {
  "lines": 91,
  "orders": 91,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11908": {
  "lines": 81,
  "orders": 81,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10354": {
  "lines": 16,
  "orders": 16,
  "sizes": [
   {
    "name": "Small",
    "share": 0.625
   },
   {
    "name": "Medium",
    "share": 0.313
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10549": {
  "lines": 48,
  "orders": 48,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11782": {
  "lines": 23,
  "orders": 23,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10839": {
  "lines": 110,
  "orders": 110,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10341": {
  "lines": 130,
  "orders": 129,
  "sizes": [
   {
    "name": "Short",
    "share": 0.815
   }
  ],
  "choices": [
   {
    "optionId": "o-11079",
    "share": 0.169
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10179": {
  "lines": 110,
  "orders": 109,
  "sizes": [],
  "choices": [
   {
    "optionId": "o-9355",
    "share": 0.373
   },
   {
    "optionId": "o-9363",
    "share": 0.345
   }
  ],
  "modifiers": [],
  "crossSell": []
 },
 "p-10173": {
  "lines": 77,
  "orders": 76,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10221": {
  "lines": 518,
  "orders": 516,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10338",
    "attach": 0.074,
    "lift": 1.5
   }
  ]
 },
 "p-10187": {
  "lines": 38,
  "orders": 37,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10340": {
  "lines": 29,
  "orders": 28,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10174": {
  "lines": 254,
  "orders": 252,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10334",
    "attach": 0.123,
    "lift": 1.99
   },
   {
    "itemId": "p-10352",
    "attach": 0.123,
    "lift": 1.5
   }
  ]
 },
 "p-10220": {
  "lines": 27,
  "orders": 27,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10153": {
  "lines": 127,
  "orders": 127,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10186": {
  "lines": 104,
  "orders": 104,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11371": {
  "lines": 60,
  "orders": 47,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-2694": {
  "lines": 260,
  "orders": 258,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10145": {
  "lines": 149,
  "orders": 149,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10185": {
  "lines": 52,
  "orders": 52,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10397": {
  "lines": 99,
  "orders": 94,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10350": {
  "lines": 40,
  "orders": 40,
  "sizes": [
   {
    "name": "Small",
    "share": 0.85
   },
   {
    "name": "Medium",
    "share": 0.05
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10146": {
  "lines": 101,
  "orders": 101,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10193": {
  "lines": 47,
  "orders": 46,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10191": {
  "lines": 21,
  "orders": 21,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10325": {
  "lines": 102,
  "orders": 102,
  "sizes": [
   {
    "name": "White . Medium",
    "share": 0.549
   },
   {
    "name": "brown . Medium",
    "share": 0.147
   },
   {
    "name": "White . Large",
    "share": 0.098
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10189": {
  "lines": 97,
  "orders": 95,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11768": {
  "lines": 5,
  "orders": 5,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11901": {
  "lines": 60,
  "orders": 56,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10403": {
  "lines": 188,
  "orders": 186,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12043": {
  "lines": 2,
  "orders": 2,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11360": {
  "lines": 5,
  "orders": 5,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10659": {
  "lines": 70,
  "orders": 70,
  "sizes": [
   {
    "name": "Small",
    "share": 0.371
   },
   {
    "name": "Medium",
    "share": 0.171
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10183": {
  "lines": 81,
  "orders": 80,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10430": {
  "lines": 2,
  "orders": 2,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10429": {
  "lines": 2,
  "orders": 2,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10444": {
  "lines": 3,
  "orders": 3,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10449": {
  "lines": 3,
  "orders": 3,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10446": {
  "lines": 3,
  "orders": 3,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10407": {
  "lines": 2,
  "orders": 2,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10419": {
  "lines": 2,
  "orders": 2,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10418": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10425": {
  "lines": 2,
  "orders": 2,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10405": {
  "lines": 20,
  "orders": 20,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11667": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10305": {
  "lines": 26,
  "orders": 26,
  "sizes": [
   {
    "name": "(10-12) poeple",
    "share": 0.615
   },
   {
    "name": "(6-8) people",
    "share": 0.308
   },
   {
    "name": "20 (تواصي)",
    "share": 0.038
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10190": {
  "lines": 18,
  "orders": 17,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10188": {
  "lines": 29,
  "orders": 29,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10550": {
  "lines": 4,
  "orders": 4,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11762": {
  "lines": 6,
  "orders": 6,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10310": {
  "lines": 15,
  "orders": 12,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10411": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10413": {
  "lines": 2,
  "orders": 2,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12044": {
  "lines": 3,
  "orders": 3,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10445": {
  "lines": 2,
  "orders": 2,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10447": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-3085": {
  "lines": 3,
  "orders": 3,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10435": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10434": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11577": {
  "lines": 3,
  "orders": 2,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12086": {
  "lines": 390,
  "orders": 390,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12083": {
  "lines": 265,
  "orders": 264,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12084": {
  "lines": 540,
  "orders": 536,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.073,
    "lift": 2.61
   },
   {
    "itemId": "p-10338",
    "attach": 0.073,
    "lift": 1.48
   }
  ]
 },
 "p-12085": {
  "lines": 374,
  "orders": 373,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": [
   {
    "itemId": "p-10384",
    "attach": 0.094,
    "lift": 3.37
   },
   {
    "itemId": "p-10338",
    "attach": 0.091,
    "lift": 1.86
   },
   {
    "itemId": "p-10344",
    "attach": 0.099,
    "lift": 1.48
   }
  ]
 },
 "p-12088": {
  "lines": 47,
  "orders": 47,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10680": {
  "lines": 2,
  "orders": 2,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10552": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12089": {
  "lines": 8,
  "orders": 8,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10553": {
  "lines": 2,
  "orders": 2,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10551": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10410": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10433": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10408": {
  "lines": 2,
  "orders": 2,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11614": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11585": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11358": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10416": {
  "lines": 3,
  "orders": 3,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10437": {
  "lines": 3,
  "orders": 3,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10436": {
  "lines": 3,
  "orders": 3,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12129": {
  "lines": 38,
  "orders": 38,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12150": {
  "lines": 56,
  "orders": 56,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12143": {
  "lines": 60,
  "orders": 60,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12157": {
  "lines": 44,
  "orders": 43,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12158": {
  "lines": 31,
  "orders": 31,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12154": {
  "lines": 36,
  "orders": 36,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12160": {
  "lines": 24,
  "orders": 24,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12138": {
  "lines": 46,
  "orders": 46,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12134": {
  "lines": 22,
  "orders": 22,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12131": {
  "lines": 27,
  "orders": 27,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12185": {
  "lines": 71,
  "orders": 70,
  "sizes": [
   {
    "name": "Small",
    "share": 0.761
   },
   {
    "name": "Medium",
    "share": 0.169
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12187": {
  "lines": 96,
  "orders": 95,
  "sizes": [
   {
    "name": "Small",
    "share": 0.552
   },
   {
    "name": "Medium",
    "share": 0.396
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12137": {
  "lines": 10,
  "orders": 10,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12184": {
  "lines": 91,
  "orders": 89,
  "sizes": [
   {
    "name": "Small",
    "share": 0.538
   },
   {
    "name": "Medium",
    "share": 0.385
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12182": {
  "lines": 42,
  "orders": 42,
  "sizes": [
   {
    "name": "Small",
    "share": 0.714
   },
   {
    "name": "Medium",
    "share": 0.238
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12188": {
  "lines": 111,
  "orders": 110,
  "sizes": [
   {
    "name": "Small",
    "share": 0.595
   },
   {
    "name": "Medium",
    "share": 0.324
   }
  ],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-12142": {
  "lines": 16,
  "orders": 16,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10409": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10414": {
  "lines": 3,
  "orders": 3,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10442": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11389": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10412": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-10421": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 },
 "p-11750": {
  "lines": 1,
  "orders": 1,
  "sizes": [],
  "choices": [],
  "modifiers": [],
  "crossSell": []
 }
};
