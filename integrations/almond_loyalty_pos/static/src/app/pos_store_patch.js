/*
 * Almond loyalty — till-side logic, as a patch on the POS store.
 *
 * Verified against Odoo 19.0 source (addons/point_of_sale/static/src/app):
 *   PosStore            @point_of_sale/app/services/pos_store  (getOrder, pay, notification, dialog, config)
 *   order.uiState       plain object, serialized to IndexedDB (related_models/base.js serializeState)
 *   order.getOrderlines / line.setDiscount / order.addPaymentline / line.setAmount / order.remainingDue
 *   rpc                 @web/core/network/rpc (JSON-RPC 2, matches type="jsonrpc" routes)
 *
 * What lives WHERE:
 *   - display state (member ref, mode, corporate %, redemption value) -> order.uiState.almondLoyalty
 *     (browser only; lost on a device switch, harmless: the server keeps the truth)
 *   - earn ticket, member id, settled redemptions -> SERVER (almond.loyalty.scan / .redemption)
 *   - earn call -> SERVER, after payment, via the outbox. Nothing here sends points.
 */
import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/services/pos_store";
import { rpc, ConnectionLostError } from "@web/core/network/rpc";
import { _t } from "@web/core/l10n/translation";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { ask } from "@point_of_sale/app/utils/make_awaitable_dialog";
import { roundJod } from "./almond_loyalty_utils";

