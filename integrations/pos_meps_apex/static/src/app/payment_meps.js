/** @odoo-module */
/*
 * MEPS (Apex ECR) POS payment interface — cloud, semi-integrated.
 *
 * When the cashier validates a "Visa (MEPS)" payment line, we ask the Odoo
 * backend to run the signed ApexECR SALE (the amount then appears on the MEPS
 * terminal; the customer taps the card). We store the approval refs on the line.
 *
 * ⚠️ VERIFY against Odoo 19: the exact PaymentInterface base import/registration
 * path can shift between versions — confirm against an existing terminal module
 * (e.g. Stripe/PAX) in your Odoo 19 source. Logic below is the intended shape.
 */
import { PaymentInterface } from "@point_of_sale/app/payment/payment_interface";
import { register_payment_method } from "@point_of_sale/app/store/pos_store";
import { rpc } from "@web/core/network/rpc";

export class PaymentMepsApex extends PaymentInterface {
    async send_payment_request(uuid) {
        const line = this.pos.get_order().get_paymentline(uuid);
        const pm = this.payment_method_id || this.payment_method;
        try {
            const res = await rpc("/pos_meps_apex/sale", {
                payment_method_id: pm.id,
                amount: line.get_amount(),
                reference: this.pos.get_order().uid,
            });
            if (!res.approved) {
                this.pos.env.services.dialog.add?.(/* ErrorPopup */ undefined, {
                    title: "MEPS declined",
                    body: res.error || "Transaction not approved",
                });
                return false;
            }
            line.card_type = res.scheme;
            line.transaction_id = res.rrn || res.authCode;
            line.payment_ref_no = res.authCode;
            return true;
        } catch (e) {
            line.set_payment_status?.("retry");
            return false;
        }
    }

    async send_payment_cancel() {
        // TODO(Apex): implement VOID via a /pos_meps_apex/void endpoint.
        return true;
    }
}

register_payment_method("meps_apex", PaymentMepsApex);
