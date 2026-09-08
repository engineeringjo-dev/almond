import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { config } from '@/constants/config';
import {
  POS_QR_MIN_REFRESH_MS,
  posQrExpiresAt,
  posQrMsUntilExpiry,
  posQrRefreshMs,
  posQrStatus,
} from '@/lib/posQr';
import { mockLoyaltyService } from '@/services/loyalty.service.mock';
import { loyaltyService } from '@/services/loyalty.service';
import { parsePosToken, PosTokenWireError } from '@almond/shared/pos/tokenWire';

/**
 * P1-P5 — the code the member shows at the till.
 *
 * The Pay screen used to render `ALMOND|MEMBER|<userId>|MODE=PAY`: no
 * signature, no expiry, no single use, built out of an id printed under the QR.
 * The signed token that replaces it lives on the server, so the two halves that
 * remain in the app are (a) WHEN the screen asks for a new one and (b) WHAT it
 * shows while it does not have one. Both are pure functions in lib/posQr.ts,
 * for a blunt reason: almond-app has no renderer in this repo, so anything
 * decided inside a component is verified by `tsc --noEmit` and by nothing else.
 *
 * bff/test/security.test.ts T30 is the other side of this — the structural walk
 * that says the retired format cannot exist in any workspace. These are the
 * behavioural half: what the member actually sees.
 */

describe('P1 the code refreshes before it dies', () => {
  it('asks for the next one at half the lifetime the SERVER reported', () => {
    // The shipped dial: 60s TTL → refresh at 30s, i.e. the replacement is
    // requested while the displayed code still has 30 seconds of life. Read off
    // config, never a literal, because the BFF lets an operator shorten the TTL
    // by env var and the app must follow it without a release.
    expect(posQrRefreshMs(config.POS_TOKEN_TTL_SECONDS)).toBe(30_000);
  });

  it('THE INVARIANT: the refresh lands strictly before the expiry, with margin', () => {
    // This is the whole promise of the screen — a member holding their phone
    // out never watches the barcode die. Swept over every TTL an operator could
    // plausibly set, from the polling floor's doubling upward.
    for (const ttl of [10, 20, 45, 60, 90, 120, 300, 3600]) {
      const margin = ttl * 1000 - posQrRefreshMs(ttl);
      expect(margin, `TTL ${ttl}s leaves no margin`).toBeGreaterThan(0);
      // Half the lifetime, so the margin is never a sliver: at the shipped
      // 60-second TTL that is 30 seconds to cover the request, the phone's
      // clock skew against the server's, and the walk to the counter.
      expect(margin).toBe((ttl * 1000) / 2);
    }
    expect(posQrRefreshMs(config.POS_TOKEN_TTL_SECONDS)).toBeLessThan(
      config.POS_TOKEN_TTL_SECONDS * 1000,
    );
  });

  it('never polls faster than the floor, and the floor wins on purpose', () => {
    // A misconfigured (or hostile) 1-second TTL would otherwise turn every open
    // Pay screen into two requests a second against the BFF.
    expect(posQrRefreshMs(1)).toBe(POS_QR_MIN_REFRESH_MS);
    expect(posQrRefreshMs(0)).toBe(POS_QR_MIN_REFRESH_MS);
    expect(posQrRefreshMs(-60)).toBe(POS_QR_MIN_REFRESH_MS);
    expect(posQrRefreshMs(Number.NaN)).toBe(POS_QR_MIN_REFRESH_MS);

    // And the cost of that, stated rather than hidden: under a TTL shorter than
    // twice the floor the margin disappears and the member can be shown the
    // `expired` panel between codes. A server asking a phone for four codes a
    // minute is misconfigured, and this is how anyone finds out. The shipped
    // TTL is 12× the floor, so nothing near the real setting is affected.
    expect(5 * 1000 - posQrRefreshMs(5)).toBeLessThanOrEqual(0);
    expect(config.POS_TOKEN_TTL_SECONDS * 1000).toBeGreaterThan(2 * POS_QR_MIN_REFRESH_MS);
  });

  it('the lifetime is counted from the RESPONSE, not from render time', () => {
    // `expiresIn` is relative to the moment the server answered. Restarting the
    // clock at render would extend a token's apparent life on every re-render
    // and eventually show a dead square as live.
    const received = 1_700_000_000_000;
    expect(posQrExpiresAt({ expiresIn: 60 }, received)).toBe(received + 60_000);
    expect(posQrMsUntilExpiry(received + 60_000, received + 59_000)).toBe(1_000);
    expect(posQrMsUntilExpiry(received + 60_000, received + 61_000)).toBe(0);
    expect(posQrMsUntilExpiry(null, received)).toBe(0);
  });
});

