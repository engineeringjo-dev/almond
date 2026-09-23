/*
 * Keep the Almond redemption payment method off the payment buttons (Odoo 19.0
 * PaymentScreen: payment_methods_from_config, addNewPaymentLine). Its lines are
 * added ONLY by almondSettleRedemption, after the API settled the redemption,
 * so a cashier cannot type an arbitrary "redemption" amount. (The server also
 * flags any order where more was charged to it than was settled.)
 */
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";

patch(PaymentScreen.prototype, {
    setup() {
        super.setup(...arguments);
        this.payment_methods_from_config = this.payment_methods_from_config.filter(
            (pm) => !pm.almond_is_redemption
        );
    },

    async addNewPaymentLine(paymentMethod) {
        if (paymentMethod?.almond_is_redemption) {
            this.dialog.add(AlertDialog, {
                title: _t("Almond redemption"),
                body: _t("Use the «ألموند» button on the order screen to redeem."),
            });
            return false;
        }
        return await super.addNewPaymentLine(...arguments);
    },
});
