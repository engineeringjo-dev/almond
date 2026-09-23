/**
 * The slice of autocannon 8's API the baseline uses. The package ships no
 * types and @types/autocannon is not installed (and this change may not touch
 * package.json), so the contract is written down here instead of `any`.
 */
declare module 'autocannon' {
  import type { EventEmitter } from 'node:events';

  interface Options {
    url: string;
    connections?: number;
    duration?: number;
    method?: 'GET' | 'POST' | 'PUT';
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
    /** Per-request hook: return the request to send (used here to give every
     *  checkout its own Idempotency-Key, as a real client would). */
    requests?: Array<{ setupRequest?: (req: RequestParams) => RequestParams }>;
  }
  interface RequestParams {
    method?: string; path?: string; headers?: Record<string, string>; body?: string;
  }
  interface Histogram {
    average: number; mean: number; stddev: number; min: number; max: number;
    p50: number; p90: number; p97_5: number; p99: number; p99_9: number;
  }
  interface Result {
    requests: Histogram & { total: number; sent: number };
    latency: Histogram;
    throughput: Histogram;
    errors: number;
    timeouts: number;
    non2xx: number;
    duration: number;
    '1xx': number; '2xx': number; '3xx': number; '4xx': number; '5xx': number;
  }
  interface Instance extends EventEmitter {
    on(event: 'response', fn: (client: unknown, statusCode: number, resBytes: number, responseTime: number) => void): this;
    on(event: 'done', fn: (r: Result) => void): this;
    on(event: string, fn: (...args: unknown[]) => void): this;
  }
  function autocannon(opts: Options, cb: (err: Error | null, result: Result) => void): Instance;
  export default autocannon;
  export type { Options, Result, Instance, RequestParams };
}