describe('P2 what the member sees, in every state', () => {
  const NOW = 1_700_000_000_000;
  const alive = { token: 'abc.def', expiresAt: NOW + 30_000 };
  const dead = { token: 'abc.def', expiresAt: NOW - 1 };

  it('a valid code is shown, and a refresh in flight does not blank it', () => {
    expect(posQrStatus({ ...alive, now: NOW, fetching: false })).toBe('ready');
    // THE GAP QUESTION. The refresh fires at half-life, so the old code is
    // still scannable while the new one is in flight — and it stays on screen.
    // Blanking it here would make every routine refresh a visible outage at the
    // counter.
    expect(posQrStatus({ ...alive, now: NOW, fetching: true })).toBe('ready');
  });

  it('an expired code is replaced by something the member can act on', () => {
    expect(posQrStatus({ ...dead, now: NOW, fetching: false })).toBe('expired');
    // ... but not while a retry is already running: offering "Retry" to someone
    // whose retry is in flight is a button that lies.
    expect(posQrStatus({ ...dead, now: NOW, fetching: true })).toBe('pending');
  });

  it('no code at all is distinguishable from an expired one', () => {
    // They call for different actions: an expired code is one tap from working,
    // while never having had one (offline at the counter) means asking the
    // cashier to look the account up instead. The screen says so in different
    // words, so the state machine has to tell them apart.
    expect(posQrStatus({ token: null, expiresAt: null, now: NOW, fetching: false }))
      .toBe('unavailable');
    expect(posQrStatus({ token: null, expiresAt: null, now: NOW, fetching: true }))
      .toBe('pending');
  });

  it('🔴 a screen that has not asked yet is WAITING, not offline', () => {
    // THE DEFECT THIS PINS. The Pay screen's query is `enabled: focused`, and
    // `focused` starts false because useFocusEffect flips it in a passive
    // effect — so on the first render of every open of the tab there is no
    // token and no request in flight. Read as the plain four-state machine,
    // that is `unavailable`, and the member was shown "We can't show your code
    // — you may be offline. Try again, or give the cashier your member ID"
    // before a single request had been made. It is the honest panel for a real
    // failure and a false one for a screen that has not tried.
    expect(
      posQrStatus({ token: null, expiresAt: null, now: NOW, fetching: false, settled: false }),
    ).toBe('pending');

    // ... and it does NOT swallow a real failure: once the request has come
    // back empty, the offline panel is exactly right and still appears.
    expect(
      posQrStatus({ token: null, expiresAt: null, now: NOW, fetching: false, settled: true }),
    ).toBe('unavailable');

    // The flag can only ever turn a false failure into a wait. It never
    // reaches a state that has a code: a settled=false render has no data by
    // definition, so 'ready' and 'expired' are unaffected either way.
    expect(posQrStatus({ ...alive, now: NOW, fetching: false, settled: false })).toBe('ready');
    expect(posQrStatus({ ...dead, now: NOW, fetching: false, settled: true })).toBe('expired');
  });

  it('there is no state in which a locally-built code could be shown', () => {
    // The one thing this whole package forbids: every branch either shows a
    // token that came from the server or shows no QR at all. `posQrStatus`
    // returns 'ready' ONLY when a token is in hand and unexpired.
    const states = [
      posQrStatus({ token: null, expiresAt: null, now: NOW, fetching: false }),
      posQrStatus({ token: null, expiresAt: null, now: NOW, fetching: true }),
      posQrStatus({ ...dead, now: NOW, fetching: false }),
    ];
    expect(states).not.toContain('ready');
  });
});