patch(PosStore.prototype, {
    // ------------------------------------------------------------ helpers
    // A method, not a getter: PosStore extends WithLazyGetterTrap, which turns
    // every getter into a cached lazy computed value.
    almondLoyaltyIsEnabled() {
        return Boolean(this.config?.almond_loyalty_enabled);
    },

    almondLoyaltyInfo(order = this.getOrder()) {
        return order?.uiState?.almondLoyalty || null;
    },

    almondRedemptionMethod() {
        return this.config.payment_method_ids.find((pm) => pm.almond_is_redemption);
    },

    /**
     * `unconfirmed` is the message for a call that may already have spent
     * something on the server (settle): its lost reply must never say
     * "continue without Almond". Without it, nothing can have been spent.
     */
    async _almondCall(route, params, unconfirmed = null) {
        const order = this.getOrder();
        try {
            return await rpc(route, {
                session_id: this.session.id,
                order_uuid: order?.uuid,
                ...params,
            });
        } catch (error) {
            if (!(error instanceof ConnectionLostError)) {
                // Never let a loyalty problem break the sale screen.
                console.warn("Almond loyalty call failed", route);
            }
            if (unconfirmed) {
                return { ok: false, error: "unconfirmed", message: unconfirmed };
            }
            if (error instanceof ConnectionLostError) {
                return {
                    ok: false,
                    error: "offline",
                    message: _t("The till is offline. Continue the sale without Almond."),
                };
            }
            return { ok: false, error: "error", message: _t("Almond loyalty error.") };
        }
    },

    _almondNotify(message, type = "warning") {
        this.notification.add(message, { type });
    },

    // ------------------------------------------------------------ member
    /** Scan (resolve) a member QR and attach the member to the current order. */
    async almondScanMember(token) {
        const order = this.getOrder();
        if (!order || !this.almondLoyaltyIsEnabled()) {
            return { ok: false };
        }
        const res = await this._almondCall("/almond_loyalty/scan", { token: token.trim() });
        if (!res.ok) {
            this._almondNotify(res.message);
            return res;
        }
        const previous = this.almondLoyaltyInfo(order);
        if (previous?.corporate) {
            this.almondRemoveCorporateDiscount(order, previous.corporate.percentOff);
        }
        // Same member scanned twice (redeem QR, then pay QR for the cash part):
        // keep what the first scan told us; the server keeps both scans too.
        const sameMember = previous?.memberRef === res.memberRef;
        order.uiState.almondLoyalty = {
            memberRef: res.memberRef,
            mode: res.mode,
            earnsPoints: res.earnsPoints || Boolean(sameMember && previous?.earnsPoints),
            needsPayScan: res.needsPayScan && !(sameMember && previous?.earnsPoints),
            corporate: res.corporate,
            redemption: res.redemption || (sameMember ? previous?.redemption : null) || null,
            settled: previous?.settled || [],
        };
        if (res.corporate) {
            this.almondApplyCorporateDiscount(order);
            this._almondNotify(
                // Keyed _t() does not unescape "%%": the % sign goes in the value.
                _t("Corporate member: %(pct)s off, no points.", { pct: `${res.corporate.percentOff}%` }),
                "success"
            );
        } else if (res.needsPayScan) {
            this._almondNotify(
                _t("Redemption QR read. To earn points on the rest, scan the member's pay QR too."),
                "info"
            );
        } else if (res.earnsPoints) {
            this._almondNotify(_t("Almond member attached: points after payment."), "success");
        } else {
            this._almondNotify(_t("Almond member attached (no points on this order)."), "info");
        }
        return res;
    },

    async almondDetachMember() {
        const order = this.getOrder();
        const info = this.almondLoyaltyInfo(order);
        if (!info) {
            return;
        }
        await this._almondCall("/almond_loyalty/detach", {});
        if (info.corporate) {
            this.almondRemoveCorporateDiscount(order, info.corporate.percentOff);
        }
        // Keep the record of settled redemptions: they are already consumed.
        order.uiState.almondLoyalty = info.settled?.length ? { settled: info.settled } : null;
    },

    // ------------------------------------------------------------ corporate
    /**
     * Corporate discount as a per-line discount (sales discount on the lines).
     * Only raises a line's discount, never lowers a bigger manual one.
     * UNVERIFIED (Odoo 19, needs a live till): interaction with pricelists,
     * combo lines and pos_loyalty reward lines; whether ERP prefers a
     * corporate pricelist instead (see README "Decisions").
     */
    almondApplyCorporateDiscount(order = this.getOrder()) {
        const pct = this.almondLoyaltyInfo(order)?.corporate?.percentOff;
        if (!order || !pct || order.state !== "draft") {
            return;
        }
        const tipProductId = this.config.tip_product_id?.id;
        for (const line of order.getOrderlines()) {
            if (tipProductId && line.product_id?.id === tipProductId) {
                continue;
            }
            if (line.refunded_orderline_id) {
                continue;
            }
            if ((line.discount || 0) < pct) {
                line.setDiscount(pct);
            }
        }
    },

    almondRemoveCorporateDiscount(order, pct) {
        if (!order || !pct || order.state !== "draft") {
            return;
        }
        for (const line of order.getOrderlines()) {
            if (line.discount === pct) {
                line.setDiscount(0);
            }
        }
    },

    /** Re-apply before the payment screen so lines added after the scan get it too. */
    async pay() {
        if (this.almondLoyaltyIsEnabled()) {
            this.almondApplyCorporateDiscount(this.getOrder());
        }
        return await super.pay(...arguments);
    },

    // ------------------------------------------------------------ redemption
    /**
     * Settle a redemption and take its value off the bill as a payment line on
     * the Almond redemption payment method. `source` is one of
     *   { fromScan: true } | { token: "<fresh redeem QR>" }
     * Settling CONSUMES the member's redemption at the API, so every check that
     * can refuse happens BEFORE the call.
     */
    async almondSettleRedemption(source) {
        const order = this.getOrder();
        if (!order || !this.almondLoyaltyIsEnabled()) {
            return { ok: false };
        }
        if (source.code !== undefined) {
            return { ok: false, message: _t("Scan the member's current redemption QR. Typed points codes are not accepted.") };
        }
        // A pre-upgrade/reconstructed Almond tender without an identity is
        // uncertain: never create another authorization or line beside it.
        if (order.payment_ids.some((line) => line.payment_method_id?.almond_is_redemption && !line.almond_redemption_id)) {
            return { ok: false, message: _t("An Almond payment has no redemption identity. Ask the manager to reconcile this order.") };
        }
        const method = this.almondRedemptionMethod();
        if (!method) {
            this.dialog.add(AlertDialog, {
                title: _t("Almond redemption"),
                body: _t(
                    "No payment method is marked 'Almond redemption' on this point of sale. Ask the manager."
                ),
            });
            return { ok: false };
        }
        const due = order.remainingDue;
        if (!(due > 0)) {
            this._almondNotify(_t("Nothing left to pay on this order."));
            return { ok: false };
        }
        const known = source.fromScan ? this.almondLoyaltyInfo(order)?.redemption?.valueJod : undefined;
        if (known !== undefined && known > due) {
            const go = await ask(this.dialog, {
                title: _t("Redemption bigger than the bill"),
                body: _t(
                    "The redemption is worth %(value)s JOD but only %(due)s JOD is due. The difference is lost. Continue?",
                    { value: roundJod(known), due: roundJod(due) }
                ),
            });
            if (!go) {
                return { ok: false };
            }
        }
        // Once the request leaves the till the server may already have spent
        // the redemption. The same order and original credential replay the
        // recorded answer; a new QR cannot (docs/REDEMPTION-BARCODE-120S.md).
        // The server answers these same words for a timeout, a lost
        // connection, an unreadable reply, a 5xx or request_in_progress.
        const unconfirmed = source.fromScan
            ? _t("The redemption is not confirmed. Press 'Use it' again on this order before any other payment. Do not ask for a new QR. If it keeps failing, ask the manager.")
            : _t("The redemption is not confirmed. Press 'Apply' again with the same QR on this order before any other payment. Do not ask for a new QR. If it keeps failing, ask the manager.");
        const res = await this._almondCall("/almond_loyalty/settle", {
            order_uuid: order.uuid,
            from_scan: Boolean(source.fromScan),
            token: source.token || null,
        }, unconfirmed);
        if (!res.ok) {
            this._almondNotify(res.message);
            return res;
        }
        if (typeof res.redemptionId !== "string" || !res.redemptionId) {
            return { ok: false, message: _t("The settlement has no identity. Ask the manager to check this order.") };
        }
        // A recovered response must not add the same tender twice. The server
        // also binds the redemption to this order and original credential.
        const info = this.almondLoyaltyInfo(order) || {};
        const prior = info.settled?.find((entry) => entry.redemptionId === res.redemptionId);
        const matching = order.payment_ids.filter((line) => line.almond_redemption_id === res.redemptionId);
        if (matching.length) {
            if (matching.length !== 1 || !matching[0].payment_method_id?.almond_is_redemption ||
                !(matching[0].amount > 0) || matching[0].amount > res.valueJod) {
                return { ok: false, message: _t("The existing Almond payment does not match this redemption. Ask the manager.") };
            }
            // The real payment line, not uiState, is the reload/replay guard.
            return res;
        }
        if (prior?.applied) {
            return { ok: false, message: _t("The recorded Almond payment is missing. Ask the manager to check this order.") };
        }
        const entry = prior || { redemptionId: res.redemptionId, valueJod: res.valueJod, applied: false };
        if (!prior) info.settled = [...(info.settled || []), entry];
        order.uiState.almondLoyalty = info;

        const amount = roundJod(Math.min(res.valueJod, order.remainingDue));
        const added = order.addPaymentline(method);
        if (!added.status) {
            // Settled but not on the bill: retrying the same source records no
            // second value (the server and the ledger replay it).
            const values = { value: roundJod(res.valueJod), reason: added.data };
            this.dialog.add(AlertDialog, {
                title: _t("Almond redemption"),
                body: source.fromScan
                    ? _t("The redemption of %(value)s JOD was settled but could not be added to the bill: %(reason)s. Press 'Use it' again on this order before any other payment, or ask the manager to check this order.", values)
                    : _t("The redemption of %(value)s JOD was settled but could not be added to the bill: %(reason)s. Press 'Apply' again with the same QR on this order before any other payment, or ask the manager to check this order.", values),
            });
            const retry = source.fromScan
                ? _t("Press 'Use it' again on this order before any other payment, or ask the manager to check this order.")
                : _t("Press 'Apply' again with the same QR on this order before any other payment, or ask the manager to check this order.");
            return { ...res, ok: false, message: retry };
        }
        added.data.update({ almond_redemption_id: res.redemptionId });
        added.data.setAmount(amount);
        entry.applied = true;
        if (source.fromScan) info.redemption = null;
        this._almondNotify(_t("Redemption applied: %(value)s JOD.", { value: amount }), "success");
        if (res.valueJod > amount) {
            this._almondNotify(
                _t("%(lost)s JOD of the redemption was not used.", {
                    lost: roundJod(res.valueJod - amount),
                })
            );
        }
        return res;
    },
});
