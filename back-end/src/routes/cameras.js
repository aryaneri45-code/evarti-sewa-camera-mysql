import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { safeImagePath, removeUploadedFile, validateImageSignature } from '../middleware/uploads.js';
import { HttpError, notFound } from '../utils/errors.js';

const cameraInput = z.object({
  name: z.string().trim().min(1).max(100),
  price1: z.number().int().positive().max(100_000_000),
  price2: z.number().int().positive().max(100_000_000),
}).strict();

function imageUrl(camera) {
  return camera.image_path ? `/api/cameras/${encodeURIComponent(camera.id)}/image` : null;
}

function serializeCamera(camera) {
  return {
    id: camera.id,
    name: camera.name,
    image: imageUrl(camera),
    prices: { 1: camera.price_1h, 2: camera.price_2h },
    active: Boolean(camera.active),
    createdAt: camera.created_at,
    updatedAt: camera.updated_at,
  };
}

export function createCamerasRouter({ db, cameraUploadDir, upload }) {
  const router = Router();

  router.get('/', async (request, response, next) => {
    try {
      const cameras = await db.all(
        'SELECT * FROM cameras WHERE active = 1 OR ? = 1 ORDER BY LOWER(name)',
        [request.user.role === 'owner' ? 1 : 0],
      );
      return response.json({ cameras: cameras.map(serializeCamera) });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', async (request, response, next) => {
    try {
      const parsed = cameraInput.safeParse(request.body);
      if (!parsed.success) throw new HttpError(400, 'Nama kamera dan tarif 1/2 jam harus valid.', 'VALIDATION_ERROR');
      const id = `${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'camera'}-${randomUUID().slice(0, 8)}`;
      await db.run(
        'INSERT INTO cameras (id, name, price_1h, price_2h, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
        [id, parsed.data.name, parsed.data.price1, parsed.data.price2, new Date().toISOString(), new Date().toISOString()],
      );
      return response.status(201).json({ camera: serializeCamera(await db.get('SELECT * FROM cameras WHERE id = ?', [id])) });
    } catch (error) {
      return next(error);
    }
  });

  router.put('/:id', async (request, response, next) => {
    try {
      const parsed = cameraInput.safeParse(request.body);
      if (!parsed.success) throw new HttpError(400, 'Nama kamera dan tarif 1/2 jam harus valid.', 'VALIDATION_ERROR');
      const result = await db.run(`
        UPDATE cameras SET name = ?, price_1h = ?, price_2h = ?, updated_at = ?
        WHERE id = ?
      `, [parsed.data.name, parsed.data.price1, parsed.data.price2, new Date().toISOString(), request.params.id]);
      if (result.changes === 0) throw notFound('Kamera tidak ditemukan.');
      return response.json({ camera: serializeCamera(await db.get('SELECT * FROM cameras WHERE id = ?', [request.params.id])) });
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/:id', async (request, response, next) => {
    try {
      const camera = await db.get('SELECT * FROM cameras WHERE id = ?', [request.params.id]);
      if (!camera) throw notFound('Kamera tidak ditemukan.');
      await db.run('DELETE FROM cameras WHERE id = ?', [camera.id]);
      if (camera.image_path) {
        try {
          fs.unlinkSync(safeImagePath(cameraUploadDir, camera.image_path));
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.error('Unable to remove deleted camera image:', error);
          }
        }
      }
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/:id/active', async (request, response, next) => {
    try {
      if (typeof request.body?.active !== 'boolean') throw new HttpError(400, 'Status active harus berupa boolean.', 'VALIDATION_ERROR');
      const result = await db.run('UPDATE cameras SET active = ?, updated_at = ? WHERE id = ?', [
        request.body.active ? 1 : 0, new Date().toISOString(), request.params.id,
      ]);
      if (result.changes === 0) throw notFound('Kamera tidak ditemukan.');
      return response.json({ camera: serializeCamera(await db.get('SELECT * FROM cameras WHERE id = ?', [request.params.id])) });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/:id/image', upload.single('image'), async (request, response, next) => {
    try {
      if (!request.file) throw new HttpError(400, 'File gambar wajib dilampirkan dengan field "image".', 'VALIDATION_ERROR');
      validateImageSignature(request.file);
      const camera = await db.get('SELECT * FROM cameras WHERE id = ?', [request.params.id]);
      if (!camera) {
        removeUploadedFile(request.file);
        throw notFound('Kamera tidak ditemukan.');
      }
      const oldFile = camera.image_path ? safeImagePath(cameraUploadDir, camera.image_path) : null;
      await db.run('UPDATE cameras SET image_path = ?, updated_at = ? WHERE id = ?', [
        path.basename(request.file.filename), new Date().toISOString(), camera.id,
      ]);
      if (oldFile && oldFile !== request.file.path) fs.promises.unlink(oldFile).catch(() => {});
      return response.json({ camera: serializeCamera(await db.get('SELECT * FROM cameras WHERE id = ?', [camera.id])) });
    } catch (error) {
      if (request.file && error.status !== 404) removeUploadedFile(request.file);
      return next(error);
    }
  });

  router.get('/:id/image', async (request, response, next) => {
    try {
      const camera = await db.get('SELECT * FROM cameras WHERE id = ?', [request.params.id]);
      if (!camera || !camera.image_path || (!camera.active && request.user.role !== 'owner')) {
        throw notFound('Gambar kamera tidak ditemukan.');
      }
      const fullPath = safeImagePath(cameraUploadDir, camera.image_path);
      response.set({
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      });
      return response.sendFile(fullPath);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
