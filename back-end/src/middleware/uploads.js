import multer from 'multer';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../utils/errors.js';

const acceptedImages = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

export function createImageUpload(root, maxFileSize = 3 * 1024 * 1024) {
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') fs.chmodSync(root, 0o700);
  return multer({
    storage: multer.diskStorage({
      destination: (request, file, callback) => callback(null, root),
      filename: (request, file, callback) => callback(null, `${randomUUID()}${acceptedImages.get(file.mimetype) || '.upload'}`),
    }),
    limits: { fileSize: maxFileSize, files: 1 },
    fileFilter: (request, file, callback) => {
      if (!acceptedImages.has(file.mimetype)) {
        return callback(new HttpError(400, 'Format gambar harus JPG, PNG, atau WebP.', 'INVALID_IMAGE'));
      }
      return callback(null, true);
    },
  });
}

export function safeImagePath(root, filename) {
  if (!filename || path.basename(filename) !== filename) {
    throw new HttpError(404, 'Gambar tidak ditemukan.', 'NOT_FOUND');
  }
  const fullPath = path.resolve(root, filename);
  if (!fullPath.startsWith(`${path.resolve(root)}${path.sep}`) || !fs.existsSync(fullPath)) {
    throw new HttpError(404, 'Gambar tidak ditemukan.', 'NOT_FOUND');
  }
  return fullPath;
}

export function validateImageSignature(file) {
  const buffer = fs.readFileSync(file.path);
  const valid = file.mimetype === 'image/jpeg'
    ? buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    : file.mimetype === 'image/png'
      ? buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : file.mimetype === 'image/webp'
        ? buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
        : false;
  if (!valid) {
    removeUploadedFile(file);
    throw new HttpError(400, 'Isi file tidak sesuai dengan format gambar yang dipilih.', 'INVALID_IMAGE');
  }
}

export function removeUploadedFile(file) {
  if (file?.path) {
    fs.promises.unlink(file.path).catch((error) => {
      if (error.code !== 'ENOENT') console.error('Unable to remove temporary upload:', error);
    });
  }
}
