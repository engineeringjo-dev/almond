# -*- coding: utf-8 -*-
"""
Settings -> Point of Sale -> «Almond Loyalty».

Global (system administrators only):
  * API URL, timeout  -> ir.config_parameter via ``config_parameter=``.
  * POS key           -> WRITE-ONLY. It is NOT a ``config_parameter`` field,
    so ``get_values`` never loads it and the settings form never sends it to
    any browser. Typing a new value and saving replaces it; the form only shows
    whether one is set.

Per shop (the selected ``pos_config_id``, like every other POS setting):
  * enable the till button, Almond branch id.
"""
from odoo import _, api, fields, models
from odoo.exceptions import AccessError

from .almond_loyalty_service import PARAM_KEY, PARAM_TIMEOUT, PARAM_URL


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    almond_loyalty_api_url = fields.Char("Almond API URL", config_parameter=PARAM_URL)
    almond_loyalty_timeout = fields.Float("Almond API timeout (s)", config_parameter=PARAM_TIMEOUT, default=5.0)
    almond_loyalty_pos_key_new = fields.Char(
        "New POS key", help="Type the x-pos-key issued by the Almond API to replace the stored one. "
                            "Leave empty to keep the current key.",
    )
    almond_loyalty_pos_key_is_set = fields.Boolean(compute="_compute_almond_loyalty_pos_key_is_set")

    # ``pos_`` prefix: written to the selected pos_config_id by the POS settings.
    pos_almond_loyalty_enabled = fields.Boolean(related="pos_config_id.almond_loyalty_enabled", readonly=False)
    pos_almond_loyalty_branch_id = fields.Char(related="pos_config_id.almond_loyalty_branch_id", readonly=False)

    @api.depends("company_id")
    def _compute_almond_loyalty_pos_key_is_set(self):
        is_set = bool(self.env["ir.config_parameter"].sudo().get_param(PARAM_KEY))
        for rec in self:
            rec.almond_loyalty_pos_key_is_set = is_set

    def set_values(self):
        super().set_values()
        new_key = (self.almond_loyalty_pos_key_new or "").strip()
        if new_key:
            if not self.env.user.has_group("base.group_system"):
                raise AccessError(_("Only system administrators can change the Almond POS key."))
            self.env["ir.config_parameter"].sudo().set_param(PARAM_KEY, new_key)
            # Do not leave a copy in the transient res_config_settings row.
            self.almond_loyalty_pos_key_new = False

    def action_almond_loyalty_clear_key(self):
        if not self.env.user.has_group("base.group_system"):
            raise AccessError(_("Only system administrators can change the Almond POS key."))
        self.env["ir.config_parameter"].sudo().set_param(PARAM_KEY, False)
        return {"type": "ir.actions.client", "tag": "reload"}
