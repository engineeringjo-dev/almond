# -*- coding: utf-8 -*-
"""
Outbox for the loyalty calls that happen AFTER a sale: earn and reverse.

Owner rule: points only after payment is confirmed, and a loyalty API failure
must NEVER block or fail a sale. So the sale transaction only INSERTS a row
here (no network), and ``ir_cron_almond_loyalty_outbox`` sends it, retrying
with backoff (``almond_loyalty_policy.backoff_seconds``). The BFF is idempotent
on ``posOrderRef``, so a retry after a lost response is safe.

* 409 (same ref, different member/amount) -> ``failed``, never retried.
* 400 / 404                               -> ``failed`` (same body is refused again).
* timeout / 5xx / 429 / 401 / config gap  -> retried with backoff, up to
  ``DEFAULT_MAX_ATTEMPTS``, then ``failed``.
* a ``reverse`` waits for its ``earn`` to be ``done``; if that earn failed or
  was cancelled there is nothing to reverse and the reverse is cancelled.

A failed row is never deleted: "Retry now" puts it back in the queue.
"""
import json
import logging
from datetime import timedelta

from odoo import _, api, fields, models

from . import almond_loyalty_policy as policy
from .almond_loyalty_client import AlmondLoyaltyError, ConfigError

_logger = logging.getLogger(__name__)

CRON_XMLID = "almond_loyalty_pos.ir_cron_almond_loyalty_outbox"


