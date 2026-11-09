import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { initialAddons, initialCameras } from './db.js';

const schema = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(191) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(16) NOT NULL,
    name VARCHAR(120) NOT NULL,
    created_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash VARCHAR(64) PRIMARY KEY,
    csrf_token VARCHAR(100) NOT NULL,
    user_id VARCHAR(191) NOT NULL,
    expires_at VARCHAR(40) NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    INDEX sessions_expiry_idx (expires_at),
    CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS cameras (
    id VARCHAR(191) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    image_path VARCHAR(255),
    price_1h INT NOT NULL,
    price_2h INT NOT NULL,
    active TINYINT NOT NULL DEFAULT 1,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS addons (
    id VARCHAR(191) PRIMARY KEY,
    category VARCHAR(32) NOT NULL,
    label VARCHAR(100) NOT NULL,
    price INT NOT NULL,
    active TINYINT NOT NULL DEFAULT 1,
    updated_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS receipt_sequences (
    location_prefix VARCHAR(3) NOT NULL,
    receipt_date VARCHAR(8) NOT NULL,
    last_number INT NOT NULL,
    PRIMARY KEY (location_prefix, receipt_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(191) PRIMARY KEY,
    receipt_no VARCHAR(32) NOT NULL UNIQUE,
    cashier_id VARCHAR(191) NOT NULL,
    location VARCHAR(16) NOT NULL,
    customer_name VARCHAR(120) NOT NULL,
    customer_whatsapp VARCHAR(24) NOT NULL,
    customer_pager_number VARCHAR(40),
    guarantee_type VARCHAR(16) NOT NULL,
    guarantee_photo_path VARCHAR(255),
    guarantee_id_number VARCHAR(120),
    camera_id VARCHAR(191),
    camera_name VARCHAR(120) NOT NULL,
    duration_label VARCHAR(64) NOT NULL,
    duration_minutes INT NOT NULL,
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    price INT NOT NULL,
    is_manual_price TINYINT NOT NULL DEFAULT 0,
    manual_note VARCHAR(500),
    total INT NOT NULL,
    payment_method VARCHAR(24) NOT NULL,
    amount_received INT NOT NULL,
    change_amount INT NOT NULL,
    payment_status VARCHAR(24) NOT NULL,
    verified_by VARCHAR(191),
    verified_at VARCHAR(40),
    voided_by VARCHAR(191),
    voided_at VARCHAR(40),
    void_reason VARCHAR(500),
    printed_count INT NOT NULL DEFAULT 0,
    created_at VARCHAR(40) NOT NULL,
    INDEX transactions_cashier_created_idx (cashier_id, created_at),
    INDEX transactions_location_created_idx (location, created_at),
    CONSTRAINT transactions_cashier_fk FOREIGN KEY (cashier_id) REFERENCES users(id),
    CONSTRAINT transactions_camera_fk FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE SET NULL,
    CONSTRAINT transactions_verified_fk FOREIGN KEY (verified_by) REFERENCES users(id),
    CONSTRAINT transactions_voided_fk FOREIGN KEY (voided_by) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS transaction_items (
    transaction_id VARCHAR(191) NOT NULL,
    position INT NOT NULL,
    camera_id VARCHAR(191),
    camera_name VARCHAR(120) NOT NULL,
    duration_label VARCHAR(64) NOT NULL,
    duration_minutes INT NOT NULL,
    price INT NOT NULL,
    is_manual_price TINYINT NOT NULL DEFAULT 0,
    manual_note VARCHAR(500),
    PRIMARY KEY (transaction_id, position),
    INDEX transaction_items_camera_idx (camera_id),
    CONSTRAINT transaction_items_transaction_fk FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    CONSTRAINT transaction_items_camera_fk FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS transaction_addons (
    transaction_id VARCHAR(191) NOT NULL,
    position INT NOT NULL,
    addon_id VARCHAR(191) NOT NULL,
    category VARCHAR(32) NOT NULL,
    label VARCHAR(100) NOT NULL,
    price INT NOT NULL,
    PRIMARY KEY (transaction_id, position),
    CONSTRAINT transaction_addons_transaction_fk FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    action VARCHAR(100) NOT NULL,
    transaction_id VARCHAR(191),
    detail TEXT,
    created_at VARCHAR(40) NOT NULL,
    CONSTRAINT audit_logs_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT audit_logs_transaction_fk FOREIGN KEY (transaction_id) REFERENCES transactions(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

function queryMethods(connection) {
  return {
    async get(sql, values = []) {
      const [rows] = await connection.execute(sql, values);
      return rows[0];
    },
    async all(sql, values = []) {
      const [rows] = await connection.execute(sql, values);
      return rows;
    },
    async run(sql, values = []) {
      const [result] = await connection.execute(sql, values);
      return { changes: result.affectedRows, lastInsertRowid: result.insertId };
    },
    async nextReceiptNumber(prefix, receiptDate) {
      await this.run(`
        INSERT INTO receipt_sequences (location_prefix, receipt_date, last_number)
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE last_number = last_number + 1
      `, [prefix, receiptDate]);
      const sequence = await this.get(
        'SELECT last_number FROM receipt_sequences WHERE location_prefix = ? AND receipt_date = ? FOR UPDATE',
        [prefix, receiptDate],
      );
      return sequence.last_number;
    },
  };
}

export function createMysqlDatabase(config) {
  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    timezone: 'Z',
    decimalNumbers: true,
    ssl: config.ssl ? {} : undefined,
  });

  const db = {
    ...queryMethods(pool),
    dateAtJakarta: (column) => `DATE(DATE_ADD(CAST(REPLACE(REPLACE(${column}, 'T', ' '), 'Z', '') AS DATETIME(3)), INTERVAL 7 HOUR))`,
    async transaction(callback) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await callback(queryMethods(connection));
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    async initialize(passwords, { seed = true } = {}) {
      await pool.query('SELECT 1');
      for (const statement of schema) await pool.query(statement);
      const [columns] = await pool.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions'`,
      );
      if (!columns.some(({ COLUMN_NAME }) => COLUMN_NAME === 'customer_pager_number')) {
        await pool.query('ALTER TABLE transactions ADD COLUMN customer_pager_number VARCHAR(40) NULL AFTER customer_whatsapp');
      }
      if (seed) await seedMysqlDatabase(db, passwords);
    },
    close() {
      return pool.end();
    },
  };
  return db;
}

export async function seedMysqlDatabase(db, passwords = {}) {
  const users = [
    { id: 'owner', username: 'owner', name: 'Akbar', role: 'owner', password: passwords.owner },
    { id: 'kasir1', username: 'kasir1', name: 'Tanada', role: 'kasir', password: passwords.cashier1 },
    { id: 'kasir2', username: 'kasir2', name: 'Stand', role: 'kasir', password: passwords.cashier2 },
  ];
  const { count } = await db.get('SELECT COUNT(*) AS count FROM users');
  const createdAt = new Date().toISOString();
  if (Number(count) === 0) {
    if (users.some(({ password }) => !password || password.length < 12)) {
      throw new Error('Password bootstrap Owner, Kasir 1, dan Kasir 2 harus diatur (minimal 12 karakter).');
    }
    await db.transaction(async (transaction) => {
      for (const user of users) {
        await transaction.run(
          'INSERT INTO users (id, username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [user.id, user.username, bcrypt.hashSync(user.password, 12), user.role, user.name, createdAt],
        );
      }
      // Seed only during account bootstrap so restarts preserve deletions,
      // including an intentionally empty add-on catalog.
      for (const addon of initialAddons) {
        await transaction.run(
          'INSERT IGNORE INTO addons (id, category, label, price, active, updated_at) VALUES (?, ?, ?, ?, 1, ?)',
          [addon.id, addon.category, addon.label, addon.price, createdAt],
        );
      }
    });
  }
  await db.run("UPDATE users SET name = 'Akbar' WHERE username = 'owner'");
  await db.run("UPDATE users SET name = 'Tanada' WHERE username = 'kasir1'");
  await db.run("UPDATE users SET name = 'Stand' WHERE username = 'kasir2'");
  for (const camera of initialCameras) {
    await db.run(
      'INSERT IGNORE INTO cameras (id, name, price_1h, price_2h, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
      [camera.id, camera.name, camera.price1h, camera.price2h, createdAt, createdAt],
    );
  }
}
