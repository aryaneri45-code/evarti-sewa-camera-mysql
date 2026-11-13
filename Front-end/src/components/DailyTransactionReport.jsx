import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { printer } from '../services/printer.js';
import { printGeometry } from '../services/receipt-encoder.js';

const currency = (amount) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(amount) || 0);
const dateLabel = (date) => new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long', timeZone: 'Asia/Jakarta',
}).format(new Date(`${date}T12:00:00+07:00`));
const timeLabel = (value) => new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
}).format(new Date(value));
const statusLabel = { paid: 'Lunas', pending_verification: 'Menunggu verifikasi', void: 'Void' };

export default function DailyTransactionReport({ date, transactions, isOwner, paperWidth, onClose, onError, onComplete }) {
  const root = useRef(null);
  const pageStyle = useRef(null);
  const report = useMemo(() => ({ id: `daily-report-${date}`, date, transactions }), [date, transactions]);
  const geometry = printGeometry(paperWidth);

  useLayoutEffect(() => {
    const updatePageSize = () => {
      // Bound browser pages for thermal drivers; short reports use actual height.
      const height = Math.min(280, Math.ceil(root.current.getBoundingClientRect().height * 25.4 / 96) + 1);
      pageStyle.current.textContent = `@page { size: ${paperWidth}mm ${height}mm; margin: 0; }`;
    };
    updatePageSize();
    window.addEventListener('beforeprint', updatePageSize);
    return () => window.removeEventListener('beforeprint', updatePageSize);
  }, [paperWidth, report]);

  useEffect(() => {
    document.body.classList.add('printing-history');
    window.addEventListener('afterprint', onClose);
    const frame = window.requestAnimationFrame(async () => {
      try {
        const result = await printer.printDailyReport(report);
        onComplete(result);
        if (result !== 'dialog') onClose();
      } catch (error) {
        onError(error.message || 'Rekap transaksi tidak dapat dicetak.');
        onClose();
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', onClose);
      document.body.classList.remove('printing-history');
    };
  }, [report, onClose, onError, onComplete]);

  const paid = transactions.filter((transaction) => transaction.paymentStatus === 'paid');
  const totalPaid = paid.reduce((total, transaction) => total + Number(transaction.total), 0);
  const cashPaid = paid.filter((transaction) => transaction.paymentMethod === 'cash')
    .reduce((total, transaction) => total + Number(transaction.total), 0);
  const sections = [];
  for (let index = 0; index < transactions.length; index += 5) sections.push(transactions.slice(index, index + 5));

  return createPortal(<section ref={root} className="receipt-print-root history-print-root" aria-hidden="true"
    data-receipt-id={report.id} data-receipt-variant="daily-report" data-paper-width={paperWidth}
    style={{ '--receipt-paper-width': `${paperWidth}mm`, '--receipt-side-padding': `${geometry.sidePadding}mm` }}>
    <style ref={pageStyle} media="print" />
    <header className="receipt-paper history-report-header">
      <strong>EVARTI</strong>
      <h1>REKAP TRANSAKSI HARIAN</h1>
      <p>{dateLabel(date)} (WIB)</p>
      <p>{isOwner ? 'Semua lokasi dan kasir' : 'Semua lokasi · Akun kasir ini'}</p>
      <p>{transactions.length} transaksi</p>
      <div className="receipt-rule" />
    </header>
    {sections.map((section, sectionIndex) => <div className="receipt-paper" key={sectionIndex}>
      {section.map((transaction, index) => <article className="history-report-entry" key={transaction.id}>
        <strong>{sectionIndex * 5 + index + 1}. {transaction.receiptNo}</strong>
        <div>{timeLabel(transaction.createdAt)} WIB · {transaction.customerName}</div>
        <div>{transaction.location === 'cafe' ? 'Cafe' : 'Event'}{isOwner ? ` · ${transaction.cashierName}` : ''}</div>
        {(transaction.items?.length ? transaction.items : [transaction]).map((item, itemIndex) =>
          <div key={itemIndex}>{item.cameraName} · {item.durationLabel}{item.isManualPrice ? ' (Manual)' : ''}</div>)}
        {transaction.addons?.map((addon, addonIndex) => <div key={addonIndex}>{addon.label} · {currency(addon.price)}</div>)}
        <div>{transaction.paymentMethod === 'cash' ? 'Tunai' : 'QRIS DANA'} · {statusLabel[transaction.paymentStatus] || transaction.paymentStatus}</div>
        <div className="receipt-row"><span>Total</span><b>{currency(transaction.total)}</b></div>
        <div className="receipt-rule" />
      </article>)}
    </div>)}
    <footer className="receipt-paper history-report-totals">
      <div className="receipt-row"><span>Lunas</span><b>{paid.length}</b></div>
      <div className="receipt-row"><span>Menunggu verifikasi</span><b>{transactions.filter((transaction) => transaction.paymentStatus === 'pending_verification').length}</b></div>
      <div className="receipt-row"><span>Void</span><b>{transactions.filter((transaction) => transaction.paymentStatus === 'void').length}</b></div>
      <div className="receipt-rule" />
      <div className="receipt-row"><span>Tunai lunas</span><b>{currency(cashPaid)}</b></div>
      <div className="receipt-row"><span>QRIS lunas</span><b>{currency(totalPaid - cashPaid)}</b></div>
      <div className="receipt-row receipt-total"><span>TOTAL LUNAS</span><b>{currency(totalPaid)}</b></div>
      <div className="receipt-rule" />
      <p>Transaksi menunggu verifikasi dan void tidak termasuk total lunas.</p>
    </footer>
  </section>, document.body);
}
