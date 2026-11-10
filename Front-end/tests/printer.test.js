import test from 'node:test';
import assert from 'node:assert/strict';
import { PrinterManager, PRINTER_STORAGE_KEY, testReceipt } from '../src/services/printer.js';
import { encodeRaster, monochromeRaster, printGeometry } from '../src/services/receipt-encoder.js';

const sampleRaster = encodeRaster({ width: 8, height: 1, data: Uint8ClampedArray.from([
  0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
  255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255,
]) });

function setup({ ports = [], storage = '{}', userAgent = 'Desktop Chrome' } = {}) {
  const saved = new Map([[PRINTER_STORAGE_KEY, storage]]);
  const calls = { dialogs: 0, chooser: 0, locations: [], renders: [] };
  const environment = {
    isSecureContext: true, btoa,
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    navigator: { userAgent, serial: { getPorts: async () => ports, requestPort: async () => { calls.chooser++; return ports.at(-1); } } },
    print: () => calls.dialogs++, location: { assign: url => calls.locations.push(url) },
  };
  const rasterize = async (...args) => { calls.renders.push(args); return sampleRaster; };
  return { manager: new PrinterManager(environment, rasterize), calls, saved, environment };
}
function mockPort(info = { bluetoothServiceClassId: '00001101-0000-1000-8000-00805f9b34fb' }) {
  const writes = [];
  const port = {
    opens: 0, closes: 0, locksReleased: 0, writes, connected: true, writable: null,
    getInfo: () => info,
    async open(options) {
      port.opens++; port.options = options;
      port.writable = { getWriter: () => ({
        write: async bytes => writes.push(...bytes),
        releaseLock: () => port.locksReleased++,
      }) };
    },
    async close() { port.closes++; port.writable = null; },
  };
  return port;
}

test('defaults and persisted choices work independently of a printer brand', () => {
  const { manager, saved } = setup({ storage: '{malformed' });
  assert.equal(manager.state.settings.mode, 'browser');
  assert.equal(manager.state.settings.paperWidth, 58);
  manager.configure({ paperWidth: 80, label: 'Kasir Cafe' });
  const restored = setup({ storage: saved.get(PRINTER_STORAGE_KEY) }).manager;
  assert.equal(restored.state.settings.paperWidth, 80);
  assert.equal(restored.state.settings.label, 'Kasir Cafe');
});

test('browser printing uses only the system dialog and rejects unpaid transactions', async () => {
  const { manager, calls } = setup();
  assert.equal(await manager.print(testReceipt), 'dialog');
  assert.equal(calls.dialogs, 1);
  assert.equal(calls.renders.length, 0);
  await assert.rejects(manager.print({ ...testReceipt, paymentStatus: 'pending_verification' }), /lunas/);
  assert.equal(calls.dialogs, 1);
});

test('choosing a replacement printer closes the old port and prints only to the new device', async () => {
  const oldPort = mockPort({ usbVendorId: 1 });
  const newPort = mockPort({ usbVendorId: 2 });
  const ports = [oldPort];
  const { manager } = setup({ ports });
  manager.configure({ mode: 'serial' });
  await manager.connect(true);
  ports.push(newPort);
  await manager.connect(true);
  assert.equal(oldPort.closes, 1);
  assert.equal(await manager.print(testReceipt), 'sent');
  assert.equal(oldPort.writes.length, 0);
  assert.ok(newPort.writes.length > 0);
  assert.equal(newPort.locksReleased, 1);
});

test('reconnect uses an authorized saved device without opening the chooser', async () => {
  const port = mockPort();
  const first = setup({ ports: [port] });
  first.manager.configure({ mode: 'serial' });
  await first.manager.connect(true);
  await first.manager.disconnect();
  const second = setup({ ports: [port], storage: first.saved.get(PRINTER_STORAGE_KEY) });
  await second.manager.reconnect();
  assert.equal(second.calls.chooser, 0);
  assert.equal(second.manager.state.status, 'connected');
  assert.equal(port.opens, 2);
});

test('auto reconnect respects disabled settings and unavailable wireless devices', async () => {
  const port = mockPort();
  const { manager } = setup({ ports: [port] });
  manager.configure({ mode: 'serial' });
  await manager.connect(true);
  await manager.disconnect();
  manager.configure({ autoReconnect: false });
  await manager.reconnect();
  assert.equal(port.opens, 1);
  manager.configure({ autoReconnect: true });
  port.connected = false;
  await manager.reconnect();
  assert.equal(port.opens, 1);
  await manager.connect();
  assert.equal(port.opens, 2);
});

test('ambiguous or missing devices require selection and do not get stuck reconnecting', async () => {
  const port = mockPort();
  const ports = [port];
  const { manager } = setup({ ports });
  manager.configure({ mode: 'serial' });
  await assert.rejects(manager.connect(), /Pilih printer/);
  await manager.connect(true);
  await manager.disconnect();
  ports.push(mockPort());
  await assert.rejects(manager.connect(), /beberapa perangkat/);
  ports.pop();
  await manager.connect();
  assert.equal(manager.state.status, 'connected');
});

