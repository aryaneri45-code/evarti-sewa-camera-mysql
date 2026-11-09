import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { sessionCookieName, hashToken, readCookie } from '../middleware/auth.js';
import { HttpError } from '../utils/errors.js';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    title: row.username === 'owner' ? 'Owner' : row.username === 'kasir1' ? 'Kasir 1' : 'Kasir 2',
  };
}

function setSessionCookie(response, token, secure) {
  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/api',
    maxAge: SESSION_DURATION_MS,
  });
}

export function createAuthRouter({ db, cookieSecure, sessionSecret }) {
  const router = Router();
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'LOGIN_RATE_LIMIT', message: 'Terlalu banyak percobaan masuk. Coba kembali beberapa menit lagi.' } },
  });

  router.post('/login', loginLimit, async (request, response, next) => {
    try {
      const username = typeof request.body?.username === 'string' ? request.body.username.trim().toLowerCase() : '';
      const password = typeof request.body?.password === 'string' ? request.body.password : '';
      if (!username || !password || username.length > 50 || password.length > 200) {
        throw new HttpError(400, 'Username dan password wajib diisi.', 'VALIDATION_ERROR');
      }
      const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
      const matches = user ? bcrypt.compareSync(password, user.password_hash) : false;
      if (!matches) throw new HttpError(401, 'Username atau password salah.', 'INVALID_CREDENTIALS');

      await db.run('DELETE FROM sessions WHERE expires_at <= ?', [new Date().toISOString()]);
      const token = randomBytes(32).toString('base64url');
      const csrfToken = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
      await db.run(
        'INSERT INTO sessions (token_hash, csrf_token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
        [hashToken(token, sessionSecret), csrfToken, user.id, expiresAt, new Date().toISOString()],
      );
      setSessionCookie(response, token, cookieSecure);
      return response.json({ user: publicUser(user), csrfToken, expiresAt });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/logout', async (request, response, next) => {
    try {
      const token = readCookie(request, sessionCookieName);
      if (token) await db.run('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token, sessionSecret)]);
      response.clearCookie(sessionCookieName, {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: 'strict',
        path: '/api',
      });
      return response.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/me', async (request, response, next) => {
    try {
      const user = await db.get('SELECT * FROM users WHERE id = ?', [request.user.id]);
      return response.json({
        user: publicUser(user),
        csrfToken: request.session.csrfToken,
        expiresAt: request.session.expiresAt,
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
