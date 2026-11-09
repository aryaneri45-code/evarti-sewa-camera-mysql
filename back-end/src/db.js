import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

export const initialCameras = [
  { id: 'canon-ixus-160', name: 'Canon Ixus 160', price1h: 15000, price2h: 23000 },
  { id: 'canon-ixus-185', name: 'Canon Ixus 185', price1h: 18000, price2h: 27000 },
  { id: 'canon-ixus-285', name: 'Canon Ixus 285', price1h: 30000, price2h: 45000 },
  { id: 'canon-SX610-HS', name: 'Canon SX610 HS', price1h: 40000, price2h: 60000 },
  { id: 'sony-dsc-w810', name: 'Sony DSC W810', price1h: 20000, price2h: 30000 },
  { id: 'sony-dsc-wx7', name: 'Sony DSC WX7', price1h: 25000, price2h: 38000 },
  { id: 'sony-dsc-s950', name: 'Sony DSC S950', price1h: 18000, price2h: 27000 },
  { id: 'nikon-coolpix-s3500', name: 'Nikon Coolpix S3500', price1h: 18000, price2h: 27000 },
  { id: 'nikon-coolpix-a100', name: 'Nikon Coolpix A100', price1h: 15000, price2h: 23000 },
  { id: 'fujifilm-finepix-jv', name: 'Fujifilm FinePix JV', price1h: 10000, price2h: 15000 },
  { id: 'casio-qv-r200', name: 'Casio QV-R200', price1h: 10000, price2h: 15000 },
  { id: 'lumix-dmc-fx520', name: 'Lumix DMC-FX520', price1h: 15000, price2h: 23000 },
  { id: 'lumix-dmc-lx7', name: 'Lumix DMC-LX7', price1h: 30000, price2h: 45000 },
  { id: 'olympus-mtough-8010', name: 'Olympus MTough - 8010', price1h: 15000, price2h: 20000 },
];

export const initialAddons = [
  { id: 'print-1', category: 'print', label: '1 foto', price: 10000 },
  { id: 'print-2', category: 'print', label: '2 foto', price: 15000 },
  { id: 'print-3', category: 'print', label: '3 foto', price: 20000 },
  { id: 'print-4', category: 'print', label: '4 foto', price: 20000 },
  { id: 'print-5', category: 'print', label: '5 foto', price: 25000 },
  { id: 'Analog A', category: 'property', label: 'Analog A', price: 10000 },
  { id: 'Analog B', category: 'property', label: 'Analog B', price: 5000 },
  { id: 'Analog C', category: 'property', label: 'Analog C', price: 7000 },
  { id: 'Airdrop/Local Send', category: 'transfer', label: '100 Foto', price: 5000 },
  { id: 'Google Drive - 1 week', category: 'transfer', label: '100 Foto', price: 10000 },
  { id: 'fotografer-5', category: 'photographer', label: '5 foto', price: 10000 },
  { id: 'fotografer-10', category: 'photographer', label: '10 foto', price: 18000 },
  { id: 'fotografer-15', category: 'photographer', label: '15 foto', price: 25000 },
];

const schema = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'kasir')),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    csrf_token TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS cameras (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image_path TEXT,
    price_1h INTEGER NOT NULL CHECK (price_1h > 0),
    price_2h INTEGER NOT NULL CHECK (price_2h > 0),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS addons (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('property', 'photographer', 'print', 'transfer')),
    label TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS receipt_sequences (
    location_prefix TEXT NOT NULL,
    receipt_date TEXT NOT NULL,
    last_number INTEGER NOT NULL,
    PRIMARY KEY (location_prefix, receipt_date)
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    receipt_no TEXT NOT NULL UNIQUE,
    cashier_id TEXT NOT NULL REFERENCES users(id),
    location TEXT NOT NULL CHECK (location IN ('cafe', 'event')),
    customer_name TEXT NOT NULL,
    customer_whatsapp TEXT NOT NULL,
    customer_pager_number TEXT,
    guarantee_type TEXT NOT NULL CHECK (guarantee_type IN ('none', 'photo', 'id_number')),
    guarantee_photo_path TEXT,
    guarantee_id_number TEXT,
    camera_id TEXT REFERENCES cameras(id) ON DELETE SET NULL,
    camera_name TEXT NOT NULL,
    duration_label TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price > 0),
    is_manual_price INTEGER NOT NULL DEFAULT 0 CHECK (is_manual_price IN (0, 1)),
    manual_note TEXT,
    total INTEGER NOT NULL CHECK (total > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'qris_dana')),
    amount_received INTEGER NOT NULL CHECK (amount_received >= 0),
    change_amount INTEGER NOT NULL CHECK (change_amount >= 0),
    payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'pending_verification', 'void')),
    verified_by TEXT REFERENCES users(id),
    verified_at TEXT,
    voided_by TEXT REFERENCES users(id),
    voided_at TEXT,
    void_reason TEXT,
    printed_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS transaction_items (
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    camera_id TEXT REFERENCES cameras(id) ON DELETE SET NULL,
    camera_name TEXT NOT NULL,
    duration_label TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    price INTEGER NOT NULL CHECK (price > 0),
    is_manual_price INTEGER NOT NULL DEFAULT 0 CHECK (is_manual_price IN (0, 1)),
    manual_note TEXT,
    PRIMARY KEY (transaction_id, position)
  );
  CREATE TABLE IF NOT EXISTS transaction_addons (
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    addon_id TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('property', 'photographer', 'print', 'transfer')),
    label TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    PRIMARY KEY (transaction_id, position)
  );
  CREATE INDEX IF NOT EXISTS transaction_items_camera_idx ON transaction_items(camera_id);
  CREATE INDEX IF NOT EXISTS transactions_cashier_created_idx ON transactions(cashier_id, created_at);
  CREATE INDEX IF NOT EXISTS transactions_location_created_idx ON transactions(location, created_at);
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    transaction_id TEXT REFERENCES transactions(id),
    detail TEXT,
    created_at TEXT NOT NULL
  );
