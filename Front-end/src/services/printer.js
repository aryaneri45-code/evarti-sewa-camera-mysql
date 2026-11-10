import { renderReceiptRaster } from './receipt-raster.js';

export const PRINTER_STORAGE_KEY = 'evarti.printer.v1';
const defaults = { mode: 'browser', paperWidth: 58, autoReconnect: true, baudRate: 9600, label: '', portIdentity: null };
const normalize = (value = {}) => ({
  mode: ['browser', 'serial', 'rawbt'].includes(value.mode) ? value.mode : 'browser',
  paperWidth: Number(value.paperWidth) === 80 ? 80 : 58,
  autoReconnect: value.autoReconnect !== false,
  baudRate: [9600, 19200, 38400, 57600, 115200].includes(Number(value.baudRate)) ? Number(value.baudRate) : 9600,
  label: typeof value.label === 'string' ? value.label.slice(0, 80) : '',
  portIdentity: typeof value.portIdentity === 'string' ? value.portIdentity : null,
});
const identity = (port) => JSON.stringify(Object.entries(port.getInfo()).sort(([a], [b]) => a.localeCompare(b)));

export class PrinterManager {
  constructor(environment = globalThis, rasterize = renderReceiptRaster) {
    this.environment = environment;
    this.rasterize = rasterize;
    this.listeners = new Set();
    this.port = null;
    this.busy = false;
    this.opening = null;
    let settings = defaults;
    try { settings = normalize(JSON.parse(environment.localStorage?.getItem(PRINTER_STORAGE_KEY) || '{}')); } catch { /* Use safe defaults when storage is unavailable. */ }
    this.state = { settings, status: 'disconnected', error: '' };
    this.subscribe = (listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
    this.getSnapshot = () => this.state;
  }

  update(patch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  get supportsSerial() { return Boolean(this.environment.isSecureContext && this.environment.navigator?.serial); }
  get supportsRawbt() { return /Android/i.test(this.environment.navigator?.userAgent || ''); }

  configure(patch) {
    if (this.busy || this.opening) throw new Error('Tunggu proses printer selesai sebelum mengganti pengaturan.');
    const settings = normalize({ ...this.state.settings, ...patch });
    try { this.environment.localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(settings)); }
    catch { throw new Error('Pengaturan tidak dapat disimpan. Izinkan penyimpanan browser lalu coba lagi.'); }
    this.update({ settings, error: '' });
  }

  async disconnect() {
    if (this.busy || this.opening) throw new Error('Tunggu proses printer selesai sebelum memutus koneksi.');
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
    this.update({ status: 'disconnected', error: '' });
  }

  async connect(choose = false, automatic = false) {
    if (!this.supportsSerial) throw new Error('Koneksi langsung tidak tersedia di browser ini. Gunakan printer sistem atau penghubung Android.');
    if (this.opening) return this.opening;
    if (this.busy) throw new Error('Printer sedang mengirim struk.');
    if (!choose && this.port?.writable) return this.port;
    // requestPort must run directly from the user's click, before any other await.
    const selection = choose ? this.environment.navigator.serial.requestPort() : null;
    this.opening = Promise.resolve().then(async () => {
      this.update({ status: 'connecting', error: '' });
      try {
        let selected;
        if (selection) selected = await selection;
        else {
          if (!this.state.settings.portIdentity) throw new Error('Pilih printer terlebih dahulu di menu Printer.');
          const ports = await this.environment.navigator.serial.getPorts();
          const matches = ports.filter((port) => identity(port) === this.state.settings.portIdentity);
          if (matches.length !== 1) throw new Error('Printer tersimpan tidak ditemukan atau ada beberapa perangkat serupa. Pilih ulang di menu Printer.');
          selected = matches[0];
          if (automatic && selected.connected === false) throw new Error('Printer belum tersedia. Nyalakan printer lalu tekan Sambungkan kembali.');
        }
        if (this.port && this.port !== selected) await this.port.close();
        this.port = null;
        if (!selected.writable) await selected.open({ baudRate: this.state.settings.baudRate });
        this.port = selected;
        const settings = { ...this.state.settings, portIdentity: identity(selected) };
        try { this.environment.localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(settings)); }
        catch {
          await selected.close(); this.port = null;
          throw new Error('Pilihan printer tidak dapat disimpan. Izinkan penyimpanan browser.');
        }
        this.update({ settings, status: 'connected', error: '' });
        return selected;
      } catch (error) {
        this.update({ status: this.port?.writable ? 'connected' : 'disconnected', error: error.name === 'NotFoundError' ? '' : error.message });
        throw error;
      } finally { this.opening = null; }
    });
    return this.opening;
  }

