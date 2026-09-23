/** Error with an HTTP status code; the error handler maps it to a JSON body. */
export class HttpError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
  }
}
export const badRequest = (m: string) => new HttpError(400, 'bad_request', m);
export const unauthorized = (m = 'Unauthorized') => new HttpError(401, 'unauthorized', m);
export const forbidden = (code: string, m: string) => new HttpError(403, code, m);
export const notFound = (m = 'Not found') => new HttpError(404, 'not_found', m);
export const conflict = (code: string, m: string) => new HttpError(409, code, m);
export const tooManyRequests = (code: string, m: string) => new HttpError(429, code, m);
/** 402 — the order needs a payment that has not been confirmed. */
export const paymentRequired = (code: string, m: string) => new HttpError(402, code, m);
/** 502 — an upstream provider (SMS, card gateway) failed. */
export const badGateway = (code: string, m: string) => new HttpError(502, code, m);
/** 503 — a capability is not configured on this deployment. Honest, never faked. */
export const serviceUnavailable = (code: string, m: string) => new HttpError(503, code, m);
