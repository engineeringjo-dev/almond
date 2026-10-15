/**
 * ONE phone normaliser, for the BFF and the corporate roster alike.
 *
 * 🔴 WHY THIS IS SHARED AND NOT A SECOND COPY. A corporate discount is granted
 * by matching the member's phone against an uploaded roster. The member's phone
 * arrives through OTP sign-in and is stored canonically by
 * `bff/src/auth/otp.ts`; the roster arrives as a spreadsheet column typed by
 * whoever HR asked. If those two normalise differently by so much as a leading
 * zero, the match silently fails — the employee is simply charged full price,
 * no error anywhere, and the only symptom is a complaint at the till.
 *
 * So the rule lives in one place and both sides call it. `normalizePhone` in
 * the BFF now delegates here and adds the HTTP throw; this function returns
 * `null` instead, because a roster upload must be able to REPORT its bad rows
 * rather than abort on the first one.
 *
 * Canonical form is `+9627XXXXXXXX`. Accepted inputs, all seen in real
 * spreadsheets: `0791234567`, `791234567`, `+962 79 123 4567`, `00962791234567`,
 * `962-79-123-4567`, and the same with non-breaking spaces or Arabic-Indic
 * digits (٠٧٩…), which a phone typed on an Arabic keyboard produces.
 */

/** Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits → ASCII. A roster
 *  typed in Arabic otherwise fails every row for a reason nobody can see. */
export function toWesternDigits(raw: string): string {
  return (raw ?? '').replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06F0 ? 0x06F0 : 0x0660;
    return String(code - base);
  });
}

/**
 * `+9627XXXXXXXX`, or `null` when the input is not a Jordanian mobile.
 *
 * Deliberately strict about the SHAPE (7 followed by eight digits) and lenient
 * about the decoration, because the decoration is what varies between a
 * spreadsheet and a sign-in form and the shape is what identifies the person.
 */
export function normalizeJordanPhone(raw: string | null | undefined): string | null {
  let d = toWesternDigits(raw ?? '')
    .replace(/[^\d+]/g, '')
    .replace(/^\+/, '')
    .replace(/^00/, '');
  if (d.startsWith('962')) d = d.slice(3);
  d = d.replace(/^0/, '');
  return /^7\d{8}$/.test(d) ? `+962${d}` : null;
}

/**
 * A left-to-right run set inside right-to-left text, isolated (U+2066 LRI …
 * U+2069 PDI). Without it «أرسلنا رمزاً إلى +962791234567» is laid out with the
 * "+" at the far end of the number (the Arabic expert saw «962791234567+» in a
 * real render, 2026-10-15). Every phone number, and anything else a sentence
 * must not reorder, goes through this before it is interpolated.
 */
export function ltrIsolate(s: string): string {
  return `\u2066${s}\u2069`;
}

/**
 * The links and the printed form of ONE number — the unified call centre and
 * WhatsApp line in config.CONTACT_PHONE_E164 — so the app's help screen and the
 * website's footer derive the same three things from the same dial.
 *
 * `display` is "+962 7 9434 3400". A screen that sets it inside right-to-left
 * text must isolate it as left-to-right (the "+" otherwise lands at the end).
 */
export function contactLinks(e164: string): { tel: string; whatsapp: string; display: string } {
  const canonical = normalizeJordanPhone(e164);
  if (canonical === null) throw new Error(`contactLinks: not a Jordanian mobile: ${e164}`);
  const local = canonical.slice(4); // the 9 digits after +962
  return {
    tel: `tel:${canonical}`,
    whatsapp: `https://wa.me/${canonical.slice(1)}`,
    display: `+962 ${local[0]} ${local.slice(1, 5)} ${local.slice(5)}`,
  };
}
