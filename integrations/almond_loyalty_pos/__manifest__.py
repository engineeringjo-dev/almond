# -*- coding: utf-8 -*-
{
    "name": "Almond Loyalty — POS connector",
    "version": "19.0.1.0.0",
    "summary": "Connect the POS tills to the Almond loyalty API: member QR, corporate discount, "
               "redemptions, points after payment (outbox + retry)",
    "description": """
Almond Loyalty — POS connector
==============================
Connects every Almond till (Odoo 19 Point of Sale) to the Almond loyalty API
(the BFF), server-to-server:

* «ألموند» button + barcode scanner: resolve the member's QR (single-use, 60 s)
  and attach the member to the order.
* Corporate members: their percentage off, no points.
* Redemptions: settle the member's code (QR or typed) and take its value off
  the bill as a payment line on a dedicated "Almond redemption" method.
* Points: earned SERVER-SIDE only after the order is paid, through an outbox
  with retry/backoff. A loyalty API failure never blocks or fails a sale.
* Refunds: reverse the original order's points.

The POS key lives in ir.config_parameter (system administrators only) and never
reaches the browser. See README.md for the flow, the settings and what is still
TODO.
""",
    "author": "Almond",
    "category": "Sales/Point of Sale",
    "depends": ["point_of_sale"],
    "data": [
        "security/ir.model.access.csv",
        "data/ir_cron.xml",
        "views/almond_loyalty_views.xml",
        "views/pos_order_views.xml",
        "views/pos_payment_method_views.xml",
        "views/res_config_settings_views.xml",
    ],
    "assets": {
        "point_of_sale._assets_pos": [
            "almond_loyalty_pos/static/src/app/**/*",
        ],
    },
    "external_dependencies": {"python": ["requests"]},
    "license": "LGPL-3",
    "installable": True,
    "application": False,
    "auto_install": False,
}
