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

    async _almondCall(route, params) {
        const order = this.getOrder();
        try {
            return await rpc(route, {
                session_id: this.session.id,
                order_uuid: order?.uuid,
                ...params,
            });
        } catch (error) {
            if (error instanceof ConnectionLostError) {
                return {
                    ok: false,
                    error: "offline",
                    message: _t("The till is offline. Continue the sale without Almond."),
                };
            }
            // Never let a loyalty problem break the sale screen.
            console.warn("Almond loyalty call failed", route, error);
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
        order.uiState.almondLoyalty = {
            memberRef: res.memberRef,
            mode: res.mode,
            earnsPoints: res.earnsPoints,
            corporate: res.corporate,
            redemption: res.redemption,
            settled: previous?.settled || [],
        };
        if (res.corporate) {
            this.almondApplyCorporateDiscount(order);
            this._almondNotify(
                // Keyed _t() does not unescape "%%": the % sign goes in the value.
                _t("Corporate member: %(pct)s off, no points.", { pct: `${res.corporate.percentOff}%` }),
                "success"
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
     *   { fromScan: true } | { code: "AB2C-D3EF" } | { token: "<redeem QR>" }
     * Settling CONSUMES the member's redemption at the API, so every check that
     * can refuse happens BEFORE the call.
     */
    async almondSettleRedemption(source) {
        const order = this.getOrder();
        if (!order || !this.almondLoyaltyIsEnabled()) {
            return { ok: false };
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
        const res = await this._almondCall("/almond_loyalty/settle", {
            from_scan: Boolean(source.fromScan),
            code: source.code || null,
            token: source.token || null,
        });
        if (!res.ok) {
            this._almondNotify(res.message);
            return res;
        }
        // Settled at the API: record it locally even if adding the line fails.
        const info = this.almondLoyaltyInfo(order) || {};
        info.settled = [...(info.settled || []), { valueJod: res.valueJod }];
        if (source.fromScan) {
            info.redemption = null;
        }
        order.uiState.almondLoyalty = info;

        const amount = roundJod(Math.min(res.valueJod, order.remainingDue));
        const added = order.addPaymentline(method);
        if (!added.status) {
            this.dialog.add(AlertDialog, {
                title: _t("Almond redemption"),
                body: _t(
                    "The redemption of %(value)s JOD was settled but could not be added to the bill: %(reason)s. Add it on the payment screen with the Almond method.",
                    { value: roundJod(res.valueJod), reason: added.data }
                ),
            });
            return res;
        }
        added.data.setAmount(amount);
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
