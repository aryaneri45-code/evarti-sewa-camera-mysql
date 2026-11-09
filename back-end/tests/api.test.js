import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { validateEnv } from '../src/config/env.js';
import { closeDatabase, seedDatabase } from '../src/db.js';
import { jakartaDate } from '../src/utils/transactions.js';

const passwords = {
  owner: 'owner-password-long-enough',
  cashier1: 'cashier-one-password-long',
  cashier2: 'cashier-two-password-long',
};
const sessionSecret = 'test-session-secret-with-at-least-32-characters';
const openApps = [];

function makeApp(databasePath = ':memory:') {
  const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evarti-api-test-'));
  const app = createApp({
    databasePath: databasePath === 'persistent' ? path.join(uploadRoot, 'evarti.sqlite') : databasePath,
    passwords,
    sessionSecret,
    uploadRoot,
    frontendOrigin: 'http://localhost:5173',
  });
  openApps.push({ app, uploadRoot });
  return app;
}

async function login(app, username, password = passwords[username]) {
  const agent = request.agent(app);
  const accountPassword = password || passwords[username === 'kasir1' ? 'cashier1' : username === 'kasir2' ? 'cashier2' : username];
  const response = await agent.post('/api/auth/login').send({ username, password: accountPassword });
  return { agent, response, csrfToken: response.body.csrfToken };
}

function rentalPayload(overrides = {}) {
  return {
    location: 'cafe',
    customerName: 'Alya Putri',
    customerWhatsapp: '+6281234567890',
    guaranteeType: 'none',
    cameraId: 'canon-ixus-160',
    durationLabel: '1 Jam',
    durationMinutes: 60,
    startTime: '10:00',
    endTime: '11:00',
    price: 15000,
    isManualPrice: false,
    total: 15000,
    paymentMethod: 'cash',
    amountReceived: 20000,
    ...overrides,
  };
}

beforeEach(() => {
  openApps.length = 0;
});

afterEach(() => {
  for (const { app, uploadRoot } of openApps) {
    closeDatabase(app.locals.db);
    fs.rmSync(uploadRoot, { recursive: true, force: true });
  }
});

test('production environment rejects example credentials and placeholder secrets', () => {
  assert.throws(() => validateEnv({
    sessionSecret: 'replace-with-a-random-secret-at-least-32-characters',
    port: 3000,
    passwords: {
      owner: 'change-this-owner-password',
      cashier1: 'cashier-one-password-long',
      cashier2: 'cashier-two-password-long',
    },
  }), /SESSION_SECRET/);
});

test('login issues HTTP-only sessions and invalid credentials are rejected', async () => {
  const app = makeApp();
  const denied = await request(app).post('/api/auth/login').send({ username: 'owner', password: 'wrong-password' });
  assert.equal(denied.status, 401);
  assert.equal(denied.body.error.code, 'INVALID_CREDENTIALS');

  const { agent, response, csrfToken } = await login(app, 'owner');
  assert.equal(response.status, 200);
  assert.equal(response.body.user.role, 'owner');
  assert.ok(csrfToken);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/i);
  assert.match(response.headers['set-cookie'][0], /SameSite=Strict/i);
  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.username, 'owner');
  assert.equal(me.body.user.name, 'Akbar');
  assert.equal((await request(app).get('/api/cameras')).status, 401);
  const preflightResponse = await request(app)
    .options('/api/cameras/canon-ixus-160')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'DELETE')
    .set('Access-Control-Request-Headers', 'x-csrf-token');

  assert.equal(preflightResponse.status, 204);
  assert.match(preflightResponse.headers['access-control-allow-methods'], /\bDELETE\b/);
  assert.equal(preflightResponse.headers['access-control-allow-origin'], 'http://localhost:5173');
});

