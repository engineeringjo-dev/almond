# Voucher presentation policy — 2026-10-16

Owner request: a points-redemption barcode with a120-second lifetime.
Use a server-issued credential bound to one owned redemption, not a voucher
ID rendered as an invented payment code. 120 seconds is Almond's configurable
starting policy, not a universal industry standard.

## Implemented development-side boundary

- The signed redemption credential binds member, purpose and exact redemption
  ID. Cancelling A and creating B cannot redirect A's QR to B.
- `REDEMPTION_QR_TTL_SECONDS` defaults to 120, capped by the underlying
  redemption expiry. The boundary rejects at `now >= expiresAt`.
- Membership/earn/pay/corporate QR behavior retains its separate 60-second
  configuration. The generic token route cannot mint an unbound redemption
  QR, and older unbound redemption QRs fail closed.
- Scan and direct-token settlement resolve the exact owned pending row.
  Issuance does not deduct points again; database settlement remains atomic.
- The app now consumes the reservation/presentation contract and renders only
  the API token, with a countdown, manual refresh, expiry/failure states and
  no customer-typed points handoff. Demo tokens are visibly unsigned and cannot
  pass live validation. Reservation and presentation deadlines stay separate.
- Scan returns a purpose-separated signed receipt retaining the original
  presentation expiry. Both typed-points settlement endpoints fail closed;
  gift-card claim codes are a distinct purpose and remain supported.
- POS settlement requires a stable order reference and keyed request. Only a
  recorded identical key/body/order response can replay after expiry; no new
  financial settlement can. The addon source has been updated for this wire.

## Remaining integration boundary

The live app still needs the actual deployed BFF base host and a per-member JWT
session. Missing API/auth fails closed; no client-built live barcode is used.
Addon19.0.1.1.0 must be upgraded at cutover. Neither that upgrade nor production
BFF/database/Odoo writes were performed. Source tests do not demonstrate a
real deployed scanner-to-register transaction.

The in-process scan nonce map is not a distributed nonce store. Financial
same-row settlement is database-protected, but claim, settlement, response
recording and the POS receipt are not one distributed transaction. A crash
after settlement commits and before the response is recorded may leave a
pending key or absent local receipt. Retry refuses to create a second value;
manual reconciliation of exact row/order/attempt is required. Never auto-refund
a settled reservation. A globally atomic recovery/reconciliation worker is
outside this batch. See `docs/REDEMPTION-BARCODE-120S.md` for wire, retry and
cutover details.

Display black code on white with its quiet area intact. The installed SVG
renderer includes its margin within the requested outer size. The app uses
four modules of the smallest possible symbol (Version 1, 21 modules) as a
conservative clear margin for every version, and bounds the outer image to
the card's width. Runtime checks compare the actual SVG margin to its
one-module path stroke, including 320px dark mode. This is geometry evidence,
not proof from a physical scanner.

Request it only
while the sheet is visible, derive the countdown from server timestamps,
renew without consuming points again, hide expired codes, and revalidate
after foreground resume. Foregrounding does not auto-renew. Offer refresh/retry and meaningful accessible
status changes, rather than announcing every second. Screenshots can still
be forwarded within a valid window; short expiry does not prevent that.

## Primary references checked on 2026-10-16

- DENSO WAVE: four-module quiet zone on every side; Version1 starts at 21×21.
  https://www.qrcode.com/en/howto/code.html/index.html
  https://www.qrcode.com/en/about/version.html
- OWASP Transaction Authorization: server enforcement, operation binding,
  limited lifetime and protection against downgrade/replay; no fixed 120s.
  https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html
- Google Wallet rotating barcodes: typically a minute, with current-code
  validation; a static fallback weakens protection.
  https://developers.google.com/wallet/generic/resources/rotating-barcodes
- RFC 6238 §5.2: 30 seconds is the default TOTP time step, a different protocol
  rather than a mandated voucher duration.
  https://www.rfc-editor.org/rfc/rfc6238.html#section-5.2
- W3C Timing Adjustable: expiry/renewal needs accessibility consideration;
  a security justification is not an automatic exception for every timer.
  https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html

Physical scanner compatibility, actual Odoo operation, native Android/iPhone
and screen-reader testing remain unverified. No production records were
changed and no actual voucher was spent during development verification.
