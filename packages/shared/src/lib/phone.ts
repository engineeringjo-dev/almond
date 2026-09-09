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