test('existing account names are synchronized with the login profiles', () => {
  const app = makeApp();
  const db = app.locals.db;
  db.prepare("UPDATE users SET name = 'Old name'").run();

  seedDatabase(db);

  assert.deepEqual(
    db.prepare('SELECT username, name FROM users ORDER BY username').all(),
    [
      { username: 'kasir1', name: 'Tanada' },
      { username: 'kasir2', name: 'Stand' },
      { username: 'owner', name: 'Akbar' },
    ],
  );
});

test('cashier location is enforced by role and cashier data is isolated', async () => {
  const app = makeApp();
  const cashierOne = await login(app, 'kasir1');
  const cashierTwo = await login(app, 'kasir2');

  const missingCsrf = await cashierOne.agent.post('/api/transactions').send(rentalPayload());
  assert.equal(missingCsrf.status, 403);

  const created = await cashierOne.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashierOne.csrfToken)
    .send(rentalPayload({ location: 'event', customerPagerNumber: 'P-07' }));
  assert.equal(created.status, 201);
  assert.equal(created.body.transaction.location, 'cafe');
  assert.match(created.body.transaction.receiptNo, /^CAF-\d{8}-001$/);
  assert.equal(created.body.transaction.customerWhatsapp, '081234567890');
  assert.equal(created.body.transaction.customerPagerNumber, 'P-07');

  const eventCreated = await cashierTwo.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashierTwo.csrfToken)
    .send(rentalPayload({ location: 'cafe', customerName: 'Rani', cameraId: 'canon-ixus-160' }));
  assert.equal(eventCreated.status, 201);
  assert.equal(eventCreated.body.transaction.location, 'event');
  assert.match(eventCreated.body.transaction.receiptNo, /^EVT-\d{8}-001$/);

  const cashierOneList = await cashierOne.agent.get('/api/transactions');
  const cashierTwoList = await cashierTwo.agent.get('/api/transactions');
  assert.equal(cashierOneList.body.transactions.length, 1);
  assert.equal(cashierTwoList.body.transactions.length, 1);
  assert.equal(cashierOneList.body.transactions[0].customerName, 'Alya Putri');
  assert.equal(cashierOneList.body.transactions[0].customerPagerNumber, 'P-07');
  assert.equal(cashierTwoList.body.transactions[0].customerName, 'Rani');
  assert.equal((await cashierTwo.agent.get(`/api/transactions/${created.body.transaction.id}`)).status, 404);
  assert.equal((await cashierOne.agent.get('/api/cameras')).body.cameras.length, 14);
});

test('one transaction can include multiple cameras with independent durations and summed prices', async () => {
  const app = makeApp();
  const cashier = await login(app, 'kasir1');
  const created = await cashier.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send(rentalPayload({
      items: [
        { cameraId: 'canon-ixus-160', durationMinutes: 120, price: 23000, isManualPrice: false },
        { cameraId: 'olympus-mtough-8010', durationMinutes: 60, price: 15000, isManualPrice: false },
      ],
      durationMinutes: 120,
      durationLabel: '2 Jam',
      endTime: '12:00',
      price: 38000,
      total: 38000,
      amountReceived: 50000,
    }));

  assert.equal(created.status, 201);
  assert.equal(created.body.transaction.total, 38000);
  assert.equal(created.body.transaction.endTime, '12:00');
  assert.deepEqual(created.body.transaction.items.map(({ cameraId, durationLabel, price }) => ({
    cameraId,
    durationLabel,
    price,
  })), [
    { cameraId: 'canon-ixus-160', durationLabel: '2 Jam', price: 23000 },
    { cameraId: 'olympus-mtough-8010', durationLabel: '1 Jam', price: 15000 },
  ]);

  const history = await cashier.agent.get('/api/transactions');
  assert.equal(history.body.transactions[0].items.length, 2);
  const report = await cashier.agent.get('/api/reports/summary');
  assert.deepEqual(report.body.popularCameras.map(({ cameraId, rentalCount, revenue }) => ({
    cameraId,
    rentalCount,
    revenue,
  })).sort((a, b) => a.cameraId.localeCompare(b.cameraId)), [
    { cameraId: 'canon-ixus-160', rentalCount: 1, revenue: 23000 },
    { cameraId: 'olympus-mtough-8010', rentalCount: 1, revenue: 15000 },
  ]);
});

