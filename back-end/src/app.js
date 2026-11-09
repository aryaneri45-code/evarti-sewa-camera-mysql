import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './db.js';
import { createMysqlDatabase } from './mysql.js';
import { requireAuth, requireCsrf, requireRole } from './middleware/auth.js';
import { createImageUpload } from './middleware/uploads.js';
import { createAuditRouter } from './routes/audit.js';
import { createAddonsRouter } from './routes/addons.js';
import { createAuthRouter } from './routes/auth.js';
import { createCamerasRouter } from './routes/cameras.js';
import { createReportsRouter } from './routes/reports.js';
import { createTransactionsRouter } from './routes/transactions.js';
import { HttpError } from './utils/errors.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export function createApp(config = {}) {
  const sessionSecret = config.sessionSecret || '';
  if (sessionSecret.length < 32) {
    throw new Error('createApp memerlukan sessionSecret acak minimal 32 karakter.');
  }
  const db = config.db || (config.mysql
    ? createMysqlDatabase(config.mysql)
    : createDatabase({
      filename: config.databasePath || './.data/evarti.sqlite',
      passwords: config.passwords,
    }));
  const uploadRoot = config.uploadRoot || path.resolve(currentDirectory, '../uploads');
  const cameraUploadDir = path.join(uploadRoot, 'cameras');
  const privateUploadDir = path.join(uploadRoot, 'private');
  const cameraUpload = createImageUpload(cameraUploadDir, 3 * 1024 * 1024);
  const guaranteeUpload = createImageUpload(privateUploadDir, 2 * 1024 * 1024);
  const allowedOrigins = (config.frontendOrigin || 'http://localhost:5173')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  const cookieSecure = Boolean(config.cookieSecure);

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new HttpError(403, 'Origin tidak diizinkan.', 'ORIGIN_NOT_ALLOWED'));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }));
  app.use(express.json({ limit: '100kb', type: ['application/json', 'application/*+json'] }));
  app.use((request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  const authRouter = createAuthRouter({ db, cookieSecure, sessionSecret });
  app.get('/api/health', (request, response) => response.json({ status: 'ok' }));

  app.use('/api', (request, response, next) => {
    if (request.path === '/auth/login' && request.method === 'POST') return next();
    requireAuth(db, sessionSecret)(request, response, (authError) => {
      if (authError) return next(authError);
      return requireCsrf(request, response, next);
    });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/cameras', (request, response, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return requireRole('owner')(request, response, next);
    return next();
  });
  app.use('/api/cameras', createCamerasRouter({ db, cameraUploadDir, upload: cameraUpload }));
  app.use('/api/addons', (request, response, next) => {
    if (['POST', 'PUT', 'DELETE'].includes(request.method)) return requireRole('owner')(request, response, next);
    return next();
  });
  app.use('/api/addons', createAddonsRouter({ db }));
  app.use('/api/transactions', createTransactionsRouter({ db, privateUploadDir, guaranteeUpload }));
  app.use('/api/reports', createReportsRouter({ db }));
  app.use('/api/audit-logs', requireRole('owner'), createAuditRouter({ db }));
  app.use('/api/*', (request, response, next) => next(new HttpError(404, 'Endpoint tidak ditemukan.', 'NOT_FOUND')));

  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return response.status(status).json({
        error: {
          code: error.code,
          message: error.code === 'LIMIT_FILE_SIZE' ? 'Ukuran gambar melebihi batas.' : 'Unggahan gambar tidak valid.',
        },
      });
    }
    if (error instanceof HttpError || Number.isInteger(error.status)) {
      return response.status(error.status || 500).json({
        error: { code: error.code || 'REQUEST_ERROR', message: error.message },
      });
    }
    if (error?.code?.startsWith('SQLITE_CONSTRAINT')
      || ['ER_DUP_ENTRY', 'ER_NO_REFERENCED_ROW_2', 'ER_ROW_IS_REFERENCED_2'].includes(error?.code)) {
      return response.status(409).json({
        error: { code: 'DATA_CONFLICT', message: 'Data bertentangan dengan aturan penyimpanan.' },
      });
    }
    console.error('Unhandled API error:', error);
    return response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.' },
    });
  });
  app.locals.db = db;
  return app;
}
