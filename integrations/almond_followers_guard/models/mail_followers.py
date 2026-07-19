# -*- coding: utf-8 -*-
import logging

from odoo import api, models

_logger = logging.getLogger(__name__)

GUARDED_MODELS = ["pos.order", "loyalty.card"]


class MailFollowers(models.Model):
    _inherit = "mail.followers"

    @api.model
    def _gc_staff_followers(self, batch=20000):
        """Daily janitor: drop follower rows held by internal staff on POS
        orders and loyalty cards. Prevention lives in the create() overrides;
        this catches code paths that subscribe outside create (imports,
        server-side integrations) and residue from before install.
        Customer/portal partners (share=True users, or no user) are untouched.
        """
        staff_partners = (
            self.env["res.users"]
            .with_context(active_test=False)
            .search([("share", "=", False)])
            .partner_id
        )
        removed = 0
        while True:
            rows = self.sudo().search(
                [
                    ("partner_id", "in", staff_partners.ids),
                    ("res_model", "in", GUARDED_MODELS),
                ],
                limit=batch,
            )
            if not rows:
                break
            count = len(rows)
            rows.unlink()
            removed += count
            self.env.cr.commit()
            if count < batch:
                break
        _logger.info(
            "followers guard janitor: removed %s staff follower rows on %s",
            removed,
            GUARDED_MODELS,
        )
        return removed
