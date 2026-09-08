import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { config } from '@almond/shared/config';
import {
  MAX_NAME_LENGTH, isProfileComplete, normalizeName, profileBonusFor,
} from '@almond/shared/loyalty/profile';
import { build } from '../src/server';
import { signIn } from './lib/signIn';

/**
 * T33 — the profile, and the one-time bonus for filling it in.
 *
 * Owner, 2026-09-08: «٥٠ نقطة اذا بحط معلوماته وبصير الاسم مربوط باسم التعريف
 * فبتصير مثلا صباح الخير حمزة».
 *
 * A one-time grant driven by a client-supplied form is a mint if anything about
 * it is decided on the client, so these are OUTCOME tests against the real
 * route over HTTP: what a member's balance actually is after they save, and
 * after they save again. T1-T15, T24, T27, T29-T32 are taken; this file claims
 * T33.
 */

const BONUS = config.PROFILE_COMPLETION_BONUS;
const newPhone = (): string => `+9627${Math.floor(Math.random() * 90000000 + 10000000)}`;

/** Sign a brand-new member in and return their bearer token. A fresh phone each
 *  time, so no test inherits another's profile stamp. */
async function freshMember(app: FastifyInstance): Promise<string> {
  return signIn(app, newPhone());
}

const save = (app: FastifyInstance, token: string, body: Record<string, unknown>) =>
  app.inject({
    method: 'POST',
    url: '/v1/me/profile',
    headers: { authorization: `Bearer ${token}` },
    payload: body,
  });

const balance = async (app: FastifyInstance, token: string): Promise<number> => {
  const res = await app.inject({
    method: 'GET',
    url: '/v1/me/balance',
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.statusCode).toBe(200);
  return res.json().points as number;
};

describe('T33 the profile bonus', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await build(); await app.ready(); });
  afterAll(async () => { await app.close(); });

  it('T33a a new member starts with no name, so the greeting has nothing to use', async () => {
    // The precondition for everything else, and the fix that reached the app
    // the same day: findOrCreateByPhone used to invent `name: 'Member'`. An
    // invented name is not a name — it would also mean the member arrived with
    // a "complete" profile and could never earn the bonus for a real one.
    const token = await freshMember(app);
    const res = await save(app, token, { name: '', birthday: null });
    expect(res.statusCode).toBe(200);
    expect(res.json().profile.name).toBe('');
    expect(res.json().bonusGranted).toBe(0);
  });

  it('T33b saving a name pays the bonus exactly once', async () => {
    const token = await freshMember(app);
    const before = await balance(app, token);

    const first = await save(app, token, { name: 'حمزة', birthday: null });
    expect(first.statusCode).toBe(200);
    expect(first.json().bonusGranted).toBe(BONUS);
    expect(first.json().profile.name).toBe('حمزة');

    // 🔴 THE BALANCE, NOT THE REPLY. A route can report a grant it never made.
    expect(await balance(app, token)).toBe(before + BONUS);

    // Saving again is an ordinary thing to do — correcting a typo, adding a
    // birthday later. It must SUCCEED and pay NOTHING.
    const second = await save(app, token, { name: 'حمزة خ', birthday: '1990-04-20' });
    expect(second.statusCode).toBe(200);
    expect(second.json().bonusGranted).toBe(0);
    expect(second.json().profile.name).toBe('حمزة خ');
    expect(second.json().profile.birthday).toBe('1990-04-20');
    expect(await balance(app, token)).toBe(before + BONUS);
  });

  it('T33c clearing the name afterwards does not re-arm the bonus', async () => {
    // The mint this forbids: save a name (+50), clear it, save it again (+50),
    // forever. The stamp is a timestamp on the member and is never derived from
    // "does this member currently have a name".
    const token = await freshMember(app);
    expect((await save(app, token, { name: 'Hamza', birthday: null })).json().bonusGranted).toBe(BONUS);
    const paid = await balance(app, token);

    for (let i = 0; i < 5; i += 1) {
      expect((await save(app, token, { name: '', birthday: null })).json().bonusGranted).toBe(0);
      expect((await save(app, token, { name: 'Hamza', birthday: null })).json().bonusGranted).toBe(0);
    }
    expect(await balance(app, token)).toBe(paid);
  });

  it('T33d whitespace is not a name', async () => {
    const token = await freshMember(app);
    const res = await save(app, token, { name: '   \t  ', birthday: null });
    expect(res.json().bonusGranted).toBe(0);
    expect(res.json().profile.name).toBe('');
    // And the member is still eligible — they have not told us anything yet.
    expect((await save(app, token, { name: 'Hamza', birthday: null })).json().bonusGranted).toBe(BONUS);
  });

  it('T33e the route requires a member', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/me/profile', payload: { name: 'Hamza', birthday: null },
    });
    expect(res.statusCode).toBe(401);
  });

  it('T33f the client cannot ask to be paid', async () => {
    // The body carries a NAME. Extra fields claiming a grant are not read: the
    // reply is what the SERVER decided, and the balance proves it.
    const token = await freshMember(app);
    const res = await save(app, token, {
      name: 'Hamza', birthday: null,
      bonusGranted: 100000, points: 100000, profileBonusAt: null,
    });
    expect(res.json().bonusGranted).toBe(BONUS);
    expect(await balance(app, token)).toBe(BONUS);
  });

  it('T33g a pasted essay is bounded, not rejected', async () => {
    const token = await freshMember(app);
    const res = await save(app, token, { name: 'ا'.repeat(500), birthday: null });
    expect(res.statusCode).toBe(200);
    expect(res.json().profile.name.length).toBe(MAX_NAME_LENGTH);
    expect(res.json().bonusGranted).toBe(BONUS);
  });

  it('T33h an unparseable name is refused at the edge', async () => {
    const token = await freshMember(app);
    expect((await save(app, token, { name: 42 })).statusCode).toBe(400);
    // Genuine abuse is still refused at the edge — a name is a name.
    expect((await save(app, token, { name: 'a'.repeat(9000) })).statusCode).toBe(400);
    expect((await save(app, token, { name: 'x', birthday: '20/04/1990' })).statusCode).toBe(400);
  });
});

describe('T33 the shared predicate', () => {
  it('collapses and bounds a name the same way everywhere', () => {
    expect(normalizeName('  حمزة   خ  ')).toBe('حمزة خ');
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
    expect(normalizeName('a'.repeat(200)).length).toBe(MAX_NAME_LENGTH);
  });

  it('a birthday alone does not complete a profile', () => {
    // Deliberate: gating the bonus on a birthdate would let anyone unwilling to
    // hand one over refuse it, and the owner asked for the name.
    expect(isProfileComplete({ name: '', birthday: '1990-04-20' })).toBe(false);
    expect(isProfileComplete({ name: 'Hamza', birthday: null })).toBe(true);
  });

  it('the dial can switch the bonus off without breaking the save', () => {
    const p = { name: 'Hamza', birthday: null };
    expect(profileBonusFor(p, false, 0)).toBe(0);
    expect(profileBonusFor(p, false, -50)).toBe(0);
    expect(profileBonusFor(p, false, Number.NaN)).toBe(0);
    expect(profileBonusFor(p, false, 50)).toBe(50);
    expect(profileBonusFor(p, true, 50)).toBe(0);
  });
});
