/*
 * «ألموند» button on the product screen (Odoo 19.0 ControlButtons,
 * @point_of_sale/app/screens/product_screen/control_buttons/control_buttons).
 * Same patch style as pos_discount's clickDiscount.
 */
import { patch } from "@web/core/utils/patch";
import { ControlButtons } from "@point_of_sale/app/screens/product_screen/control_buttons/control_buttons";
import { AlmondLoyaltyDialog } from "./almond_loyalty_dialog";

patch(ControlButtons.prototype, {
    clickAlmondLoyalty() {
        this.dialog.add(AlmondLoyaltyDialog, {});
    },
    get almondLoyaltyLabel() {
        const info = this.pos.almondLoyaltyInfo();
        return info?.memberRef ? "ألموند ✓" : "ألموند";
    },
});
