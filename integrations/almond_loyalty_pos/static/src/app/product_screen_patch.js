/*
 * Barcode-scanner routing for the member QR (Odoo 19.0 ProductScreen).
 *
 * Verified in 19.0 source:
 *  - ProductScreen.setup() registers useBarcodeReader({product, quantity, weight,
 *    price, client, discount, gs1}) and each callback receives the PARSED barcode
 *    ({ code, type, base_code, ... }).
 *  - BarcodeReader._scan parses with the nomenclature; the default nomenclature
 *    has a catch-all product rule, so a member QR arrives as type "product";
 *    with a nomenclature that has no catch-all it arrives as type "error".
 * So: intercept Almond tokens in _barcodeProductAction, and register an
 * "error" handler for the no-catch-all case (other unknown codes still get
 * Odoo's "not found" notification).
 *
 * UNVERIFIED (needs a live till + the real scanner): that the handheld
 * scanners at the branches emit the full ~150-char QR payload as one keyboard
 * burst the barcode service accepts (dots/dashes/underscores included).
 * If not, the dialog input still works (the scanner types into it).
 */
import { patch } from "@web/core/utils/patch";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { useBarcodeReader } from "@point_of_sale/app/hooks/barcode_reader_hook";
import { looksLikeAlmondToken } from "./almond_loyalty_utils";

patch(ProductScreen.prototype, {
    setup() {
        super.setup(...arguments);
        useBarcodeReader({ error: this._almondBarcodeUnknown });
    },

    async _barcodeProductAction(code) {
        if (this.pos.almondLoyaltyIsEnabled() && looksLikeAlmondToken(code?.code)) {
            await this.pos.almondScanMember(code.code);
            return;
        }
        return await super._barcodeProductAction(...arguments);
    },

    async _almondBarcodeUnknown(code) {
        if (this.pos.almondLoyaltyIsEnabled() && looksLikeAlmondToken(code?.code)) {
            await this.pos.almondScanMember(code.code);
            return;
        }
        this.barcodeReader.showNotFoundNotification(code);
    },
});
