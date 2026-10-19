# Points redemption barcode: source contract and cutover

The customer reserves points once, then shows a server-issued QR barcode. The
barcode is not a voucher id, membership code, gift-card claim code, or a typed
points code. The existing point reservation lasts15minutes; each presentation
lasts at most120seconds. These are separate deadlines.

## Wire and lifecycle

- `POST /v1/loyalty/redeem` takes `{points}` with the same confirmation's
  `Idempotency-Key`. It debits once and returns public reservation metadata.
  Presentation issuance is separate: a failed QR request must not create
  another reservation. The creation response still succeeds if the courtesy
  balance read fails after the debit committed.
- `GET /v1/me/redemption/:redemptionId` reads that exact JWT-owned row, including
  a closed row. Public metadata does not expose the internal legacy code.
- `POST /v1/me/redemption/qr` takes `{redemptionId}`. The server signs member,
  exact redemption id, redemption purpose, nonce, issue time and expiry. Its
  expiry is the earlier of the reservation deadline and configured presentation
  lifetime (`REDEMPTION_QR_TTL_SECONDS`, default120, env may shorten only).
- The app displays only this API response in live mode. It counts down against
  the earlier of the absolute server expiry and request-start plus lifetime;
  response delay cannot add seconds. At expiry/background/navigation it removes
  the barcode. Returning from the background does not automatically refresh it.
  Explicit refresh requests a new presentation for the same row, without a new
  debit or extending the original reservation. Status polling removes a settled
  or closed credential and refreshes loyalty queries, including returned points.
- A failed/offline/authenticated request shows a retry state without a barcode.
  There is no offline or typed-points fallback. An unused expired/cancelled
  reserve restores only still-live original FIFO slices, never a new lifetime.

## Till authorization and retries

`POST /v1/pos/scan` requires POS authentication and verifies the presentation.
It returns a separately domain-signed `settlementToken` for the exact same
member/redemption. The receipt retains the **original** presentation issue and
expiry times: scanning at119seconds does not grant another120seconds. Scanning
itself does not spend the reserve.

`POST /v1/pos/redemption/settle` requires POS authentication, a unique
`Idempotency-Key`, `{posOrderRef}` and exactly one of `{token}` or
`{settlementToken}`. Signature/purpose verification precedes retry lookup. A
fresh application rejects at `now >= exp`, including after a slow row read.
It resolves only the signed owned row; it never substitutes the latest row.
Backend row locking makes that reservation settle at most once.

Only an already-recorded response for the identical key, full body and POS order
can replay after expiry. Changing the body/order under the same key is422;
a fresh key cannot spend an expired authorization or settle an already-settled
row again. A lost/uncertain response must retry the original credential, order
and key. Do not refresh credentials and reuse that key. The till tells the
cashier exactly this: an uncertain settle (timeout, lost connection, unreadable
reply, 5xx, `409 request_in_progress`) reads "not confirmed: press 'Use it'
again on this order before any other payment, do not ask for a new QR", never
"continue without Almond". Both old typed-points
settlement routes now fail closed with `redemption_barcode_required`; gift-card
claim codes keep their separate purpose and flow.

The POS addon source19.0.1.1.0 sends this contract and records the exact
redemption/order/attempt before applying its tender. It requires an addon
upgrade at cutover; old clients sending `{code}` are intentionally incompatible.

## Real remaining integration limits

This is source and in-process HTTP/adapter verification, not a deployed POS
claim. No production database/Odoo writes, addon upgrade or BFF deployment were
performed. Native iOS/Android scanner behavior and a real Odoo register must be
verified at cutover. The app live client now uses the real points `/v1` wire,
but the current loyalty base host and per-member JWT session integration still
need deployment/configuration; a build-time public bearer token is not that
session. Missing live API/auth fails closed. Other legacy loyalty endpoints
remain a separate integration boundary.

Mock mode deliberately returns `ALMOND-DEMO-REDEMPTION:…`, visibly labelled as
an unsigned demo that cannot be used at the till. The live parser rejects it;
the BFF/POS signature verification cannot accept it. It mirrors reservation,
expiry, refresh and original-lot return behavior without claiming live scanning.

The durable idempotency claim, financial settlement, response recording and POS
local receipt are **not one distributed transaction**. A process crash after
the row settles but before the response is recorded can leave a pending key or
missing local receipt. Retries then refuse instead of granting a second value;
the exact row/order/attempt needs manual reconciliation before the till applies
or reverses anything. Do not automatically refund a settled reservation. This
batch does not claim globally atomic recovery or an automatic reconciliation
worker. Cutover must include an operational reconciliation procedure and an
authenticated scanner/register test with lost-response and draft-reload cases.

## Focused regression checks

`bff/test/redemption-presentation.test.ts` runs the real HTTP routes against
memory and PostgreSQL. `bff/test/redemption-qr.test.ts` covers exact-row binding,
cancel-A/create-B, tampering, wrong purpose and expiry boundaries. App
`test/redemptionQr.test.ts` exercises the actual presenter, delayed/in-flight
responses, background invalidation and demo reservation lineage;
`test/redemptionLive.test.ts` verifies the live wire and failure behavior.
Addon tests exercise receipt forwarding, retry identity and one-tender guards.
Browser runtime checks are separate from native/device and production cutover.
