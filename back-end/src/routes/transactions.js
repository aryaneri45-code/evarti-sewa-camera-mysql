import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { safeImagePath, removeUploadedFile, validateImageSignature } from '../middleware/uploads.js';
import { HttpError, notFound } from '../utils/errors.js';
import {
  jakartaDateKey,
  serializeTransaction,
  validateTransaction,
} from '../utils/transactions.js';

const transactionSelect = `
  SELECT t.*, cashier.username AS cashier_username, cashier.name AS cashier_name,
    verifier.name AS verified_by_name, voider.name AS voided_by_name
  FROM transactions t
  JOIN users cashier ON cashier.id = t.cashier_id
  LEFT JOIN users verifier ON verifier.id = t.verified_by
  LEFT JOIN users voider ON voider.id = t.voided_by
`;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function canReadTransaction(request, row) {
  return request.user.role === 'owner' || row.cashier_id === request.user.id;
}

async function recordAudit(db, userId, action, transactionId, detail = null) {
  await db.run(
    'INSERT INTO audit_logs (id, user_id, action, transaction_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [randomUUID(), userId, action, transactionId, detail, new Date().toISOString()],
  );
}

async function serializeWithItems(db, row, options = {}) {
  const items = (await db.all(`
    SELECT camera_id AS cameraId, camera_name AS cameraName, duration_label AS durationLabel,
      duration_minutes AS durationMinutes, price, is_manual_price AS isManualPrice,
      manual_note AS manualNote
    FROM transaction_items
    WHERE transaction_id = ?
    ORDER BY position
  `, [row.id])).map((item) => ({
    ...item,
    isManualPrice: Boolean(item.isManualPrice),
  }));
  const addons = await db.all(`
    SELECT addon_id AS id, category, label, price
    FROM transaction_addons
    WHERE transaction_id = ?
    ORDER BY position
  `, [row.id]);
  return serializeTransaction(row, {
    ...options, items,
    addons: addons.map((addon) => addon.id.startsWith('manual-addon-') ? { ...addon, isManual: true } : addon),
  });
}

function parseUploadPayload(request) {
  if (request.is('multipart/form-data')) {
    if (typeof request.body?.payload !== 'string') {
      throw new HttpError(400, 'Payload transaksi wajib dikirim sebagai field JSON "payload".', 'VALIDATION_ERROR');
    }
    try {
      return JSON.parse(request.body.payload);
    } catch {
      throw new HttpError(400, 'Payload transaksi tidak berisi JSON yang valid.', 'VALIDATION_ERROR');
    }
  }
  return request.body;
}