class AlmondLoyaltyOutbox(models.Model):
    _name = "almond.loyalty.outbox"
    _description = "Almond loyalty outbox (earn / reverse)"
    _order = "id"

    kind = fields.Selection([("earn", "Earn"), ("reverse", "Reverse")], required=True, readonly=True, index=True)
    state = fields.Selection(
        [("pending", "Pending"), ("done", "Done"), ("failed", "Failed"), ("cancelled", "Cancelled")],
        default="pending", required=True, index=True, readonly=True,
    )
    pos_order_ref = fields.Char("POS order ref", required=True, index=True, readonly=True,
                                help="posOrderRef sent to the API (the ORIGINAL order's name for a reverse).")
    pos_order_id = fields.Many2one("pos.order", readonly=True, index="btree_not_null", ondelete="set null",
                                   help="Order that earned (earn) or the refund order (reverse).")
    origin_order_id = fields.Many2one("pos.order", readonly=True, ondelete="set null",
                                      help="For a reverse: the original order whose points are reversed.")
    # Holds the earn ticket (a bearer value for the member): system only.
    payload = fields.Text(readonly=True, groups="base.group_system")
    attempts = fields.Integer(readonly=True, default=0)
    next_try = fields.Datetime(readonly=True, default=fields.Datetime.now, index=True)
    last_error = fields.Char(readonly=True)
    response = fields.Text(readonly=True)
    done_at = fields.Datetime(readonly=True)

    # One earn and at most one reverse per order ref: the queue itself can
    # never double-send, whatever happens to the sale transaction.
    _uniq_kind_ref = models.Constraint(
        "UNIQUE(kind, pos_order_ref)",
        "An Almond loyalty call of this kind already exists for this order.",
    )

    # ------------------------------------------------------------ enqueue
    @api.model
    def _almond_enqueue(self, kind, pos_order_ref, payload, pos_order=None, origin_order=None, state="pending",
                        last_error=False):
        """Insert one row (idempotent on (kind, ref)). Called inside the sale
        transaction, sudo — no network here."""
        Outbox = self.sudo()
        existing = Outbox.search([("kind", "=", kind), ("pos_order_ref", "=", pos_order_ref)], limit=1)
        if existing:
            return existing
        row = Outbox.create({
            "kind": kind,
            "pos_order_ref": pos_order_ref,
            "payload": json.dumps(payload),
            "pos_order_id": pos_order.id if pos_order else False,
            "origin_order_id": origin_order.id if origin_order else False,
            "state": state,
            "last_error": last_error,
        })
        if state == "pending":
            self._almond_trigger_cron()
        return row

    @api.model
    def _almond_trigger_cron(self):
        """Ask the cron to run soon (near-real-time earn) instead of waiting
        for its interval. Best effort: never let it break the caller."""
        try:
            cron = self.env.ref(CRON_XMLID, raise_if_not_found=False)
            if cron:
                cron.sudo()._trigger()
        except Exception:  # noqa: BLE001 — a trigger failure must not fail a sale
            _logger.warning("Almond loyalty: could not trigger the outbox cron", exc_info=True)

    # ------------------------------------------------------------ actions
    def action_retry_now(self):
        """Back office button: put failed/pending rows back at the front."""
        # No sudo: the ACL (system group writes, POS managers read) decides.
        rows = self.filtered(lambda r: r.state in ("pending", "failed"))
        rows.write({"state": "pending", "next_try": fields.Datetime.now(), "attempts": 0})
        self._almond_trigger_cron()
        return True

    def action_cancel(self):
        self.filtered(lambda r: r.state in ("pending", "failed")).write({"state": "cancelled"})
        return True

    # ------------------------------------------------------------ cron
    @api.model
    def _cron_process_outbox(self, limit=100):
        """Send due rows, oldest first. Commits after each row (via
        ``ir.cron._commit_progress``) so one slow/failing call never rolls
        back the others, and a timeout of the cron job itself loses nothing."""
        rows = self.sudo().search(
            [("state", "=", "pending"), ("next_try", "<=", fields.Datetime.now())],
            limit=limit, order="id",
        )
        IrCron = self.env["ir.cron"]
        IrCron._commit_progress(remaining=len(rows))
        client = None
        for row in rows:
            try:
                if client is None:
                    client = self.env["almond.loyalty.service"]._almond_loyalty_client()
                # Savepoint: a failure after the HTTP call rolls back our partial
                # writes; the retry is then an idempotent replay at the BFF.
                with self.env.cr.savepoint():
                    row._almond_process_one(client)
            except ConfigError as exc:
                row._almond_mark_error(exc)
            except Exception as exc:  # noqa: BLE001 — never let one row kill the batch
                _logger.exception("Almond loyalty outbox #%s: unexpected error", row.id)
                row._almond_mark_error(exc)
            if not IrCron._commit_progress(1):
                break  # cron time budget spent; the rest waits for the next run

    def _almond_process_one(self, client):
        self.ensure_one()
        payload = json.loads(self.payload or "{}")
        if self.kind == "earn":
            res = client.earn(
                earn_ticket=payload.get("earnTicket"),
                pos_order_ref=self.pos_order_ref,
                # Read at send time as a fallback, so fixing a missing branch id on
                # the shop and pressing "Retry now" is enough.
                branch_id=payload.get("branchId") or (self.pos_order_id.config_id.almond_loyalty_branch_id or None),
                paid_total=payload.get("paidTotal", 0.0),
                paid_at=payload.get("paidAt"),
            )
            self._almond_mark_done({"pointsEarned": res.points_earned, "pointsBalance": res.points_balance,
                                    "replay": res.replay})
            if self.pos_order_id:
                self.pos_order_id.sudo().write({
                    "almond_earn_state": "sent",
                    "almond_points_earned": res.points_earned,
                })
            return
        # reverse: only once the earn it undoes is confirmed
        earn = self.sudo().search([("kind", "=", "earn"), ("pos_order_ref", "=", self.pos_order_ref)], limit=1)
        if earn and earn.state == "pending":
            self.write({"next_try": fields.Datetime.now() + timedelta(seconds=policy.DEFAULT_BASE_DELAY),
                        "last_error": _("Waiting for the earn of %s to be sent first.", self.pos_order_ref)})
            return
        if not earn or earn.state in ("failed", "cancelled"):
            self.write({"state": "cancelled",
                        "last_error": _("Nothing to reverse: the earn for %s was never confirmed.",
                                        self.pos_order_ref)})
            return
        res = client.reverse_earn(self.pos_order_ref, payload.get("reason") or "refund")
        self._almond_mark_done({"reversedPoints": res.reversed_points, "shortfall": res.shortfall})
        if self.origin_order_id:
            self.origin_order_id.sudo().write({"almond_earn_state": "reversed"})

    def _almond_mark_done(self, response):
        self.write({
            "state": "done",
            "attempts": self.attempts + 1,
            "response": json.dumps(response),
            "last_error": False,
            "done_at": fields.Datetime.now(),
        })

    def _almond_mark_error(self, exc):
        self.ensure_one()
        attempts = self.attempts + 1
        decision = policy.decide(exc, attempts)
        # Safe text only: the client's messages never carry the key or bodies.
        if isinstance(exc, AlmondLoyaltyError):
            err = str(exc)
            if exc.api_message:
                err = "%s: %s" % (err, exc.api_message)
        else:
            err = "%s: %s" % (type(exc).__name__, str(exc)[:200])
        vals = {"attempts": attempts, "last_error": err[:255]}
        if decision == policy.FAIL:
            vals["state"] = "failed"
            if self.kind == "earn" and self.pos_order_id:
                self.pos_order_id.sudo().write({"almond_earn_state": "failed"})
        else:
            vals["next_try"] = fields.Datetime.now() + timedelta(seconds=policy.backoff_seconds(attempts))
        self.write(vals)
        _logger.warning("Almond loyalty outbox #%s (%s %s) attempt %s -> %s: %s",
                        self.id, self.kind, self.pos_order_ref, attempts, decision, err)
