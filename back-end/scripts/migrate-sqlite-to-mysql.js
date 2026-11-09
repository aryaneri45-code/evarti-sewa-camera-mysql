import Database from 'better-sqlite3';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { createMysqlDatabase } from '../src/mysql.js';
import { env } from '../src/config/env.js';

const sourcePath = resolve(process.argv[2] || './.data/evarti.sqlite');
const tables = [
  'users',
  'cameras',
  'addons',
  'sessions',
  'receipt_sequences',
  'transactions',
  'transaction_items',
  'transaction_addons',
  'audit_logs',
];

if (!fs.existsSync(sourcePath)) {
  throw new Error(`File SQLite tidak ditemukan: ${sourcePath}`);
}

const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
let target;

try {
  const missingTables = tables.filter((table) => !source.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(table));
  if (missingTables.length) {
    throw new Error(`Tabel SQLite tidak lengkap: ${missingTables.join(', ')}`);
  }
  if (source.prepare('PRAGMA foreign_key_check').all().length) {
    throw new Error('Database SQLite memiliki relasi foreign key yang tidak valid; perbaiki sebelum migrasi.');
  }

  target = createMysqlDatabase(env.mysql);
  await target.initialize(env.passwords, { seed: false });
  for (const table of tables) {
    const { count } = await target.get(`SELECT COUNT(*) AS count FROM \`${table}\``);
    if (Number(count) > 0) {
      throw new Error(`Tabel MySQL \`${table}\` tidak kosong. Migrasi dihentikan agar data tidak tertimpa.`);
    }
  }

  const hasPagerNumber = source.prepare('PRAGMA table_info(transactions)')
    .all().some((column) => column.name === 'customer_pager_number');
  await target.transaction(async (transaction) => {
    for (const table of tables) {
      const columns = source.prepare(`PRAGMA table_info(\`${table}\`)`).all().map((column) => column.name);
      const rows = source.prepare(`SELECT * FROM \`${table}\` ORDER BY rowid`).all();
      const migratedColumns = table === 'transactions' && !hasPagerNumber
        ? [...columns, 'customer_pager_number']
        : columns;
      const placeholders = migratedColumns.map(() => '?').join(', ');
      const columnNames = migratedColumns.map((column) => `\`${column}\``).join(', ');
      const insert = `INSERT INTO \`${table}\` (${columnNames}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = columns.map((column) => row[column]);
        if (table === 'transactions' && !hasPagerNumber) values.push(null);
        await transaction.run(insert, values);
      }
      console.info(`Migrated ${rows.length} rows from ${table}.`);
    }
  });
  console.info(`SQLite data migrated successfully from ${sourcePath}.`);
} finally {
  source.close();
  if (target) await target.close();
}