  async reconnect() {
    if (this.state.settings.mode !== 'serial' || !this.state.settings.autoReconnect || !this.state.settings.portIdentity || !this.supportsSerial) return;
    try { await this.connect(false, true); } catch { /* Connection state and recovery guidance are available in Settings. */ }
  }

  handleDisconnect(port) {
    if (port === this.port) {
      this.port = null;
      this.update({ status: 'disconnected', error: 'Koneksi printer terputus. Nyalakan printer lalu sambungkan kembali.' });
    }
  }

  async print(transaction, variant = 'customer') {
    if (transaction.paymentStatus !== 'paid') throw new Error('Struk hanya dapat dicetak setelah pembayaran lunas.');
    if (this.busy) throw new Error('Printer sedang mengirim struk. Tunggu sampai selesai.');
    const { mode, paperWidth } = this.state.settings;
    if (mode === 'browser') { this.environment.print(); return 'dialog'; }
    if (mode === 'rawbt' && !this.supportsRawbt) throw new Error('Penghubung RawBT hanya tersedia di Android. Pilih metode lain di menu Printer.');
    const port = mode === 'serial' ? await this.connect() : null;
    if (this.busy) throw new Error('Printer sedang mengirim struk. Tunggu sampai selesai.');
    this.busy = true;
    this.update({ status: 'printing', error: '' });
    let writer;
    let failed = false;
    let sending = false;
    try {
      const bytes = await this.rasterize(transaction, variant, paperWidth);
      if (mode === 'rawbt') {
        const base64 = this.environment.btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
        this.environment.location.assign(`rawbt:base64,${base64}`);
        this.update({ status: 'disconnected', error: '' });
        return 'handoff';
      }
      writer = port.writable.getWriter();
      for (let offset = 0; offset < bytes.length; offset += 256) {
        sending = true;
        await writer.write(bytes.slice(offset, offset + 256));
        // Pace raster data for small Bluetooth receive buffers.
        if (offset + 256 < bytes.length) await new Promise(resolve => setTimeout(resolve, 16));
      }
      this.update({ status: 'connected', error: '' });
      return 'sent';
    } catch (error) {
      if (!sending) {
        this.update({ status: port?.writable ? 'connected' : 'disconnected', error: error.message });
        throw error;
      }
      failed = true;
      const message = 'Pengiriman terhenti. Periksa hasil cetak sebelum mencoba lagi agar struk tidak tercetak dua kali.';
      this.update({ status: 'disconnected', error: message });
      throw new Error(message);
    } finally {
      writer?.releaseLock();
      if (failed && this.port === port) {
        this.port = null;
        try { await port.close(); } catch { /* A disconnected device may already be closed. */ }
      }
      this.busy = false;
    }
  }
}

export const printer = new PrinterManager();
export const testReceipt = {
  id: 'printer-test', receiptNo: 'TES-PRINTER', createdAt: new Date().toISOString(),
  customerName: 'Tes printer', customerWhatsapp: '-', startTime: '-', endTime: '-',
  cameraName: 'Tes cetak struk', durationLabel: 'Pengujian', total: 0,
  paymentStatus: 'paid', paymentMethod: 'cash', amountReceived: 0, change: 0,
};