test('addon selections are priced from the catalog and remain unchanged in transaction history', async () => {
  const app = makeApp();
  const cashier = await login(app, 'kasir1');
  const owner = await login(app, 'owner');
  const availableAddons = await cashier.agent.get('/api/addons');
  assert.equal(availableAddons.status, 200);
  assert.equal(availableAddons.body.addons.length, 13);

  const selectedAddonIds = ['Analog A', 'fotografer-10', 'print-5', 'Airdrop/Local Send'];
  const created = await cashier.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send(rentalPayload({
      addonIds: selectedAddonIds,
      total: 73000,
      amountReceived: 75000,
    }));
  assert.equal(created.status, 201);
  assert.equal(created.body.transaction.price, 15000);
  assert.equal(created.body.transaction.total, 73000);
  assert.equal(created.body.transaction.change, 2000);
  assert.deepEqual(created.body.transaction.addons.map(({ id, price }) => ({ id, price })), [
    { id: 'Analog A', price: 10000 },
    { id: 'fotografer-10', price: 18000 },
    { id: 'print-5', price: 25000 },
    { id: 'Airdrop/Local Send', price: 5000 },
  ]);

  const catalog = (await owner.agent.get('/api/addons')).body.addons;
  const updatedCatalog = catalog.map((addon) => addon.id === 'Analog A'
    ? { ...addon, label: 'Analog A premium', price: 13000 }
    : addon);
  const updated = await owner.agent.put('/api/addons')
    .set('X-CSRF-Token', owner.csrfToken)
    .send({ addons: updatedCatalog });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));

  const history = await cashier.agent.get(`/api/transactions/${created.body.transaction.id}`);
  assert.equal(history.body.transaction.total, 73000);
  assert.equal(history.body.transaction.addons[0].label, 'Analog A');
  assert.equal(history.body.transaction.addons[0].price, 10000);

  const invalid = await cashier.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send(rentalPayload({
      addonIds: ['fotografer-5', 'fotografer-10'],
      total: 43000,
      amountReceived: 40000,
    }));
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');

  const stalePrice = await cashier.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send(rentalPayload({
      addonIds: ['Analog A'],
      total: 25000,
      amountReceived: 28000,
    }));
  assert.equal(stalePrice.status, 400);
  assert.equal(stalePrice.body.error.code, 'PRICE_MISMATCH');

  const cashierCannotEditAddons = await cashier.agent.put('/api/addons')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send({ addons: updatedCatalog });
  assert.equal(cashierCannotEditAddons.status, 403);

  const createdAddon = await owner.agent.post('/api/addons')
    .set('X-CSRF-Token', owner.csrfToken)
    .send({ category: 'property', label: 'Lampu portable', price: 8000 });
  assert.equal(createdAddon.status, 201);
  assert.equal(createdAddon.body.addon.label, 'Lampu portable');
  assert.equal(createdAddon.body.addon.price, 8000);
  const cashierCannotDeleteAddon = await cashier.agent.delete(`/api/addons/${createdAddon.body.addon.id}`)
    .set('X-CSRF-Token', cashier.csrfToken);
  assert.equal(cashierCannotDeleteAddon.status, 403);
  const deletedAddon = await owner.agent.delete(`/api/addons/${createdAddon.body.addon.id}`)
    .set('X-CSRF-Token', owner.csrfToken);
  assert.equal(deletedAddon.status, 204);
});

