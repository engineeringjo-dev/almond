/*
 * Pure helpers (no Odoo imports) — what a scanned/typed string is.
 *
 * A member QR from the Almond app is an opaque BFF token:
 *   base64url(JSON payload) + "." + base64url(HMAC)      (bff/src/pos/token.ts)
 * A redemption code is 8 chars shown as "AB2C-D3EF".
 * Product barcodes are digits (EAN/UPC) and match neither pattern.
 */

const TOKEN_RE = /^[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}$/;
const CODE_RE = /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/;

export function looksLikeAlmondToken(value) {
    return typeof value === "string" && value.length <= 4096 && TOKEN_RE.test(value.trim());
}

export function looksLikeRedemptionCode(value) {
    return typeof value === "string" && CODE_RE.test(value.replace(/\s+/g, ""));
}

/** "token" | "code" | null */
export function classifyAlmondInput(value) {
    const v = (value || "").trim();
    if (looksLikeAlmondToken(v)) {
        return "token";
    }
    if (looksLikeRedemptionCode(v)) {
        return "code";
    }
    return null;
}

/** JOD has 3 decimals. */
export function roundJod(value) {
    return Math.round((Number(value) || 0) * 1000) / 1000;
}
