import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../utils/errors.js';

export const sessionCookieName = 'evarti_session';

export function hashToken(token, secret) {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export function readCookie(request, name) {
  const cookieHeader = request.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return '';
}

export function requireAuth(db, sessionSecret) {
  const findSession = `
    SELECT sessions.token_hash, sessions.csrf_token, sessions.expires_at,
      users.id, users.username, users.role, users.name
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `;
  return async (request, response, next) => {
    try {
      const rawToken = readCookie(request, sessionCookieName);
      if (!rawToken) return next(new HttpError(401, 'Silakan masuk terlebih dahulu.', 'UNAUTHENTICATED'));
      const session = await db.get(findSession, [hashToken(rawToken, sessionSecret)]);
      if (!session || Date.parse(session.expires_at) <= Date.now()) {
        if (session) await db.run('DELETE FROM sessions WHERE token_hash = ?', [session.token_hash]);
        return next(new HttpError(401, 'Sesi berakhir. Silakan masuk kembali.', 'SESSION_EXPIRED'));
      }
      request.user = {
        id: session.id,
        username: session.username,
        role: session.role,
        name: session.name,
      };
      request.session = {
        tokenHash: session.token_hash,
        csrfToken: session.csrf_token,
        expiresAt: session.expires_at,
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function requireCsrf(request, response, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
  const provided = request.get('x-csrf-token') || '';
  const expected = request.session?.csrfToken || '';
  if (!provided || !expected) {
    return next(new HttpError(403, 'Token keamanan permintaan tidak ditemukan.', 'CSRF_INVALID'));
  }
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return next(new HttpError(403, 'Token keamanan permintaan tidak valid.', 'CSRF_INVALID'));
  }
  return next();
}

export function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return next(new HttpError(403, 'Akses tidak diizinkan untuk peran ini.', 'FORBIDDEN'));
    }
    return next();
  };
}