describe('P3 the mock mints like the server, and never the retired string', () => {
  it('returns something the shared wire parser accepts', async () => {
    // Under DATA_SOURCE='mock' this mock is the app's ONLY data source, so a
    // mock that returned the old string would put it back on screen for every
    // user of every build while the live client stayed clean.
    const wire = await mockLoyaltyService.getPosToken('u-mock-1', 'pay');
    expect(() => parsePosToken(wire)).not.toThrow();
    expect(wire.expiresIn).toBe(config.POS_TOKEN_TTL_SECONDS);
    expect(wire.mode).toBe('pay');
    expect(wire.token).not.toContain('|');
  });

  it('the code is not a function of the member id', () => {
    // The retired barcode WAS one: same member, same square, forever. Two asks
    // must not produce the same code, or a photograph is still a credential.
    return Promise.all([
      mockLoyaltyService.getPosToken('u-mock-2', 'pay'),
      mockLoyaltyService.getPosToken('u-mock-2', 'pay'),
    ]).then(([a, b]) => {
      expect(a.token).not.toBe(b.token);
      expect(a.token).not.toContain('u-mock-2');
    });
  });

  it('echoes the mode it was asked for, so the toggle and the code agree', async () => {
    expect((await mockLoyaltyService.getPosToken('u-mock-3', 'earn')).mode).toBe('earn');
    expect((await mockLoyaltyService.getPosToken('u-mock-3', 'pay')).mode).toBe('pay');
  });

  it('the service the app actually resolves to implements it', async () => {
    // The wiring, not another unit: `loyaltyService` is what the screen calls.
    const wire = await loyaltyService.getPosToken('u-mock-4', 'pay');
    expect(parsePosToken(wire).token.length).toBeGreaterThan(0);
  });
});

describe('P4 the seam refuses the retired format even from the server', () => {
  it('throws a NAMED error rather than rendering it', () => {
    // Defence in depth against the only remaining way the format could reach a
    // member: a server (or proxy, or stub) that sends it. A named throw is what
    // lets the screen say "we can't show your code" instead of drawing one.
    const bad = { token: 'ALMOND|MEMBER|u-1|MODE=PAY', expiresIn: 60, mode: 'pay' };
    expect(() => parsePosToken(bad)).toThrow(PosTokenWireError);
    // A TTL of zero would make the screen refresh in a tight loop against the
    // server that sent it.
    expect(() => parsePosToken({ token: 'a.b', expiresIn: 0, mode: 'pay' })).toThrow(PosTokenWireError);
    // A mode nothing can render.
    expect(() => parsePosToken({ token: 'a.b', expiresIn: 60, mode: 'redeem' })).toThrow(PosTokenWireError);
    // A 404/HTML body, which is what the live client receives from the loyalty
    // base URL today.
    expect(() => parsePosToken('<html>404</html>')).toThrow(PosTokenWireError);
  });
});

describe('P5 the screen really feeds the state machine what it needs', () => {
  // The failure mode this file exists inside: a pure module that is correct
  // while the screen that renders it passes the wrong thing. P2 above proves
  // `posQrStatus` distinguishes "has not asked" from "asked and failed"; only
  // the screen can supply that distinction, and only `tsc --noEmit` looks at
  // the screen. So the wiring is asserted here, in the idiom C13/C14 use in
  // bff/test/copy.test.ts.
  const pay = readFileSync(join(__dirname, '..', 'app', '(tabs)', 'pay.tsx'), 'utf8');

  it('passes the settled flag, so the offline panel needs a real failure', () => {
    expect(pay).toContain('posQrStatus(');
    // Without this the query's disabled first render — `enabled: focused`, and
    // `focused` starts false — reads as `unavailable` and shows "you may be
    // offline" before one request has been made.
    expect(pay).toMatch(/settled:\s*!isPending/);
  });

  it('and stops asking when the tab is not focused', () => {
    // The other half of the same hook. A member who opens Pay and walks away
    // must not keep minting a code a minute from their pocket.
    expect(pay).toMatch(/usePosToken\(\{[^}]*focused/);
    expect(pay).toMatch(/setFocused\(false\)/);
  });
});