`;

export function createDatabase({ filename = './.data/evarti.sqlite', passwords, database } = {}) {
  if (!database && filename !== ':memory:') {
    const directory = path.dirname(path.resolve(filename));
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  const db = database || new Database(filename);
  if (!database && filename !== ':memory:' && process.platform !== 'win32') {
    fs.chmodSync(path.resolve(filename), 0o600);
  }
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schema);
  const transactionColumns = db.pragma('table_info(transactions)');
  if (!transactionColumns.some((column) => column.name === 'customer_pager_number')) {
    db.exec('ALTER TABLE transactions ADD COLUMN customer_pager_number TEXT');
  }
  db.exec(`
    INSERT INTO transaction_items (
      transaction_id, position, camera_id, camera_name, duration_label,
      duration_minutes, price, is_manual_price, manual_note
    )
    SELECT t.id, 1, t.camera_id, t.camera_name, t.duration_label,
      t.duration_minutes, t.price, t.is_manual_price, t.manual_note
    FROM transactions t
    WHERE NOT EXISTS (
      SELECT 1 FROM transaction_items i WHERE i.transaction_id = t.id
    )
  `);
  seedDatabase(db, passwords);
  const parameters = (values) => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  db.get = async (sql, ...values) => db.prepare(sql).get(...parameters(values));
  db.all = async (sql, ...values) => db.prepare(sql).all(...parameters(values));
  db.run = async (sql, ...values) => db.prepare(sql).run(...parameters(values));
  db.dateAtJakarta = (column) => `date(${column}, '+7 hours')`;
  db.transaction = async (callback) => {
    db.exec('BEGIN');
    try {
      const result = await callback(db);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  db.nextReceiptNumber = async (prefix, receiptDate) => {
    await db.run(`
      INSERT INTO receipt_sequences (location_prefix, receipt_date, last_number)
      VALUES (?, ?, 1)
      ON CONFLICT(location_prefix, receipt_date)
      DO UPDATE SET last_number = last_number + 1
    `, prefix, receiptDate);
    const sequence = await db.get(
      'SELECT last_number FROM receipt_sequences WHERE location_prefix = ? AND receipt_date = ?',
      prefix,
      receiptDate,
    );
    return sequence.last_number;
  };
  return db;
}

export function seedDatabase(db, passwords = {}) {
  const count = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (count === 0) {
    const accounts = [
      { id: 'owner', username: 'owner', name: 'Akbar', role: 'owner', password: passwords.owner },
      { id: 'kasir1', username: 'kasir1', name: 'Tanada', role: 'kasir', password: passwords.cashier1 },
      { id: 'kasir2', username: 'kasir2', name: 'Stand', role: 'kasir', password: passwords.cashier2 },
    ];
    if (accounts.some((account) => !account.password || account.password.length < 12)) {
      throw new Error('Password bootstrap Owner, Kasir 1, dan Kasir 2 harus diatur (minimal 12 karakter).');
    }
    const insertUser = db.prepare(
      'INSERT INTO users (id, username, password_hash, role, name) VALUES (?, ?, ?, ?, ?)',
    );
    const seedUsers = db.transaction(() => {
      for (const account of accounts) {
        insertUser.run(account.id, account.username, bcrypt.hashSync(account.password, 12), account.role, account.name);
      }
      // Bootstrap the add-on catalog once, together with the first accounts.
      // Re-inserting defaults on restart would restore choices the owner deleted.
      const insertAddon = db.prepare(
        'INSERT OR IGNORE INTO addons (id, category, label, price, active) VALUES (?, ?, ?, ?, 1)',
      );
      for (const addon of initialAddons) {
        insertAddon.run(addon.id, addon.category, addon.label, addon.price);
      }
    });
    seedUsers();
  }
  const updateUserName = db.prepare('UPDATE users SET name = ? WHERE username = ?');
  updateUserName.run('Akbar', 'owner');
  updateUserName.run('Tanada', 'kasir1');
  updateUserName.run('Stand', 'kasir2');
  const insertCamera = db.prepare(
    'INSERT OR IGNORE INTO cameras (id, name, price_1h, price_2h, active) VALUES (?, ?, ?, ?, 1)',
  );
  for (const camera of initialCameras) {
    insertCamera.run(camera.id, camera.name, camera.price1h, camera.price2h);
  }
}

export function closeDatabase(db) {
  if (db?.close) return db.close();
  if (db?.open) db.close();
}
