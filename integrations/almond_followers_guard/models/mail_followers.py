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
        if not removed:
            # Owner decision: once a full day passes with nothing to clean,
            # prevention has proven itself and the janitor retires. Re-enable
            # the cron manually if a new leak path ever appears.
            cron = self.env.ref(
                "almond_followers_guard.ir_cron_gc_staff_followers",
                raise_if_not_found=False,
            )
            if cron and cron.active:
                cron.sudo().write({"active": False})
                _logger.info(
                    "followers guard janitor: zero rows found, cron self-disabled"
                )
        return removed
