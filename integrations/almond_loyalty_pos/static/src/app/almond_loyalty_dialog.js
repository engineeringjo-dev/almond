/*
 * The «ألموند» dialog: one input for everything the cashier can be handed.
 *   - a member QR (scanner or paste)  -> attach member (scan)
 *   - a redemption code AB2C-D3EF     -> settle it and take it off the bill
 * plus buttons for the redemption carried by a "redeem" scan and for removing
 * the member. Built like point_of_sale's TextInputPopup (Odoo 19.0).
 */
import { Component, onMounted, useRef, useState } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { _t } from "@web/core/l10n/translation";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import { classifyAlmondInput, roundJod } from "./almond_loyalty_utils";

export class AlmondLoyaltyDialog extends Component {
    static template = "almond_loyalty_pos.AlmondLoyaltyDialog";
    static components = { Dialog };
    static props = {
        close: Function,
        // Redeem-QR mode: the next QR is settled as a redemption, not scanned.
        redeemQr: { type: Boolean, optional: true },
    };

    setup() {
        this.pos = usePos();
        this.state = useState({ input: "", busy: false, error: "", redeemQr: Boolean(this.props.redeemQr) });
        this.inputRef = useRef("input");
        onMounted(() => this.inputRef.el?.focus());
    }

    get info() {
        return this.pos.almondLoyaltyInfo();
    }

    get settledTotal() {
        return roundJod((this.info?.settled || []).reduce((sum, s) => sum + (s.valueJod || 0), 0));
    }

    formatJod(value) {
        return roundJod(value).toFixed(3);
    }

    async _run(fn) {
        if (this.state.busy) {
            return;
        }
        this.state.busy = true;
        this.state.error = "";
        try {
            const res = await fn();
            if (res && !res.ok && res.message) {
                this.state.error = res.message;
            } else if (res && res.ok) {
                this.state.input = "";
            }
        } finally {
            this.state.busy = false;
            this.inputRef.el?.focus();
        }
    }

    async submit() {
        const value = this.state.input.trim();
        const kind = classifyAlmondInput(value);
        if (!kind) {
            this.state.error = _t("This is not an Almond QR or redemption code.");
            return;
        }
        if (kind === "token" && this.state.redeemQr) {
            return this._run(() => this.pos.almondSettleRedemption({ token: value }));
        }
        if (kind === "token") {
            return this._run(() => this.pos.almondScanMember(value));
        }
        return this._run(() => this.pos.almondSettleRedemption({ code: value }));
    }

    redeemFromScan() {
        return this._run(() => this.pos.almondSettleRedemption({ fromScan: true }));
    }

    detach() {
        return this._run(async () => {
            await this.pos.almondDetachMember();
            return { ok: true };
        });
    }

    onKeydown(ev) {
        if (ev.key === "Enter") {
            ev.preventDefault();
            ev.stopPropagation();
            this.submit();
        }
    }
}