test('manual add-ons are validated, totaled and retained in transaction snapshots after restart', async () => {
  let app = makeApp('persistent');
  const databasePath = app.locals.db.name;
  let cashier = await login(app, 'kasir1');
  const catalog = (await cashier.agent.get('/api/addons')).body.addons;
  const created = await cashier.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send(rentalPayload({
      addonIds: ['Analog A'],
      manualAddon: { label: '  Transfer 200 foto  ', price: 12000 },
      total: 37000, amountReceived: 40000,
    }));
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const saved = created.body.transaction;
  assert.equal(saved.total, 37000);
  assert.equal(saved.change, 3000);
  assert.equal(saved.addons.length, 2);
  assert.deepEqual(saved.addons[0], { id: 'Analog A', category: 'property', label: 'Analog A', price: 10000 });
  const manual = saved.addons[1];
  assert.match(manual.id, /^manual-addon-/);
  assert.equal(manual.isManual, true);
  assert.equal(manual.label, 'Transfer 200 foto');
  assert.equal(manual.price, 12000);
  assert.deepEqual((await cashier.agent.get('/api/addons')).body.addons, catalog);
  assert.equal(app.locals.db.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'manual_addon_created' AND transaction_id = ?").get(saved.id).count, 1);

  const invalidManualAddons = [
    [], 'invalid', { label: '', price: 1000 }, { label: '   ', price: 1000 },
    { label: 'a'.repeat(101), price: 1000 }, { label: 'Transfer', price: -1 },
    { label: 'Transfer', price: 1.5 }, { label: 'Transfer', price: '1000' },
    { label: 'Transfer' }, { label: 'Transfer', price: 100000001 },
  ];
  for (const manualAddon of invalidManualAddons) {
    const invalid = await cashier.agent.post('/api/transactions')
      .set('X-CSRF-Token', cashier.csrfToken)
      .send(rentalPayload({ manualAddon }));
    assert.equal(invalid.status, 400, JSON.stringify(manualAddon));
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
  }
  const incorrectTotal = await cashier.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send(rentalPayload({ manualAddon: { label: 'Transfer', price: 1000 } }));
  assert.equal(incorrectTotal.status, 400);
  assert.equal(incorrectTotal.body.error.code, 'PRICE_MISMATCH');
  const excessiveTotal = await cashier.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send(rentalPayload({ manualAddon: { label: 'Transfer', price: 100000000 }, total: 100015000, amountReceived: 100015000 }));
  assert.equal(excessiveTotal.status, 400);
  assert.equal(excessiveTotal.body.error.code, 'VALIDATION_ERROR');
  const free = await cashier.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send(rentalPayload({ manualAddon: { label: 'Transfer gratis', price: 0 }, paymentMethod: 'qris_dana' }));
  assert.equal(free.status, 201);
  assert.equal(free.body.transaction.paymentStatus, 'pending_verification');
  assert.equal(free.body.transaction.addons[0].price, 0);

  closeDatabase(app.locals.db);
  app = makeApp(databasePath);
  cashier = await login(app, 'kasir1');
  const restored = await cashier.agent.get(`/api/transactions/${saved.id}`);
  assert.equal(restored.status, 200);
  assert.deepEqual(restored.body.transaction.addons, saved.addons);
  assert.equal(restored.body.transaction.total, 37000);
  assert.equal((await cashier.agent.post(`/api/transactions/${saved.id}/print`)
    .set('X-CSRF-Token', cashier.csrfToken)).status, 200);
});

test('addon edits, additions, deletions and an empty catalog survive database restarts', async () => {
  let app = makeApp('persistent');
  const databasePath = app.locals.db.name;
  let owner = await login(app, 'owner');
  const catalog = (await owner.agent.get('/api/addons')).body.addons;
  assert.equal(catalog.length, 13);
  const updated = await owner.agent.put('/api/addons')
    .set('X-CSRF-Token', owner.csrfToken)
    .send({ addons: catalog.map((addon) => addon.id === 'Analog A'
      ? { ...addon, label: 'Properti premium', price: 17000, active: false }
      : addon) });
  assert.equal(updated.status, 200);
  const created = await owner.agent.post('/api/addons')
    .set('X-CSRF-Token', owner.csrfToken)
    .send({ category: 'transfer', label: 'Flash drive', price: 7000 });
  assert.equal(created.status, 201);
  assert.equal((await owner.agent.delete('/api/addons/fotografer-5')
    .set('X-CSRF-Token', owner.csrfToken)).status, 204);
  const expected = (await owner.agent.get('/api/addons')).body.addons;

  closeDatabase(app.locals.db);
  app = makeApp(databasePath);
  owner = await login(app, 'owner');
  const restored = (await owner.agent.get('/api/addons')).body.addons;
  assert.deepEqual(restored, expected);

  // Deleting every choice must not be mistaken for a fresh installation.
  for (const addon of restored) {
    assert.equal((await owner.agent.delete(`/api/addons/${encodeURIComponent(addon.id)}`)
      .set('X-CSRF-Token', owner.csrfToken)).status, 204);
  }
  closeDatabase(app.locals.db);
  app = makeApp(databasePath);
  owner = await login(app, 'owner');
  assert.deepEqual((await owner.agent.get('/api/addons')).body.addons, []);
});

test('pager number is optional and limited to 40 characters', async () => {
  const app = makeApp();
  const cashier = await login(app, 'kasir1');
  const withoutPager = await cashier.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send(rentalPayload());
  assert.equal(withoutPager.status, 201);
  assert.equal(withoutPager.body.transaction.customerPagerNumber, null);

  const tooLong = await cashier.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send(rentalPayload({ customerPagerNumber: 'P'.repeat(41) }));
  assert.equal(tooLong.status, 400);
  assert.equal(tooLong.body.error.code, 'VALIDATION_ERROR');
});

test('server validates catalog prices, WhatsApp, manual duration and cash payment', async () => {
  const app = makeApp();
  const cashier = await login(app, 'kasir1');
  const invalids = [
    rentalPayload({ customerWhatsapp: '08123' }),
    rentalPayload({ price: 1, total: 1 }),
    rentalPayload({ amountReceived: 100 }),
    rentalPayload({ durationMinutes: 180, durationLabel: '3 Jam', endTime: '13:00' }),
    rentalPayload({ durationMinutes: 120, durationLabel: '2 Jam', endTime: '12:00', isManualPrice: true, price: 30000, total: 30000 }),
  ];

  for (const payload of invalids) {
    const response = await cashier.agent.post('/api/transactions')
      .set('X-CSRF-Token', cashier.csrfToken)
      .send(payload);
    assert.equal(response.status, 400);
  }

  const validManual = await cashier.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send(rentalPayload({
      durationLabel: '3 Jam',
      durationMinutes: 180,
      endTime: '13:00',
      isManualPrice: true,
      price: 45000,
      total: 45000,
      amountReceived: 50000,
      manualNote: '',
    }));
  assert.equal(validManual.status, 201);
  assert.equal(validManual.body.transaction.isManualPrice, true);
  assert.equal(validManual.body.transaction.change, 5000);
});

test('QRIS can only print after verification and verifies with audit trail', async () => {
  const app = makeApp();
  const cashier = await login(app, 'kasir1');
  const created = await cashier.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send(rentalPayload({ paymentMethod: 'qris_dana', amountReceived: undefined }));
  assert.equal(created.status, 201);
  assert.equal(created.body.transaction.paymentStatus, 'pending_verification');

  const printPending = await cashier.agent.post(`/api/transactions/${created.body.transaction.id}/print`)
    .set('X-CSRF-Token', cashier.csrfToken);
  assert.equal(printPending.status, 409);

  const verified = await cashier.agent.patch(`/api/transactions/${created.body.transaction.id}/verify`)
    .set('X-CSRF-Token', cashier.csrfToken)
    .send({});
  assert.equal(verified.status, 200);
  assert.equal(verified.body.transaction.paymentStatus, 'paid');
  assert.equal(verified.body.transaction.verifiedBy, 'Tanada');

  const printed = await cashier.agent.post(`/api/transactions/${created.body.transaction.id}/print`)
    .set('X-CSRF-Token', cashier.csrfToken);
  assert.equal(printed.status, 200);
  assert.equal(printed.body.transaction.printedCount, 1);

  const owner = await login(app, 'owner');
  const logs = await owner.agent.get('/api/audit-logs');
  assert.deepEqual(logs.body.logs.map((log) => log.action).sort(), ['qris_verified', 'receipt_reprinted']);
  const cashierCannotAudit = await cashier.agent.get('/api/audit-logs');
  assert.equal(cashierCannotAudit.status, 403);
});

test('owner catalog edits do not alter transaction snapshots and owner can void with reason', async () => {
  const app = makeApp();
  const cashier = await login(app, 'kasir1');
  const created = await cashier.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send(rentalPayload());
  const owner = await login(app, 'owner');

  const updatedCamera = await owner.agent.put('/api/cameras/canon-ixus-160')
    .set('X-CSRF-Token', owner.csrfToken)
    .send({ name: 'Canon Ixus 160 Updated', price1: 18000, price2: 22000 });
  assert.equal(updatedCamera.status, 200);
  const history = await cashier.agent.get(`/api/transactions/${created.body.transaction.id}`);
  assert.equal(history.body.transaction.cameraName, 'Canon Ixus 160');
  assert.equal(history.body.transaction.total, 15000);

  const cashierCannotEditCatalog = await cashier.agent.put('/api/cameras/canon-ixus-160')
    .set('X-CSRF-Token', cashier.csrfToken)
    .send({ name: 'Unauthorized', price1: 1, price2: 2 });
  assert.equal(cashierCannotEditCatalog.status, 403);
  const cashierCannotDeleteCamera = await cashier.agent.delete('/api/cameras/canon-ixus-160')
    .set('X-CSRF-Token', cashier.csrfToken);
  assert.equal(cashierCannotDeleteCamera.status, 403);
  const deletedCamera = await owner.agent.delete('/api/cameras/canon-ixus-160')
    .set('X-CSRF-Token', owner.csrfToken);
  assert.equal(deletedCamera.status, 204);
  const historyAfterDelete = await cashier.agent.get(`/api/transactions/${created.body.transaction.id}`);
  assert.equal(historyAfterDelete.body.transaction.cameraName, 'Canon Ixus 160');
  assert.equal(historyAfterDelete.body.transaction.items[0].cameraName, 'Canon Ixus 160');

  const noReason = await owner.agent.patch(`/api/transactions/${created.body.transaction.id}/void`)
    .set('X-CSRF-Token', owner.csrfToken)
    .send({ reason: '' });
  assert.equal(noReason.status, 400);
  const voided = await owner.agent.patch(`/api/transactions/${created.body.transaction.id}/void`)
    .set('X-CSRF-Token', owner.csrfToken)
    .send({ reason: 'Transaksi dibuat ganda' });
  assert.equal(voided.status, 200);
  assert.equal(voided.body.transaction.paymentStatus, 'void');
  assert.equal(voided.body.transaction.voidReason, 'Transaksi dibuat ganda');
});

test('sensitive guarantee fields are omitted from list and cashier cannot open another cashier file', async () => {
  const app = makeApp();
  const cashierOne = await login(app, 'kasir1');
  const cashierTwo = await login(app, 'kasir2');
  const created = await cashierOne.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashierOne.csrfToken)
    .send(rentalPayload({ guaranteeType: 'id_number', guaranteeIdNumber: 'ID-123456' }));
  assert.equal(created.status, 201);
  assert.equal(created.body.transaction.guaranteeIdNumber, 'ID-123456');
  const list = await cashierOne.agent.get('/api/transactions');
  assert.equal(Object.hasOwn(list.body.transactions[0], 'guaranteeIdNumber'), false);
  assert.equal((await cashierTwo.agent.get(`/api/transactions/${created.body.transaction.id}`)).status, 404);
  const invalidGuarantee = await cashierOne.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashierOne.csrfToken)
    .send(rentalPayload({ guaranteeType: 'id_number' }));
  assert.equal(invalidGuarantee.status, 400);
});

