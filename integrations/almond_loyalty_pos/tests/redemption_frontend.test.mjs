import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const app = new URL('../static/src/app/', import.meta.url);
const utilsSource = readFileSync(new URL('almond_loyalty_utils.js', app), 'utf8');
const utils = await import(`data:text/javascript;base64,${Buffer.from(utilsSource).toString('base64')}`);
const storeSource = readFileSync(new URL('pos_store_patch.js', app), 'utf8').replace(/^import[^\n]*\n/gm, '');

function till(response = { ok: true, redemptionId: 'redemption-a', valueJod: 2, points: 200 }) {
    class Store {}
    const warnings = [];
    vm.runInNewContext(storeSource, {
        patch: (prototype, methods) => Object.assign(prototype, methods), PosStore: Store,
        rpc: async () => { throw new Error('must-not-log-credential'); },
        ConnectionLostError: class extends Error {}, _t: (text) => text,
        AlertDialog: class {}, ask: async () => true, roundJod: utils.roundJod,
        console: { warn: (...args) => warnings.push(args) },
    });
    const payments = [];
    const order = {
        uuid: 'order-a', remainingDue: 5, uiState: {}, payment_ids: [],
        addPaymentline: (method) => {
            const line = { payment_method_id: method, amount: 0,
                update: (values) => Object.assign(line, values),
                setAmount: (amount) => { line.amount = amount; payments.push(amount); order.remainingDue -= amount; },
            };
            order.payment_ids.push(line);
            return { status: true, data: line };
        },
    };
    const pos = new Store();
    Object.assign(pos, {
        config: { almond_loyalty_enabled: true, payment_method_ids: [{ almond_is_redemption: true }] },
        session: { id: 1 }, getOrder: () => order,
        dialog: { add: () => {} }, notification: { add: () => {} },
    });
    const calls = [];
    const originalCall = pos._almondCall.bind(pos);
    pos._almondCall = async (route, body) => { calls.push({ route, body }); return response; };
    return { pos, order, payments, calls, warnings, originalCall };
}

test('only a QR-shaped input is accepted; typed points and gift codes cannot settle', () => {
    for (const code of ['AB2C-D3EF', 'ab2cd3ef', ' ab2c d3ef ', '12345678', 'GIFT-1234']) {
        assert.equal(utils.classifyAlmondInput(code), null);
    }
    assert.equal(utils.classifyAlmondInput('a'.repeat(32) + '.' + 'b'.repeat(32)), 'token');
});

test('a recovered settlement applies only one payment and one local identity', async () => {
    const { pos, order, payments, calls } = till();
    await Promise.all([pos.almondSettleRedemption({ fromScan: true }), pos.almondSettleRedemption({ fromScan: true })]);
    assert.deepEqual(payments, [2]);
    assert.equal(order.uiState.almondLoyalty.settled.length, 1);
    assert.equal(order.uiState.almondLoyalty.settled[0].redemptionId, 'redemption-a');
    assert.equal(order.uiState.almondLoyalty.settled[0].applied, true);
    assert.equal(calls[0].body.order_uuid, 'order-a');
    assert.equal('code' in calls[0].body, false);
});

test('a lost response can be recovered and a failed local line can be retried without duplicating the ledger value', async () => {
    const { pos, order, payments } = till();
    const add = order.addPaymentline;
    order.addPaymentline = () => ({ status: false, data: 'temporarily unavailable' });
    await pos.almondSettleRedemption({ fromScan: true });
    assert.equal(order.uiState.almondLoyalty.settled[0].applied, false);
    order.addPaymentline = add;
    await pos.almondSettleRedemption({ fromScan: true });
    assert.deepEqual(payments, [2]);
    assert.equal(order.uiState.almondLoyalty.settled.length, 1);
});

test('persisted payment identity prevents a second tender after draft hydration loses all uiState', async () => {
    const { pos, order, payments } = till();
    await pos.almondSettleRedemption({ fromScan: true });
    // Normal Python payment fields survive ORM/IndexedDB serialization; this
    // fixture round-trip intentionally discards functions AND the entire UI hint.
    order.payment_ids = JSON.parse(JSON.stringify(order.payment_ids));
    order.uiState = {};
    assert.equal(order.payment_ids[0].almond_redemption_id, 'redemption-a');
    assert.equal((await pos.almondSettleRedemption({ fromScan: true })).ok, true);
    assert.deepEqual(payments, [2]);
    assert.equal(order.payment_ids.length, 1);
});

test('identityless legacy tender, mismatched tender and applied-with-missing-line fail closed', async () => {
    const unknown = till();
    unknown.order.payment_ids.push({ payment_method_id: { almond_is_redemption: true }, amount: 2 });
    assert.equal((await unknown.pos.almondSettleRedemption({ fromScan: true })).ok, false);
    assert.equal(unknown.calls.length, 0);
    const mismatch = till();
    mismatch.order.payment_ids.push({ payment_method_id: { almond_is_redemption: true }, amount: 3, almond_redemption_id: 'redemption-a' });
    assert.equal((await mismatch.pos.almondSettleRedemption({ fromScan: true })).ok, false);
    assert.deepEqual(mismatch.payments, []);
    const missing = till();
    missing.order.uiState.almondLoyalty = { settled: [{ redemptionId: 'redemption-a', valueJod: 2, applied: true }] };
    assert.equal((await missing.pos.almondSettleRedemption({ fromScan: true })).ok, false);
    assert.deepEqual(missing.payments, []);
});

test('typed source, missing identity and refused/expired server result never add tender', async () => {
    const typed = till();
    assert.equal((await typed.pos.almondSettleRedemption({ code: 'ABCD-EFGH' })).ok, false);
    assert.equal(typed.calls.length, 0);
    for (const response of [{ ok: true, valueJod: 2 }, { ok: false, error: 'qr_expired' }, { ok: false, error: 'offline' }]) {
        const instance = till(response);
        assert.equal((await instance.pos.almondSettleRedemption({ fromScan: true })).ok, false);
        assert.deepEqual(instance.payments, []);
    }
});

test('ordinary member scan is unaffected and failure logging excludes the error object', async () => {
    const instance = till({ ok: true, mode: 'pay', memberRef: 'member', earnsPoints: true });
    assert.equal((await instance.pos.almondScanMember('opaque-member-qr')).ok, true);
    assert.equal(instance.order.uiState.almondLoyalty.memberRef, 'member');
    await instance.originalCall('/almond_loyalty/settle', { token: 'must-not-log-credential' });
    assert.deepEqual(instance.warnings, [['Almond loyalty call failed', '/almond_loyalty/settle']]);
});
