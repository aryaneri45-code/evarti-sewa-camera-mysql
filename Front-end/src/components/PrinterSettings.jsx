import React, { useState, useSyncExternalStore } from 'react';
import { Bluetooth, CheckCircle2, Printer, RefreshCw } from 'lucide-react';
import { printer, testReceipt } from '../services/printer.js';

export function usePrinter() {
  return useSyncExternalStore(printer.subscribe, printer.getSnapshot);
}

export default function PrinterSettings({ receiptPreview }) {
  const { settings, status, error } = usePrinter();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState('');
  const update = async (patch) => {
    setLocalError(''); setMessage('');
    try {
      if ((patch.mode && patch.mode !== settings.mode) || patch.baudRate) await printer.disconnect();
      printer.configure(patch);
      setMessage('Pengaturan tersimpan di perangkat ini.');
    } catch (failure) { setLocalError(failure.message); }
  };
  const run = async (action) => {
    setWorking(true); setLocalError(''); setMessage('');
    try { await action(); }
    catch (failure) { if (failure.name !== 'NotFoundError') setLocalError(failure.message); }
    finally { setWorking(false); }
  };
  return <section className="panel printer-settings" aria-labelledby="printer-settings-title">
    <div className="printer-settings-heading"><div className="print-help-icon"><Printer size={22} /></div><div><h2 id="printer-settings-title">Printer default</h2><p>Ganti printer tanpa mengubah aplikasi. Berlaku untuk semua struk pada browser dan perangkat ini.</p></div></div>
    <div className="form-grid">
      <label><span className="field-label">Metode cetak</span><select value={settings.mode} disabled={working} onChange={(event) => update({ mode: event.target.value })}>
        <option value="browser">Printer sistem</option>
        <option value="serial" disabled={!printer.supportsSerial}>Langsung ESC/POS</option>
        <option value="rawbt" disabled={!printer.supportsRawbt}>Android (RawBT)</option>
      </select></label>
      <label><span className="field-label">Ukuran kertas</span><select value={settings.paperWidth} disabled={working} onChange={(event) => update({ paperWidth: Number(event.target.value) })}><option value={58}>Thermal 58 mm</option><option value={80}>Thermal 80 mm</option></select></label>
    </div>
    {settings.mode === 'browser' && <p className="printer-guidance">Pasangkan printer Bluetooth atau instal printer melalui pengaturan perangkat. Pilih printer dan ukuran kertas yang sama pada dialog cetak, gunakan skala 100%, lalu nonaktifkan header/footer. Pemilihan printer tetap mengikuti dialog browser.</p>}
    {settings.mode === 'rawbt' && <div className="printer-guidance"><p>Pasang aplikasi RawBT, lalu pilih printer default di dalam RawBT. Setelah itu tombol cetak akan menyerahkan struk ke aplikasi tersebut.</p><p>Saat mengganti printer, pilih perangkat baru di RawBT. Status koneksi dan hasil cetak diperiksa melalui RawBT. <a href="https://rawbt.ru/" target="_blank" rel="noreferrer">Situs RawBT</a></p></div>}
    {settings.mode === 'serial' && <>
      <p className="printer-guidance">Untuk printer yang mendukung ESC/POS melalui Bluetooth serial atau USB serial. Pasangkan Bluetooth di pengaturan perangkat, lalu pilih printer di bawah. Koneksi langsung memerlukan browser yang mendukung dan HTTPS atau localhost.</p>
      <div className="form-grid">
        <label><span className="field-label">Nama printer <small>(opsional)</small></span><input maxLength={80} value={settings.label} disabled={working} onChange={(event) => update({ label: event.target.value })} placeholder="Contoh: Printer kasir Cafe" /></label>
        <label><span className="field-label">Kecepatan serial</span><select value={settings.baudRate} disabled={working} onChange={(event) => update({ baudRate: Number(event.target.value) })}>{[9600, 19200, 38400, 57600, 115200].map(value => <option value={value} key={value}>{value} baud</option>)}</select><span className="field-hint">Gunakan nilai pada panduan printer jika cetakan tidak terbaca.</span></label>
      </div>
      <label className="printer-checkbox"><input type="checkbox" checked={settings.autoReconnect} disabled={working} onChange={(event) => update({ autoReconnect: event.target.checked })} /> Sambungkan kembali printer tersimpan saat aplikasi dibuka</label>
      <p className="printer-connection" role="status"><Bluetooth size={17} /> {settings.label || 'Printer ESC/POS'} · {{ disconnected: 'Belum terhubung', connecting: 'Menyambungkan…', connected: 'Terhubung', printing: 'Mengirim struk…' }[status]}</p>
      <div className="printer-actions"><button type="button" className="button button-secondary" disabled={working || !printer.supportsSerial} onClick={() => run(() => printer.connect(true))}><Bluetooth size={17} />{settings.portIdentity ? 'Ganti printer' : 'Pilih printer'}</button><button type="button" className="button button-secondary" disabled={working || !settings.portIdentity || !printer.supportsSerial} onClick={() => run(() => printer.connect())}><RefreshCw size={16} /> Sambungkan kembali</button><button type="button" className="button button-secondary" disabled={working || status !== 'connected'} onClick={() => run(() => printer.disconnect())}>Putuskan</button></div>
    </>}
    <p className="printer-guidance">Logo dan tata letak mengikuti pratinjau. Cetak Bluetooth mengirim gambar hitam-putih dan memerlukan printer ESC/POS yang mendukung cetak gambar. Pilih ukuran kertas yang sesuai dengan printer.</p>
    {(localError || error) && <div className="error-banner" role="alert">{localError || error}</div>}
    {message && <p className="printer-message" role="status"><CheckCircle2 size={16} /> {message}</p>}
    <button type="button" className="button button-primary" disabled={working} aria-busy={working} onClick={() => run(async () => {
      const result = await printer.print(testReceipt);
      setMessage(result === 'dialog' ? 'Dialog cetak dibuka. Periksa hasil cetak pada printer.' : result === 'handoff' ? 'Struk diserahkan ke RawBT. Periksa hasil cetak di aplikasi tersebut.' : 'Data tes dikirim. Periksa hasil cetak pada printer.');
    })}><Printer size={17} /> {working ? 'Memproses…' : 'Tes cetak'}</button>
    <details className="printer-test-preview"><summary>Pratinjau struk pengujian</summary>{receiptPreview}</details>
  </section>;
}