test('private guarantee photos are only returned to the transaction owner or cashier creator', async () => {
  const app = makeApp();
  const cashierOne = await login(app, 'kasir1');
  const cashierTwo = await login(app, 'kasir2');
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const created = await cashierOne.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashierOne.csrfToken)
    .field('payload', JSON.stringify(rentalPayload({ guaranteeType: 'photo' })))
    .attach('guaranteePhoto', pngSignature, { filename: 'guarantee.png', contentType: 'image/png' });
  assert.equal(created.status, 201);
  const privatePhotoUrl = created.body.transaction.guaranteePhotoUrl;
  assert.ok(privatePhotoUrl);
  assert.equal((await cashierOne.agent.get(privatePhotoUrl)).status, 200);
  assert.equal((await cashierTwo.agent.get(privatePhotoUrl)).status, 404);
  assert.equal((await cashierTwo.agent.get('/uploads/private')).status, 404);

  const mismatchedImage = await cashierOne.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashierOne.csrfToken)
    .field('payload', JSON.stringify(rentalPayload({ guaranteeType: 'photo' })))
    .attach('guaranteePhoto', Buffer.from('<script>no</script>'), { filename: 'bad.png', contentType: 'image/png' });
  assert.equal(mismatchedImage.status, 400);
  assert.equal(mismatchedImage.body.error.code, 'INVALID_IMAGE');
});

