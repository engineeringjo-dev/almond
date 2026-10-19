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

class ConnectionLost extends Error {}
const SETTLED = { ok: true, redemptionId: 'redemption-a', valueJod: 2, points: 200 };
const FRESH_QR = 'a'.repeat(32) + '.' + 'b'.repeat(32);

// `rpc` given: the real _almondCall runs against it. Otherwise _almondCall is
// replaced and answers `response`.
function till(response = SETTLED, rpc = null) {
    class Store {}
    const warnings = [];
    const notes = [];
    const dialogs = [];
    vm.runInNewContext(storeSource, {
        patch: (prototype, methods) => Object.assign(prototype, methods), PosStore: Store,
        rpc: rpc || (async () => { throw new Error('must-not-log-credential'); }),
        ConnectionLostError: ConnectionLost, _t: (text) => text,
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
        dialog: { add: (component, props) => dialogs.push(props) },
        notification: { add: (message) => notes.push(message) },
    });
    const calls = [];
    const originalCall = pos._almondCall.bind(pos);
    if (!rpc) pos._almondCall = async (route, body) => { calls.push({ route, body }); return response; };
    return { pos, order, payments, calls, warnings, originalCall, notes, dialogs };
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

// Review 2026-10-19, item 4: once the settle request has left the till, the
// server may already have spent the redemption. "Continue without Almond"
// would lose the member's value; the same order and original credential
// replay the recorded answer (docs/REDEMPTION-BARCODE-120S.md).
const SOURCES = [
    [{ fromScan: true }, "Press 'Use it' again on this order before any other payment."],
    [{ token: FRESH_QR }, "Press 'Apply' again with the same QR on this order before any other payment."],
];

test('a settle whose reply is lost is "not confirmed", never "continue without Almond"', async () => {
    for (const lost of [() => new ConnectionLost(), () => new Error('server error after the settle')]) {
        for (const [source, retry] of SOURCES) {
            const instance = till(undefined, async () => { throw lost(); });
            const res = await instance.pos.almondSettleRedemption(source);
            assert.equal(res.ok, false);
            assert.equal(res.error, 'unconfirmed');
            assert.doesNotMatch(res.message, /without|continue/i);
            assert.match(res.message, /^The redemption is not confirmed\./);
            assert.ok(res.message.includes(retry), res.message);
            assert.ok(res.message.includes('Do not ask for a new QR.'), res.message);
            assert.deepEqual(instance.notes, [res.message]);
            assert.deepEqual(instance.payments, []);
        }
    }
});

test('the retry after a lost settle reply sends the same order and source and adds one tender', async () => {
    for (const [source] of SOURCES) {
        const sent = [];
        let first = true;
        const instance = till(undefined, async (route, body) => {
            sent.push({ route, body });
            if (first) { first = false; throw new ConnectionLost(); }
            return SETTLED;
        });
        assert.equal((await instance.pos.almondSettleRedemption(source)).error, 'unconfirmed');
        assert.equal((await instance.pos.almondSettleRedemption(source)).ok, true);
        assert.equal(sent.length, 2);
        assert.deepEqual(sent[0], sent[1]);
        assert.deepEqual(instance.payments, [2]);
    }
});

test('a member scan, which spends nothing, still says continue the sale without Almond', async () => {
    const instance = till(undefined, async () => { throw new ConnectionLost(); });
    const res = await instance.pos.almondScanMember('opaque-member-qr');
    assert.equal(res.error, 'offline');
    assert.match(res.message, /Continue the sale without Almond/);
});

test('a settled redemption the bill could not take names the retry of its own source', async () => {
    for (const [source, retry] of SOURCES) {
        const instance = till();
        instance.order.addPaymentline = () => ({ status: false, data: 'temporarily unavailable' });
        const res = await instance.pos.almondSettleRedemption(source);
        assert.equal(res.ok, false);
        assert.ok(res.message.startsWith(retry.slice(0, -1)), res.message);
        assert.ok(instance.dialogs[0].body.includes(retry.slice(0, -1)), instance.dialogs[0].body);
        assert.doesNotMatch(res.message + instance.dialogs[0].body, /Retry the same QR|without/);
    }
});