export function createTransactionsRouter({ db, privateUploadDir, guaranteeUpload }) {
  const router = Router();

  router.post('/', guaranteeUpload.single('guaranteePhoto'), async (request, response, next) => {
    try {
      const input = parseUploadPayload(request);
      if (request.file) validateImageSignature(request.file);
      const normalizedInput = {
        ...input,
        guaranteePhotoPath: request.file?.filename || null,
      };
      const transactionData = await validateTransaction(normalizedInput, request.user, db);
      const id = randomUUID();
      const prefix = transactionData.location === 'event' ? 'EVT' : 'CAF';
      const receiptDate = jakartaDateKey();
      await db.transaction(async (transaction) => {
        const sequence = await transaction.nextReceiptNumber(prefix, receiptDate);
        const receipt = `${prefix}-${receiptDate}-${String(sequence).padStart(3, '0')}`;
        await transaction.run(`
          INSERT INTO transactions (
            id, receipt_no, cashier_id, location, customer_name, customer_whatsapp, customer_pager_number,
            guarantee_type, guarantee_photo_path, guarantee_id_number,
            camera_id, camera_name, duration_label, duration_minutes, start_time, end_time,
            price, is_manual_price, manual_note, total, payment_method, amount_received,
            change_amount, payment_status, verified_by, verified_at, printed_count, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        `, [
          id,
          receipt,
          request.user.id,
          transactionData.location,
          transactionData.customerName,
          transactionData.customerWhatsapp,
          transactionData.customerPagerNumber,
          transactionData.guaranteeType,
          transactionData.guaranteePhotoPath,
          transactionData.guaranteeIdNumber,
          transactionData.camera.id,
          transactionData.camera.name,
          transactionData.durationLabel,
          transactionData.durationMinutes,
          transactionData.startTime,
          transactionData.endTime,
          transactionData.price,
          transactionData.isManualPrice ? 1 : 0,
          transactionData.manualNote,
          transactionData.total,
          transactionData.paymentMethod,
          transactionData.amountReceived,
          transactionData.changeAmount,
          transactionData.paymentStatus,
          transactionData.paymentStatus === 'paid' ? request.user.id : null,
          transactionData.paymentStatus === 'paid' ? new Date().toISOString() : null,
          new Date().toISOString(),
        ]);
        const insertItem = `
          INSERT INTO transaction_items (
            transaction_id, position, camera_id, camera_name, duration_label,
            duration_minutes, price, is_manual_price, manual_note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        for (const [index, item] of transactionData.items.entries()) {
          await transaction.run(insertItem, [
            id, index + 1,
            item.camera.id,
            item.camera.name,
            item.durationLabel,
            item.durationMinutes,
            item.price,
            item.isManualPrice ? 1 : 0,
            item.manualNote,
          ]);
        }
        const insertAddon = `
          INSERT INTO transaction_addons (transaction_id, position, addon_id, category, label, price)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        for (const [index, addon] of transactionData.addons.entries()) {
          await transaction.run(insertAddon, [id, index + 1, addon.id, addon.category, addon.label, addon.price]);
        }
        const manualAddon = transactionData.addons.find((addon) => addon.isManual);
        if (manualAddon) {
          await recordAudit(transaction, request.user.id, 'manual_addon_created', id, JSON.stringify({
            label: manualAddon.label, amount: manualAddon.price,
          }));
        }
        if (transactionData.isManualPrice) {
          await recordAudit(transaction, request.user.id, 'manual_price_created', id, JSON.stringify({
            items: transactionData.items.filter((item) => item.isManualPrice).map((item) => ({
              cameraName: item.camera.name,
              durationMinutes: item.durationMinutes,
              amount: item.price,
              note: item.manualNote,
            })),
          }));
        }
      });
      const row = await db.get(`${transactionSelect} WHERE t.id = ?`, [id]);
      return response.status(201).json({
        transaction: await serializeWithItems(db, row, { includeSensitive: true }),
      });
    } catch (error) {
      if (request.file) removeUploadedFile(request.file);
      return next(error);
    }
  });

  router.get('/', async (request, response, next) => {
    try {
      const conditions = [];
      const values = [];
      if (request.user.role !== 'owner') {
        conditions.push('t.cashier_id = ?');
        values.push(request.user.id);
      } else if (request.query.cashier && request.query.cashier !== 'all') {
        if (!['kasir1', 'kasir2'].includes(request.query.cashier)) {
          throw new HttpError(400, 'Filter kasir tidak valid.', 'VALIDATION_ERROR');
        }
        conditions.push('cashier.username = ?');
        values.push(request.query.cashier);
      }
      if (request.query.location && request.query.location !== 'all') {
        if (!['cafe', 'event'].includes(request.query.location)) {
          throw new HttpError(400, 'Filter lokasi tidak valid.', 'VALIDATION_ERROR');
        }
        conditions.push('t.location = ?');
        values.push(request.query.location);
      }
      if (request.query.date) {
        if (!datePattern.test(request.query.date)) throw new HttpError(400, 'Format tanggal harus YYYY-MM-DD.', 'VALIDATION_ERROR');
        conditions.push(`${db.dateAtJakarta('t.created_at')} = ?`);
        values.push(request.query.date);
      }
      if (request.query.status) {
        if (!['paid', 'pending_verification', 'void'].includes(request.query.status)) {
          throw new HttpError(400, 'Filter status tidak valid.', 'VALIDATION_ERROR');
        }
        conditions.push('t.payment_status = ?');
        values.push(request.query.status);
      }
      if (request.query.manual === 'true') conditions.push('t.is_manual_price = 1');
      if (request.query.manual === 'false') conditions.push('t.is_manual_price = 0');
      const limit = Math.min(Math.max(Number.parseInt(request.query.limit || '50', 10) || 50, 1), 100);
      const offset = Math.max(Number.parseInt(request.query.offset || '0', 10) || 0, 0);
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = await db.all(
        `${transactionSelect} ${where} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
        [...values, limit, offset],
      );
      return response.json({
        transactions: await Promise.all(rows.map((row) => serializeWithItems(db, row))),
        pagination: { limit, offset, returned: rows.length },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:id/guarantee-photo', async (request, response, next) => {
    try {
      const row = await db.get(`${transactionSelect} WHERE t.id = ?`, [request.params.id]);
      if (!row || !canReadTransaction(request, row)) throw notFound('Foto jaminan tidak ditemukan.');
      if (row.guarantee_type !== 'photo' || !row.guarantee_photo_path) throw notFound('Foto jaminan tidak ditemukan.');
      const fullPath = safeImagePath(privateUploadDir, row.guarantee_photo_path);
      response.set({
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      return response.sendFile(fullPath);
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:id', async (request, response, next) => {
    try {
      const row = await db.get(`${transactionSelect} WHERE t.id = ?`, [request.params.id]);
      if (!row || !canReadTransaction(request, row)) throw notFound('Transaksi tidak ditemukan.');
      return response.json({ transaction: await serializeWithItems(db, row, { includeSensitive: true }) });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/:id/verify', async (request, response, next) => {
    try {
      const row = await db.get(`${transactionSelect} WHERE t.id = ?`, [request.params.id]);
      if (!row || !canReadTransaction(request, row)) throw notFound('Transaksi tidak ditemukan.');
      if (row.payment_method !== 'qris_dana' || row.payment_status !== 'pending_verification') {
        throw new HttpError(409, 'Hanya transaksi QRIS yang menunggu verifikasi dapat diverifikasi.', 'INVALID_TRANSACTION_STATE');
      }
      const verifiedAt = new Date().toISOString();
      await db.transaction(async (transaction) => {
        await transaction.run(`
          UPDATE transactions SET payment_status = 'paid', verified_by = ?, verified_at = ?
          WHERE id = ? AND payment_status = 'pending_verification'
        `, [request.user.id, verifiedAt, row.id]);
        await recordAudit(transaction, request.user.id, 'qris_verified', row.id, JSON.stringify({ verifiedAt }));
      });
      const updated = await db.get(`${transactionSelect} WHERE t.id = ?`, [row.id]);
      return response.json({ transaction: await serializeWithItems(db, updated, { includeSensitive: true }) });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/:id/void', async (request, response, next) => {
    try {
      const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim() : '';
      if (!reason || reason.length > 500) throw new HttpError(400, 'Alasan void wajib diisi (maksimal 500 karakter).', 'VALIDATION_ERROR');
      const row = await db.get(`${transactionSelect} WHERE t.id = ?`, [request.params.id]);
      if (!row) throw notFound('Transaksi tidak ditemukan.');
      if (row.payment_status === 'void') throw new HttpError(409, 'Transaksi sudah dibatalkan.', 'INVALID_TRANSACTION_STATE');
      const voidedAt = new Date().toISOString();
      await db.transaction(async (transaction) => {
        await transaction.run(`
          UPDATE transactions SET payment_status = 'void', voided_by = ?, voided_at = ?, void_reason = ?
          WHERE id = ?
        `, [request.user.id, voidedAt, reason, row.id]);
        await recordAudit(transaction, request.user.id, 'transaction_voided', row.id, JSON.stringify({ reason, voidedAt }));
      });
      const updated = await db.get(`${transactionSelect} WHERE t.id = ?`, [row.id]);
      return response.json({ transaction: await serializeWithItems(db, updated, { includeSensitive: true }) });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/:id/print', async (request, response, next) => {
    try {
      const row = await db.get(`${transactionSelect} WHERE t.id = ?`, [request.params.id]);
      if (!row || !canReadTransaction(request, row)) throw notFound('Transaksi tidak ditemukan.');
      if (row.payment_status !== 'paid') throw new HttpError(409, 'Struk hanya dapat dicetak setelah transaksi lunas.', 'INVALID_TRANSACTION_STATE');
      await db.transaction(async (transaction) => {
        await transaction.run('UPDATE transactions SET printed_count = printed_count + 1 WHERE id = ?', [row.id]);
        await recordAudit(transaction, request.user.id, 'receipt_reprinted', row.id, null);
      });
      const updated = await db.get(`${transactionSelect} WHERE t.id = ?`, [row.id]);
      return response.json({ transaction: await serializeWithItems(db, updated) });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