test('reports are role-scoped and owner can download a PDF summary', async () => {
  const app = makeApp();
  const cashierOne = await login(app, 'kasir1');
  const cashierTwo = await login(app, 'kasir2');
  await cashierOne.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashierOne.csrfToken)
    .send(rentalPayload());
  await cashierTwo.agent.post('/api/transactions')
    .set('X-CSRF-Token', cashierTwo.csrfToken)
    .send(rentalPayload({ customerName: 'Rani' }));

  const date = jakartaDate();
  const cashierSummary = await cashierOne.agent.get(`/api/reports/summary?date=${date}`);
  assert.equal(cashierSummary.status, 200);
  assert.equal(cashierSummary.body.totals.transactionCount, 1);
  assert.equal(cashierSummary.body.totals.revenue, 15000);

  const owner = await login(app, 'owner');
  const ownerSummary = await owner.agent.get(`/api/reports/summary?date=${date}`);
  assert.equal(ownerSummary.body.totals.transactionCount, 2);
  assert.equal(ownerSummary.body.totals.revenue, 30000);
  const defaultSummary = await owner.agent.get('/api/reports/summary');
  assert.equal(defaultSummary.status, 200);
  assert.equal(defaultSummary.body.period.to, date);
  assert.equal(defaultSummary.body.totals.transactionCount, 2);
  const dailySummary = await owner.agent.get(`/api/reports/summary?period=daily&date=${date}`);
  assert.equal(dailySummary.status, 200);
  assert.deepEqual(dailySummary.body.period, { from: date, to: date });
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const monday = new Date(`${date}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const weeklySummary = await owner.agent.get(`/api/reports/summary?period=weekly&date=${date}`);
  assert.equal(weeklySummary.status, 200);
  assert.deepEqual(weeklySummary.body.period, {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
  });
  const monthlySummary = await owner.agent.get(`/api/reports/summary?period=monthly&date=${date}`);
  assert.equal(monthlySummary.status, 200);
  assert.deepEqual(monthlySummary.body.period, {
    from: `${date.slice(0, 7)}-01`,
    to: `${date.slice(0, 7)}-${String(new Date(Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)),
      0,
    )).getUTCDate()).padStart(2, '0')}`,
  });
  const invalidPeriod = await owner.agent.get(`/api/reports/summary?period=yearly&date=${date}`);
  assert.equal(invalidPeriod.status, 400);
  const pdf = await owner.agent.get(`/api/reports/summary/pdf?date=${date}`);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers['content-type'], /application\/pdf/);
  assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');
});
