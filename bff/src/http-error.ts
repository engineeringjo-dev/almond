/** Error with an HTTP status code; the error handler maps it to a JSON body. */
export class HttpError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
  }
}
export const badRequest = (m: string) => new HttpError(400, 'bad_request', m);
export const unauthorized = (m = 'Unauthorized') => new HttpError(401, 'unauthorized', m);
export const notFound = (m = 'Not found') => new HttpError(404, 'not_found', m);
export const conflict = (code: string, m: string) => new HttpError(409, code, m);
export const tooManyRequests = (code: string, m: string) => new HttpError(429, code, m);
