# -*- coding: utf-8 -*-
{
    "name": "POS MEPS (Apex ECR) Payment Terminal",
    "version": "19.0.1.0.0",
    "summary": "Card-present Visa/Mastercard via MEPS SmartPOS (Apex ECR) — cloud, semi-integrated",
    "description": """
Integrates MEPS SmartPOS terminals (Apex SmartPOS app, package com.apex.smartpos_meps)
with Odoo 19 Point of Sale over the ApexECR CLOUD channel.

Flow: cashier picks the 'Visa (MEPS)' payment method -> Odoo backend signs a SALE
request with the branch SecureKey and POSTs it to the Apex cloud gateway -> the
gateway pushes the amount to the online terminal (identified by TID) -> customer
taps the card -> the approval (auth code / RRN / masked PAN) returns to Odoo and
is stored on the pos.payment.

Card data (PAN) never touches Odoo -> Odoo stays OUT of PCI-DSS scope.
Timestamps are Asia/Amman (+03:00). SecureKey is server-only (ir.config_parameter).
""",
    "author": "Almond",
    "category": "Sales/Point of Sale",
    "depends": ["point_of_sale"],
    "data": [
        "data/ir_config_parameter.xml",
        "views/pos_payment_method_views.xml",
    ],
    "assets": {
        "point_of_sale._assets_pos": [
            "pos_meps_apex/static/src/app/payment_meps.js",
        ],
    },
    "license": "LGPL-3",
    "installable": True,
}
