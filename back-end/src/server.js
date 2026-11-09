import { createApp } from './app.js';
import { env, validateEnv } from './config/env.js';
import { closeDatabase } from './db.js';

validateEnv();
if (env.nodeEnv === 'production' && !env.cookieSecure) {
  throw new Error('COOKIE_SECURE=true wajib di production agar cookie sesi hanya dikirim melalui HTTPS.');
}

const app = env.databaseClient === 'mysql'
  ? createApp({
    mysql: env.mysql,
    passwords: env.passwords,
    sessionSecret: env.sessionSecret,
    frontendOrigin: env.frontendOrigin,
    cookieSecure: env.cookieSecure,
  })
  : createApp({
    databasePath: env.databasePath,
    passwords: env.passwords,
    sessionSecret: env.sessionSecret,
    frontendOrigin: env.frontendOrigin,
    cookieSecure: env.cookieSecure,
  });

if (env.databaseClient === 'mysql') await app.locals.db.initialize(env.passwords);
const server = app.listen(env.port, '127.0.0.1', () => console.info(`Evarti API berjalan pada port ${env.port}.`));

function shutdown() {
  server.close(async () => {
    await closeDatabase(app.locals.db);
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
