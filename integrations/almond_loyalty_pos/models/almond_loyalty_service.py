# -*- coding: utf-8 -*-
"""
The ONE place Odoo reads the loyalty settings and builds the HTTP client.

Settings live in ``ir.config_parameter`` (server-side only; nothing here is
ever sent to the POS browser):

    almond_loyalty_pos.api_url               https://api.almond.jo   (BFF base URL)
    almond_loyalty_pos.pos_key               the x-pos-key secret    (write-only in the UI)
    almond_loyalty_pos.timeout               seconds, default 5
    almond_loyalty_pos.allow_insecure_http   '1' only for a dev mock on another host

The per-shop Almond ``branchId`` is on ``pos.config.almond_loyalty_branch_id``.
"""
from odoo import api, models

from .almond_loyalty_client import AlmondLoyaltyClient

PARAM_URL = "almond_loyalty_pos.api_url"
PARAM_KEY = "almond_loyalty_pos.pos_key"
PARAM_TIMEOUT = "almond_loyalty_pos.timeout"
PARAM_INSECURE = "almond_loyalty_pos.allow_insecure_http"
DEFAULT_TIMEOUT = 5.0


class AlmondLoyaltyService(models.AbstractModel):
    _name = "almond.loyalty.service"
    _description = "Almond loyalty API access (server only)"

    @api.model
    def _almond_loyalty_client(self, timeout=None):
        """Build a client from system parameters. Raises ConfigError (from the
        client module) when URL/key are missing — callers map it to a
        user-facing message or an outbox retry."""
        icp = self.env["ir.config_parameter"].sudo()
        try:
            cfg_timeout = float(icp.get_param(PARAM_TIMEOUT) or DEFAULT_TIMEOUT)
        except (TypeError, ValueError):
            cfg_timeout = DEFAULT_TIMEOUT
        return AlmondLoyaltyClient(
            base_url=icp.get_param(PARAM_URL) or "",
            pos_key=icp.get_param(PARAM_KEY) or "",
            timeout=timeout or cfg_timeout,
            allow_insecure_http=(icp.get_param(PARAM_INSECURE) or "").strip() in ("1", "True", "true"),
        )

    @api.model
    def _almond_loyalty_is_configured(self):
        icp = self.env["ir.config_parameter"].sudo()
        return bool(icp.get_param(PARAM_URL)) and bool(icp.get_param(PARAM_KEY))
