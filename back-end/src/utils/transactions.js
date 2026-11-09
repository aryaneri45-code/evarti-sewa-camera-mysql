import { HttpError } from './errors.js';
import { normalizeWhatsapp } from './whatsapp.js';
import { randomUUID } from 'node:crypto';

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function jakartaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function jakartaDateKey(date = new Date()) {
  return jakartaDate(date).replaceAll('-', '');
}

export function computeEndTime(startTime, durationMinutes) {
  if (!timePattern.test(startTime)) throw new HttpError(400, 'Jam mulai harus menggunakan format HH:MM.', 'VALIDATION_ERROR');
  const [hour, minute] = startTime.split(':').map(Number);
  const total = hour * 60 + minute + durationMinutes;
  return `${String(Math.floor((total % 1440) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatDurationLabel(durationMinutes) {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return minutes ? `${hours} jam ${minutes} mnt` : `${hours} Jam`;
}

async function validateRentalItem(item, db, index) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new HttpError(400, `Data kamera ke-${index + 1} tidak valid.`, 'VALIDATION_ERROR');
  }
  if (typeof item.cameraId !== 'string' || !item.cameraId.trim()) {
    throw new HttpError(400, `Kamera ke-${index + 1} wajib dipilih.`, 'VALIDATION_ERROR');
  }
  const camera = await db.get('SELECT * FROM cameras WHERE id = ? AND active = 1', [item.cameraId]);
  if (!camera) throw new HttpError(400, `Kamera ke-${index + 1} tidak ditemukan atau sedang nonaktif.`, 'CAMERA_UNAVAILABLE');

  const isManualPrice = item.isManualPrice === true;
  const durationMinutes = Number(item.durationMinutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes >= 1440) {
    throw new HttpError(400, `Durasi kamera ke-${index + 1} harus lebih dari 0 dan kurang dari 24 jam.`, 'VALIDATION_ERROR');
  }

  let price;
  let manualNote = null;
  if (isManualPrice) {
    if (durationMinutes <= 120) {
      throw new HttpError(400, 'Tarif manual hanya berlaku untuk durasi lebih dari 2 jam.', 'VALIDATION_ERROR');
    }
    price = Number(item.price);
    if (!Number.isSafeInteger(price) || price <= 0 || price > 100_000_000) {
      throw new HttpError(400, `Tarif manual kamera ke-${index + 1} tidak valid.`, 'VALIDATION_ERROR');
    }
    if (item.manualNote != null && typeof item.manualNote !== 'string') {
      throw new HttpError(400, 'Catatan tarif manual harus berupa teks.', 'VALIDATION_ERROR');
    }
    manualNote = typeof item.manualNote === 'string' ? item.manualNote.trim() : '';
    if (manualNote.length > 500) {
      throw new HttpError(400, 'Catatan tarif manual maksimal 500 karakter.', 'VALIDATION_ERROR');
    }
  } else {
    if (![60, 120].includes(durationMinutes)) {
      throw new HttpError(400, 'Durasi di atas 2 jam harus ditandai sebagai tarif manual.', 'VALIDATION_ERROR');
    }
    price = durationMinutes === 60 ? camera.price_1h : camera.price_2h;
    if (Number(item.price) !== price) {
      throw new HttpError(400, 'Harga tidak sesuai dengan tarif kamera di katalog.', 'PRICE_MISMATCH');
    }
  }

  return {
    camera,
    durationMinutes,
    durationLabel: formatDurationLabel(durationMinutes),
    price,
    isManualPrice,
    manualNote,
  };
}

async function validateSelectedAddons(addonIds, db) {
  if (!Array.isArray(addonIds) || addonIds.length > 12) {
    throw new HttpError(400, 'Pilihan add-on tidak valid.', 'VALIDATION_ERROR');
  }
  if (new Set(addonIds).size !== addonIds.length || addonIds.some((id) => typeof id !== 'string')) {
    throw new HttpError(400, 'Pilihan add-on tidak valid atau terduplikasi.', 'VALIDATION_ERROR');
  }
  const addons = await Promise.all(addonIds.map(async (id) => {
    const addon = await db.get('SELECT * FROM addons WHERE id = ? AND active = 1', [id]);
    if (!addon) throw new HttpError(400, 'Add-on tidak ditemukan atau sedang nonaktif.', 'ADDON_UNAVAILABLE');
    return {
      id: addon.id,
      category: addon.category,
      label: addon.label,
      price: addon.price,
    };
  }));
  for (const category of ['photographer', 'print', 'transfer']) {
    if (addons.filter((addon) => addon.category === category).length > 1) {
      throw new HttpError(400, 'Pilih maksimal satu opsi fotografer, print foto, dan pemindahan file.', 'VALIDATION_ERROR');
    }
  }
  return addons;
}

export async function validateTransaction(input, user, db) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'Data transaksi tidak valid.', 'VALIDATION_ERROR');
  }
  const customerName = typeof input.customerName === 'string' ? input.customerName.trim() : '';
  if (!customerName || customerName.length > 120) {
    throw new HttpError(400, 'Nama penyewa wajib diisi (maksimal 120 karakter).', 'VALIDATION_ERROR');
  }
  const customerWhatsapp = normalizeWhatsapp(input.customerWhatsapp);
  if (!customerWhatsapp) {
    throw new HttpError(400, 'No. WhatsApp wajib valid, diawali 08, 62, atau +62 (9-15 digit).', 'VALIDATION_ERROR');
  }
  const customerPagerNumber = input.customerPagerNumber == null || input.customerPagerNumber === ''
    ? null
    : typeof input.customerPagerNumber === 'string'
      ? input.customerPagerNumber.trim()
      : null;
  if (input.customerPagerNumber != null && typeof input.customerPagerNumber !== 'string') {
    throw new HttpError(400, 'Nomor pager harus berupa teks.', 'VALIDATION_ERROR');
  }
  if (customerPagerNumber && customerPagerNumber.length > 40) {
    throw new HttpError(400, 'Nomor pager maksimal 40 karakter.', 'VALIDATION_ERROR');
  }
  const assignedLocation = user.username === 'kasir1' ? 'cafe' : user.username === 'kasir2' ? 'event' : null;
  const location = user.role === 'owner' ? input.location : assignedLocation;
  if (!['cafe', 'event'].includes(location)) {
    throw new HttpError(400, 'Lokasi transaksi harus Cafe atau Event.', 'VALIDATION_ERROR');
  }
  const guaranteeType = input.guaranteeType || 'none';
  if (!['none', 'photo', 'id_number'].includes(guaranteeType)) {
    throw new HttpError(400, 'Jenis jaminan tidak valid.', 'VALIDATION_ERROR');
  }
  const guaranteeIdNumber = typeof input.guaranteeIdNumber === 'string' ? input.guaranteeIdNumber.trim() : '';
  if (guaranteeType === 'id_number' && (!guaranteeIdNumber || guaranteeIdNumber.length > 120)) {
    throw new HttpError(400, 'Nomor ID wajib diisi dan maksimal 120 karakter.', 'VALIDATION_ERROR');
  }
  if (guaranteeType !== 'id_number' && guaranteeIdNumber) {
    throw new HttpError(400, 'Nomor ID hanya dapat diisi jika jenis jaminan adalah Nomor ID.', 'VALIDATION_ERROR');
  }
  if (guaranteeType === 'photo' && !input.guaranteePhotoPath) {
    throw new HttpError(400, 'Foto jaminan wajib diunggah jika jenis jaminan adalah Foto.', 'VALIDATION_ERROR');
  }
  if (guaranteeType !== 'photo' && input.guaranteePhotoPath) {
    throw new HttpError(400, 'Foto hanya dapat dilampirkan jika jenis jaminan adalah Foto.', 'VALIDATION_ERROR');
  }

  const itemsInput = input.items == null
    ? [{
      cameraId: input.cameraId,
      durationMinutes: input.durationMinutes,
      price: input.price,
      isManualPrice: input.isManualPrice,
      manualNote: input.manualNote,
    }]
    : input.items;
  if (!Array.isArray(itemsInput) || itemsInput.length === 0 || itemsInput.length > 20) {
    throw new HttpError(400, 'Pilih antara 1 sampai 20 kamera untuk transaksi.', 'VALIDATION_ERROR');
  }
  const cameraIds = itemsInput.map((item) => item?.cameraId);
  if (new Set(cameraIds).size !== cameraIds.length) {
    throw new HttpError(400, 'Kamera yang sama tidak boleh ditambahkan lebih dari sekali.', 'VALIDATION_ERROR');
  }
  const items = await Promise.all(itemsInput.map((item, index) => validateRentalItem(item, db, index)));
  const firstItem = items[0];
  const durationMinutes = Math.max(...items.map((item) => item.durationMinutes));
  const isManualPrice = items.some((item) => item.isManualPrice);
  const price = items.reduce((sum, item) => sum + item.price, 0);
  if (!Number.isSafeInteger(price) || price > 100_000_000) {
    throw new HttpError(400, 'Total tarif kamera melebihi batas yang diizinkan.', 'VALIDATION_ERROR');
  }
  const addons = await validateSelectedAddons(input.addonIds ?? [], db);
  if (input.manualAddon != null) {
    const manual = input.manualAddon;
    if (typeof manual !== 'object' || Array.isArray(manual)
      || typeof manual.label !== 'string' || !manual.label.trim() || manual.label.trim().length > 100
      || !Number.isSafeInteger(manual.price) || manual.price < 0 || manual.price > 100_000_000) {
      throw new HttpError(400, 'Isi nama add-on manual (maksimal 100 karakter) dan harga berupa angka bulat Rp 0–100.000.000.', 'VALIDATION_ERROR');
    }
    addons.push({
      id: `manual-addon-${randomUUID()}`,
      // Store one-off services with the generic add-on category. The ID marks
      // manual snapshots without changing existing database constraints.
      category: 'property',
      label: manual.label.trim(),
      price: manual.price,
      isManual: true,
    });
  }
  const addonTotal = addons.reduce((sum, addon) => sum + addon.price, 0);
  const total = price + addonTotal;
  if (!Number.isSafeInteger(total) || total > 100_000_000) {
    throw new HttpError(400, 'Total transaksi melebihi batas yang diizinkan.', 'VALIDATION_ERROR');
  }
  const startTime = typeof input.startTime === 'string' ? input.startTime : '';
  const expectedEndTime = computeEndTime(startTime, durationMinutes);
  const endTime = typeof input.endTime === 'string' ? input.endTime : '';
  if (!timePattern.test(endTime) || expectedEndTime !== endTime) {
    throw new HttpError(400, 'Jam selesai harus mengikuti durasi kamera yang paling lama.', 'VALIDATION_ERROR');
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes >= 1440) {
    throw new HttpError(400, 'Durasi harus berupa bilangan menit lebih dari 0 dan kurang dari 24 jam.', 'VALIDATION_ERROR');
  }
  const durationLabel = firstItem.durationLabel;
  const manualNote = items.find((item) => item.isManualPrice)?.manualNote || null;
  if (Number(input.total) !== total) {
    throw new HttpError(400, 'Total transaksi tidak sesuai dengan tarif kamera dan add-on.', 'PRICE_MISMATCH');
  }

  const paymentMethod = input.paymentMethod;
  if (!['cash', 'qris_dana'].includes(paymentMethod)) {
    throw new HttpError(400, 'Metode pembayaran tidak valid.', 'VALIDATION_ERROR');
  }
  const amountReceived = paymentMethod === 'cash' ? Number(input.amountReceived) : total;
  if (!Number.isSafeInteger(amountReceived) || amountReceived < 0) {
    throw new HttpError(400, 'Jumlah pembayaran tidak valid.', 'VALIDATION_ERROR');
  }
  if (paymentMethod === 'cash' && amountReceived < total) {
    throw new HttpError(400, 'Uang diterima tidak boleh kurang dari total.', 'INSUFFICIENT_PAYMENT');
  }

  return {
    location,
    customerName,
    customerWhatsapp,
    customerPagerNumber: customerPagerNumber || null,
    guaranteeType,
    guaranteePhotoPath: input.guaranteePhotoPath || null,
    guaranteeIdNumber: guaranteeType === 'id_number' ? guaranteeIdNumber : null,
    camera: firstItem.camera,
    items,
    addons,
    durationLabel,
    durationMinutes,
    startTime,
    endTime,
    price,
    isManualPrice,
    manualNote: isManualPrice ? manualNote : null,
    total,
    paymentMethod,
    amountReceived,
    changeAmount: paymentMethod === 'cash' ? amountReceived - total : 0,
    paymentStatus: paymentMethod === 'cash' ? 'paid' : 'pending_verification',
  };
}

export function serializeTransaction(row, { includeSensitive = false, items = [], addons = [] } = {}) {
  if (!row) return null;
  const transaction = {
    id: row.id,
    receiptNo: row.receipt_no,
    cashierId: row.cashier_username,
    cashierName: row.cashier_name,
    location: row.location,
    customerName: row.customer_name,
    customerWhatsapp: row.customer_whatsapp,
    customerPagerNumber: row.customer_pager_number,
    cameraId: row.camera_id,
    cameraName: row.camera_name,
    durationLabel: row.duration_label,
    durationMinutes: row.duration_minutes,
    startTime: row.start_time,
    endTime: row.end_time,
    price: row.price,
    isManualPrice: Boolean(row.is_manual_price),
    manualNote: row.manual_note,
    total: row.total,
    paymentMethod: row.payment_method,
    amountReceived: row.amount_received,
    change: row.change_amount,
    paymentStatus: row.payment_status,
    verifiedBy: row.verified_by_name,
    verifiedAt: row.verified_at,
    voidedBy: row.voided_by_name,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    createdAt: row.created_at,
    printedCount: row.printed_count,
    items: items.length ? items : [{
      cameraId: row.camera_id,
      cameraName: row.camera_name,
      durationLabel: row.duration_label,
      durationMinutes: row.duration_minutes,
      price: row.price,
      isManualPrice: Boolean(row.is_manual_price),
      manualNote: row.manual_note,
    }],
    addons,
  };
  if (includeSensitive) {
    transaction.guaranteeType = row.guarantee_type;
    transaction.guaranteeIdNumber = row.guarantee_id_number;
    transaction.guaranteePhotoUrl = row.guarantee_photo_path
      ? `/api/transactions/${encodeURIComponent(row.id)}/guarantee-photo`
      : null;
  }
  return transaction;
}
