/*
 * Pure helpers (no Odoo imports) — what a scanned/typed string is.
 *
 * A member QR from the Almond app is an opaque BFF token:
 *   base64url(JSON payload) + "." + base64url(HMAC)      (bff/src/pos/token.ts)
 * Typed points-redemption codes are not accepted. Gift-card claim codes
 * belong to the member app, not to this till flow.
 * Product barcodes are digits (EAN/UPC) and do not match the QR pattern.
 */

const TOKEN_RE = /^[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}$/;

export function looksLikeAlmondToken(value) {
    return typeof value === "string" && value.length <= 4096 && TOKEN_RE.test(value.trim());
}

/** "token" | null — the BFF verifies signature, purpose and expiry. */
export function classifyAlmondInput(value) {
    const v = (value || "").trim();
    if (looksLikeAlmondToken(v)) {
        return "token";
    }
    return null;
}

/** JOD has 3 decimals. */
export function roundJod(value) {
    return Math.round((Number(value) || 0) * 1000) / 1000;
}
