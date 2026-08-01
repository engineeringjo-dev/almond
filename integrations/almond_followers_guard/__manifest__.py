# -*- coding: utf-8 -*-
{
    "name": "Almond — POS/Loyalty Followers Guard",
    "version": "19.0.1.0.0",
    "summary": "Stop useless auto-follower rows on pos.order / loyalty.card + daily janitor",
    "description": """
Root-cause fix for the mail.followers explosion (900k+ rows, ~10-15k/day growth
during trading hours).

Odoo's mail.thread auto-subscribes the creating user as a follower of every new
record. Every POS order is created by a cashier user, so every order (and every
loyalty card created at the till) produced a permanent, useless follower row.
Nobody ever reads chatter notifications on a POS order.

This module does two things:

1. Prevention (the one-line root fix): injects ``mail_create_nosubscribe`` into
   the creation context of ``pos.order`` and ``loyalty.card`` so the creator is
   never auto-subscribed. Manual "Follow" in the chatter still works.

2. Janitor (belt and suspenders): a daily cron that deletes any residual
   follower rows held by *internal* users (share=False) on those two models —
   catches rows created by code paths that bypass create() context, and cleans
   whatever accumulated between the big cleanup and this module's install.
   Customer/portal followers are never touched.

Reference: production cleanup of 2026-07-19 removed 624,370 such rows from
master1 (full per-row backup retained). This module stops the regrowth.
""",
    "author": "Almond",
    "category": "Sales/Point of Sale",
    "depends": ["point_of_sale", "loyalty"],
    "data": [
        "data/ir_cron.xml",
    ],
    "license": "LGPL-3",
    "installable": True,
    "application": False,
    "auto_install": False,
}
