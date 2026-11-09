import PDFDocument from 'pdfkit';
import { Router } from 'express';
import { HttpError } from '../utils/errors.js';
import { jakartaDate } from '../utils/transactions.js';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (!datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function shiftDate(value, days) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function reportFilters(request, db) {
  const today = jakartaDate();
  let from = shiftDate(today, -6);
  let to = today;

  if (request.query.period) {
    if (!['daily', 'weekly', 'monthly'].includes(request.query.period)) {
      throw new HttpError(400, 'Periode laporan tidak valid.', 'VALIDATION_ERROR');
    }
    const anchor = request.query.date || today;
    if (!isValidDate(anchor)) {
      throw new HttpError(400, 'Tanggal laporan tidak valid. Gunakan format YYYY-MM-DD.', 'VALIDATION_ERROR');
    }
    if (request.query.period === 'daily') {
      from = anchor;
      to = anchor;
    } else if (request.query.period === 'weekly') {
      const weekday = new Date(`${anchor}T00:00:00.000Z`).getUTCDay();
      from = shiftDate(anchor, weekday === 0 ? -6 : 1 - weekday);
      to = shiftDate(from, 6);
    } else {
      from = `${anchor.slice(0, 7)}-01`;
      const nextMonth = new Date(`${from}T00:00:00.000Z`);
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
      to = shiftDate(nextMonth.toISOString().slice(0, 10), -1);
    }
  } else if (request.query.from || request.query.to || request.query.date) {
    const from = request.query.from || request.query.date || today;
    const to = request.query.to || request.query.date || from;
    if (!isValidDate(from) || !isValidDate(to) || from > to) {
      throw new HttpError(400, 'Rentang tanggal tidak valid. Gunakan format YYYY-MM-DD.', 'VALIDATION_ERROR');
    }
    return buildReportFilters(request, from, to, db);
  }

  return buildReportFilters(request, from, to, db);
}

function buildReportFilters(request, from, to, db) {
  const conditions = [`${db.dateAtJakarta('t.created_at')} BETWEEN ? AND ?`];
  const values = [from, to];
  if (request.query.location && request.query.location !== 'all') {
    if (!['cafe', 'event'].includes(request.query.location)) throw new HttpError(400, 'Filter lokasi tidak valid.', 'VALIDATION_ERROR');
    conditions.push('t.location = ?');
    values.push(request.query.location);
  }
  if (request.user.role === 'owner') {
    if (request.query.cashier && request.query.cashier !== 'all') {
      if (!['kasir1', 'kasir2'].includes(request.query.cashier)) throw new HttpError(400, 'Filter kasir tidak valid.', 'VALIDATION_ERROR');
      conditions.push('u.username = ?');
      values.push(request.query.cashier);
    }
  } else {
    conditions.push('t.cashier_id = ?');
    values.push(request.user.id);
  }
  return { where: `WHERE ${conditions.join(' AND ')}`, values, from, to };
}

export function createReportsRouter({ db }) {
  const router = Router();

  router.get('/summary', async (request, response, next) => {
    try {
      const filters = reportFilters(request, db);
      const jakartaCreatedDate = db.dateAtJakarta('t.created_at');
      const totals = await db.get(`
        SELECT COUNT(*) AS transaction_count,
          SUM(CASE WHEN t.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
          SUM(CASE WHEN t.payment_status = 'pending_verification' THEN 1 ELSE 0 END) AS pending_count,
          SUM(CASE WHEN t.payment_status = 'void' THEN 1 ELSE 0 END) AS void_count,
          SUM(CASE WHEN t.payment_status = 'paid' THEN t.total ELSE 0 END) AS revenue,
          SUM(CASE WHEN t.payment_status = 'paid' AND t.payment_method = 'cash' THEN t.total ELSE 0 END) AS cash_revenue,
          SUM(CASE WHEN t.payment_status = 'paid' AND t.payment_method = 'qris_dana' THEN t.total ELSE 0 END) AS qris_revenue,
          SUM(CASE WHEN t.is_manual_price = 1 THEN 1 ELSE 0 END) AS manual_price_count
        FROM transactions t JOIN users u ON u.id = t.cashier_id ${filters.where}
      `, filters.values);
      const byLocation = await db.all(`
        SELECT t.location, COUNT(*) AS transaction_count,
          SUM(CASE WHEN t.payment_status = 'paid' THEN t.total ELSE 0 END) AS revenue
        FROM transactions t JOIN users u ON u.id = t.cashier_id ${filters.where}
        GROUP BY t.location ORDER BY t.location
      `, filters.values);
      const byCashier = await db.all(`
        SELECT u.username AS cashier_id, u.name AS cashier_name, COUNT(*) AS transaction_count,
          SUM(CASE WHEN t.payment_status = 'paid' THEN t.total ELSE 0 END) AS revenue
        FROM transactions t JOIN users u ON u.id = t.cashier_id ${filters.where}
        GROUP BY u.id ORDER BY revenue DESC
      `, filters.values);
      const popularCameras = await db.all(`
        SELECT i.camera_id, i.camera_name, COUNT(*) AS rental_count,
          SUM(i.price) AS revenue
        FROM transactions t JOIN users u ON u.id = t.cashier_id
        JOIN transaction_items i ON i.transaction_id = t.id
        ${filters.where} AND t.payment_status = 'paid'
        GROUP BY i.camera_id, i.camera_name
        ORDER BY rental_count DESC, revenue DESC LIMIT 5
      `, filters.values);
      const trend = await db.all(`
        SELECT ${jakartaCreatedDate} AS date,
          COUNT(*) AS transaction_count,
          SUM(CASE WHEN t.payment_status = 'paid' THEN t.total ELSE 0 END) AS revenue
        FROM transactions t JOIN users u ON u.id = t.cashier_id ${filters.where}
        GROUP BY ${jakartaCreatedDate} ORDER BY date
      `, filters.values);
      return response.json({
        period: {
          from: filters.from,
          to: filters.to,
        },
        totals: {
          transactionCount: totals.transaction_count || 0,
          paidCount: totals.paid_count || 0,
          pendingCount: totals.pending_count || 0,
          voidCount: totals.void_count || 0,
          manualPriceCount: totals.manual_price_count || 0,
          revenue: totals.revenue || 0,
          paymentMethods: {
            cash: totals.cash_revenue || 0,
            qrisDana: totals.qris_revenue || 0,
          },
        },
        byLocation: byLocation.map((item) => ({
          location: item.location,
          transactionCount: item.transaction_count,
          revenue: item.revenue || 0,
        })),
        byCashier: byCashier.map((item) => ({
          cashierId: item.cashier_id,
          cashierName: item.cashier_name,
          transactionCount: item.transaction_count,
          revenue: item.revenue || 0,
        })),
        popularCameras: popularCameras.map((item) => ({
          cameraId: item.camera_id,
          cameraName: item.camera_name,
          rentalCount: item.rental_count,
          revenue: item.revenue || 0,
        })),
        trend: trend.map((item) => ({
          date: item.date,
          transactionCount: item.transaction_count,
          revenue: item.revenue || 0,
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/summary/pdf', async (request, response, next) => {
    try {
      const filters = reportFilters(request, db);
      const summary = await db.get(`
        SELECT COUNT(*) AS transaction_count,
          SUM(CASE WHEN t.payment_status = 'paid' THEN t.total ELSE 0 END) AS revenue,
          SUM(CASE WHEN t.payment_status = 'paid' AND t.payment_method = 'cash' THEN t.total ELSE 0 END) AS cash_revenue,
          SUM(CASE WHEN t.payment_status = 'paid' AND t.payment_method = 'qris_dana' THEN t.total ELSE 0 END) AS qris_revenue
        FROM transactions t JOIN users u ON u.id = t.cashier_id ${filters.where}
      `, filters.values);
      const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: 'Ringkasan Transaksi Evarti' } });
      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader('Content-Disposition', 'attachment; filename="evarti-ringkasan-transaksi.pdf"');
      doc.on('error', next);
      doc.pipe(response);
      doc.fontSize(22).text('Evarti Rental', { continued: false });
      doc.moveDown(0.4).fontSize(11).fillColor('#695b61').text('Ringkasan Transaksi');
      doc.moveDown(0.3).text(`Periode: ${filters.from} s/d ${filters.to}`);
      if (request.query.location && request.query.location !== 'all') doc.text(`Lokasi: ${request.query.location === 'cafe' ? 'Cafe' : 'Event'}`);
      if (request.query.cashier && request.query.cashier !== 'all') doc.text(`Kasir: ${request.query.cashier}`);
      doc.moveDown().fillColor('#352d31').fontSize(13).text(`Jumlah transaksi: ${summary.transaction_count || 0}`);
      doc.moveDown(0.35).text(`Pendapatan lunas: Rp ${(summary.revenue || 0).toLocaleString('id-ID')}`);
      doc.moveDown(0.35).fontSize(11).text(`Tunai: Rp ${(summary.cash_revenue || 0).toLocaleString('id-ID')}`);
      doc.moveDown(0.25).text(`QRIS DANA: Rp ${(summary.qris_revenue || 0).toLocaleString('id-ID')}`);
      doc.moveDown(2).fillColor('#8d7f85').fontSize(8).text('Dokumen ringkasan internal Evarti.');
      doc.end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
