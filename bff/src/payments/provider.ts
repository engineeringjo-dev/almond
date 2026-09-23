/**
 * THE CARD-GATEWAY SEAM — the one interface a real payment provider implements.
 *
 * Ishbek writes ONE class that implements `PaymentProvider` (start from
 * providers/TEMPLATE.ts), registers it by name in payments/index.ts, and sets
 * PAYMENT_PROVIDER plus the provider's own secret env vars. Nothing else in the
 * BFF changes: the routes, the money rules and the database are already wired
 * to this interface and tested against the mock.
 *
 * 🔴 WHAT THE REST OF THE BFF RELIES ON — each is a money rule, not a style:
 *
 *   1. AMOUNTS ARE INTEGER FILS (1 JOD = 1000 fils). Never a float, never a
 *      string with a decimal point. A gateway that wants "5.250" gets it
 *      formatted INSIDE the provider, and `getCapture` converts back to fils.
 *   2. `getCapture` IS THE AUTHORITY. The checkout calls it before it will
 *      place a card order, and grants points only when it answers `captured`
 *      with EXACTLY the amount the server re-priced. It must ask the gateway,
 *      server-to-server, with the secret key — never trust anything the phone
 *      or the browser reported ("the redirect said success" is not a capture).
 *   3. `verifyWebhook` MUST CHECK THE SIGNATURE BEFORE READING THE BODY, with a
 *      constant-time compare (crypto.timingSafeEqual) over the RAW bytes the
 *      gateway sent — re-serialised JSON does not hash the same. Unsigned, badly
 *      signed or unparseable ⇒ return null (the route answers 401). A webhook
 *      only ever moves an intent pending → captured|failed; it can never make a
 *      card order `funded` on its own (rule 2 still runs at checkout).
 *   4. SECRETS COME FROM THE ENVIRONMENT, read in the provider, never logged,
 *      never returned. `clientSecret` is the gateway's per-payment token for a
 *      client SDK — not the merchant's API key.
 *   5. FAILURE IS LOUD. A network error, a 5xx or an unexpected body from the
 *      gateway THROWS; it never resolves as `pending` or `failed` by guess.
 */

export interface CreateIntentInput {
  /** OUR id for this payment (`pi_…`). Send it to the gateway as the merchant
   *  reference, so its dashboard and our database name the payment alike. */
  intentId: string;
  /** Integer fils, > 0. The server re-priced the cart; this is not the client's number. */
  amountFils: number;
  currency: 'JOD';
  memberId: string;
  /** Human-readable, for the gateway's receipt/statement line. */
  description: string;
  /** Where a hosted payment page sends the member afterwards (config.PAYMENT_RETURN_URL). */
  returnUrl?: string;
}

export interface CreatedIntent {
  /** The GATEWAY's id for this payment (checkout id, session id, order id…).
   *  Stored, and passed back to getCapture / matched against webhooks. */
  providerRef: string;
  /** A hosted payment page to send the member to, when the gateway has one. */
  redirectUrl?: string;
  /** A per-payment token for the gateway's client SDK, when it uses one. */
  clientSecret?: string;
}

export interface Capture {
  /** `captured` ONLY when the money is taken (authorised AND captured, or a
   *  gateway's single-step sale that succeeded). An authorisation that has not
   *  been captured is `pending`. */
  status: 'captured' | 'pending' | 'failed';
  /** What the gateway says it captured, in integer fils. Compared EXACTLY to
   *  the re-priced order total — a partial capture does not fund an order. */
  amountFils: number;
  /** The gateway's capture/transaction id, stored on the intent for refunds
   *  and reconciliation. */
  captureRef?: string;
}

export interface WebhookEvent {
  providerRef: string;
  status: 'captured' | 'failed';
}

export interface PaymentProvider {
  /** Registry name, also the `:provider` segment of the webhook URL
   *  (`POST /v1/payments/webhook/<name>`). Lowercase, stable. */
  readonly name: string;
  createIntent(input: CreateIntentInput): Promise<CreatedIntent>;
  getCapture(providerRef: string): Promise<Capture>;
  /** Synchronous: verify, then parse. null ⇒ 401. It must not write to our
   *  store — the route records the status (Backend.recordPaymentStatus). */
  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): WebhookEvent | null;
}