test('partial write failure releases the port and never opens a fallback print dialog', async () => {
  const port = mockPort();
  const { manager, calls } = setup({ ports: [port] });
  manager.configure({ mode: 'serial' });
  await manager.connect(true);
  let released = false;
  port.writable.getWriter = () => ({ write: async () => { throw new Error('Disconnected'); }, releaseLock: () => { released = true; } });
  await assert.rejects(manager.print(testReceipt), /dua kali/);
  assert.equal(released, true);
  assert.equal(manager.busy, false);
  assert.equal(calls.dialogs, 0);
  assert.equal(manager.port, null);
  assert.equal(await manager.print(testReceipt), 'sent');
});

test('concurrent print clicks cannot interleave receipt bytes or change printer settings', async () => {
  const port = mockPort();
  const { manager } = setup({ ports: [port] });
  manager.configure({ mode: 'serial' });
  await manager.connect(true);
  let finishWrite;
  let firstWrite;
  const writing = new Promise(resolve => { firstWrite = resolve; });
  port.writable.getWriter = () => ({ write: async () => { firstWrite(); await new Promise(resolve => { finishWrite = resolve; }); }, releaseLock() {} });
  // A short single-chunk receipt makes it possible to hold the transport open.
  const active = manager.print({ ...testReceipt, cameraName: 'Tes' }, 'admin');
  await writing;
  await assert.rejects(manager.print(testReceipt), /sedang mengirim/);
  assert.throws(() => manager.configure({ paperWidth: 80 }), /Tunggu/);
  await assert.rejects(manager.disconnect(), /Tunggu/);
  finishWrite();
  await active;
});

test('Android handoff encodes ESC/POS and reports handoff rather than confirmed printing', async () => {
  const { manager, calls } = setup({ userAgent: 'Android Chrome' });
  manager.configure({ mode: 'rawbt' });
  assert.equal(await manager.print(testReceipt), 'handoff');
  const [prefix, encoded] = calls.locations[0].split(',');
  assert.equal(prefix, 'rawbt:base64');
  assert.deepEqual(Buffer.from(encoded, 'base64'), Buffer.from(sampleRaster));
  assert.deepEqual(calls.renders[0], [testReceipt, 'customer', 58]);
  assert.equal(calls.dialogs, 0);
  const desktop = setup().manager;
  desktop.configure({ mode: 'rawbt' });
  await assert.rejects(desktop.print(testReceipt), /Android/);
});

test('paper geometry respects the 384/576-dot printable heads and physical margins', () => {
  assert.deepEqual(printGeometry(58), { paperWidth: 58, printableWidth: 48, sidePadding: 5, dots: 384 });
  assert.deepEqual(printGeometry(80), { paperWidth: 80, printableWidth: 72, sidePadding: 4, dots: 576 });
});

test('monochrome conversion preserves bit order, color, transparency, and incomplete bytes', () => {
  const image = { width: 9, height: 1, data: new Uint8ClampedArray(9 * 4).fill(255) };
  image.data.set([0, 0, 0, 255], 0);
  image.data.set([175, 65, 20, 255], 2 * 4); // Brand orange becomes black.
  image.data.set([0, 0, 0, 0], 3 * 4); // Transparent black must remain paper white.
  image.data.set([0, 0, 0, 255], 8 * 4);
  assert.deepEqual([...monochromeRaster(image).pixels], [0b10100000, 0b10000000]);
});

test('image bands preserve every scan line without adding blank lines or page feed commands', () => {
  for (const width of [384, 576]) {
    const height = 53;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    for (let y = 0; y < height; y++) data.set([0, 0, 0, 255], (y * width + y) * 4);
    const bytes = encodeRaster({ width, height, data });
    assert.deepEqual([...bytes.slice(0, 5)], [27, 64, 27, 97, 1]);
    let offset = 5;
    const decoded = [];
    const bands = [];
    while (bytes[offset] === 29) {
      assert.deepEqual([...bytes.slice(offset, offset + 4)], [29, 118, 48, 0]);
      const stride = bytes[offset + 4] + bytes[offset + 5] * 256;
      const rows = bytes[offset + 6] + bytes[offset + 7] * 256;
      assert.equal(stride, width / 8);
      bands.push(rows);
      offset += 8;
      decoded.push(...bytes.slice(offset, offset + stride * rows));
      offset += stride * rows;
    }
    assert.deepEqual(bands, [24, 24, 5]);
    assert.deepEqual(decoded, [...monochromeRaster({ width, height, data }).pixels]);
    assert.deepEqual([...bytes.slice(offset)], [27, 74, 96]);
  }
});

test('image generation failure never transmits a partial receipt or silently falls back to text', async () => {
  const port = mockPort();
  const { manager, calls } = setup({ ports: [port] });
  manager.configure({ mode: 'serial' });
  await manager.connect(true);
  manager.rasterize = async () => { throw new Error('Logo struk belum berhasil dimuat.'); };
  await assert.rejects(manager.print(testReceipt), /Logo struk/);
  assert.equal(port.writes.length, 0);
  assert.equal(port.closes, 0);
  assert.equal(manager.busy, false);
  assert.equal(calls.dialogs, 0);
});

test('the transport passes the chosen receipt variant and paper width to the shared renderer', async () => {
  const port = mockPort();
  const { manager, calls } = setup({ ports: [port] });
  manager.configure({ mode: 'serial', paperWidth: 80 });
  await manager.connect(true);
  await manager.print(testReceipt, 'admin');
  assert.deepEqual(calls.renders, [[testReceipt, 'admin', 80]]);
  assert.deepEqual(port.writes, [...sampleRaster]);
});
