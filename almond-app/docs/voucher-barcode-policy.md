# Voucher presentation policy — 2026-10-16

Owner request: a voucher barcode with an approximately 120-second lifetime.
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

## Remaining integration boundary

The app's current `Voucher`/legacy live service does not consume this BFF
credential contract. Its cards remain explicitly unavailable for POS use;
this work does not turn IDs into codes or present a timer as authorization.
The development BFF is not evidence of production deployment.

The existing Odoo path scans a QR, stores the returned typed redemption code
and may settle that code for the underlying 15-minute redemption lifetime.
Keeping that compatibility means **the entire settlement flow is not yet
restricted to 120 seconds**. A known typed code plus the authenticated POS key
still authorizes that legacy path; rate limits do not fix known-code misuse.
The in-process QR replay map is also not a distributed nonce store, although
same-row financial settlement is protected by the database transaction.

Before releasing a real mobile spend QR, replace that handoff with an
order-bound authorization/receipt: scan or preview, explicit apply with
stable POS order and attempt IDs, atomic consume, same-attempt retry/status
after a lost response, and recovery if adding the POS payment line fails or
the order is cancelled. Manual fallback must share the same lifetime and
consume record; a longer-lived static code must not bypass the rule.

Display black code on white with its quiet area intact. Request it only
while the sheet is visible, derive the countdown from server timestamps,
renew without consuming points again, hide expired codes, and revalidate
after foreground resume. Offer refresh/retry and meaningful accessible
status changes, rather than announcing every second. Screenshots can still
be forwarded within a valid window; short expiry does not prevent that.

## Primary references checked on 2026-10-16

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
