/**
 * db/database.js
 * ──────────────
 * Sets up the SQLite database connection using better-sqlite3.
 * Applies the SQL schema (DDL) and seeds default data on first run.
 * 
 * DBMS concepts demonstrated:
 *  - DDL (CREATE TABLE, CREATE INDEX)
 *  - Referential integrity (FOREIGN KEYS, ON DELETE CASCADE)
 *  - CHECK constraints
 *  - Seed / initial data population
 */

const Database = require('better-sqlite3');
const path     = require('path');
const bcrypt   = require('bcryptjs');

// ── 1. Open / create the database file ──────────────────────
const DB_PATH = path.join(__dirname, 'budgetiq.db');
const db      = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── 2. Apply DDL Schema ──────────────────────────────────────
// Each statement executed individually for clarity and safety.
// DBMS Concept: DDL, CHECK constraints, NOT NULL, UNIQUE
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER  PRIMARY KEY AUTOINCREMENT,
    username      TEXT     NOT NULL UNIQUE,
    password_hash TEXT     NOT NULL,
    display_name  TEXT     NOT NULL DEFAULT 'User',
    created_at    TEXT     NOT NULL DEFAULT (datetime('now'))
  )
`);

// DBMS Concept: Normalisation — separate lookup table avoids
// repeating category strings in every transaction row
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT    NOT NULL UNIQUE,
    type  TEXT    NOT NULL CHECK(type IN ('income','expense','both'))
  )
`);

// DBMS Concept: Foreign Keys (ON DELETE CASCADE / RESTRICT),
// CHECK constraint on type and amount
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    type        TEXT    NOT NULL CHECK(type IN ('income','expense')),
    description TEXT    NOT NULL,
    amount      REAL    NOT NULL CHECK(amount > 0),
    txn_date    TEXT    NOT NULL,
    note        TEXT    DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

// DBMS Concept: Indexes speed up frequent WHERE / JOIN queries
db.exec(`CREATE INDEX IF NOT EXISTS idx_txn_user_id  ON transactions(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_txn_type     ON transactions(type)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_txn_date     ON transactions(txn_date)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_txn_category ON transactions(category_id)`);

// ── 3. Seed default categories ───────────────────────────────
// DBMS Concept: INSERT OR IGNORE (upsert-lite) keeps seeds idempotent
const seedCategories = db.transaction(() => {
  const ins = db.prepare(`INSERT OR IGNORE INTO categories(name, type) VALUES (?, ?)`);
  [
    ['Salary',        'income'],
    ['Freelance',     'income'],
    ['Investment',    'income'],
    ['Business',      'income'],
    ['Gift',          'income'],
    ['Food',          'expense'],
    ['Transport',     'expense'],
    ['Shopping',      'expense'],
    ['Utilities',     'expense'],
    ['Healthcare',    'expense'],
    ['Entertainment', 'expense'],
    ['Education',     'expense'],
    ['Rent',          'expense'],
    ['Other',         'both'],
  ].forEach(([name, type]) => ins.run(name, type));
});
seedCategories();

// ── 4. Seed admin user (password: 1234) ──────────────────────
const existingAdmin = db.prepare(`SELECT id FROM users WHERE username = 'admin'`).get();
if (!existingAdmin) {
  const hash = bcrypt.hashSync('1234', 10);
  db.prepare(`INSERT INTO users(username, password_hash, display_name) VALUES ('admin', ?, 'Admin User')`).run(hash);
  console.log('[DB] Admin user created (admin / 1234).');
}

// ── 5. Seed demo transactions (only when DB is fresh) ────────
const txnCount = db.prepare(`SELECT COUNT(*) as cnt FROM transactions`).get();
if (txnCount.cnt === 0) {
  const adminUser = db.prepare(`SELECT id FROM users WHERE username='admin'`).get();
  const catId = name => db.prepare(`SELECT id FROM categories WHERE name=?`).get(name)?.id;

  // DBMS Concept: db.transaction wraps multiple INSERTs in one atomic operation
  const insertTxn = db.prepare(`
    INSERT INTO transactions(user_id, category_id, type, description, amount, txn_date, note)
    VALUES(@user_id, @category_id, @type, @description, @amount, @txn_date, @note)
  `);

  const seedData = [
    { type:'income',  description:'Monthly Salary',      cat:'Salary',        amount:45000, txn_date:'2025-04-01', note:'April salary' },
    { type:'income',  description:'Freelance Project',   cat:'Freelance',     amount:8500,  txn_date:'2025-04-05', note:'' },
    { type:'expense', description:'Grocery Shopping',    cat:'Food',          amount:3200,  txn_date:'2025-04-03', note:'' },
    { type:'expense', description:'Electricity Bill',    cat:'Utilities',     amount:1400,  txn_date:'2025-04-04', note:'' },
    { type:'expense', description:'Online Course',       cat:'Education',     amount:2999,  txn_date:'2025-04-06', note:'Udemy course' },
    { type:'expense', description:'Petrol',              cat:'Transport',     amount:800,   txn_date:'2025-04-07', note:'' },
    { type:'expense', description:'Movie + Dinner',      cat:'Entertainment', amount:1200,  txn_date:'2025-04-08', note:'' },
    { type:'income',  description:'Investment Return',   cat:'Investment',    amount:3200,  txn_date:'2025-04-10', note:'Mutual fund' },
    { type:'expense', description:'Monthly Rent',        cat:'Rent',          amount:12000, txn_date:'2025-04-01', note:'' },
    { type:'expense', description:'Doctor Consultation', cat:'Healthcare',    amount:600,   txn_date:'2025-04-09', note:'' },
  ];

  db.transaction(rows => {
    for (const r of rows) {
      insertTxn.run({
        user_id:     adminUser.id,
        category_id: catId(r.cat),
        type:        r.type,
        description: r.description,
        amount:      r.amount,
        txn_date:    r.txn_date,
        note:        r.note,
      });
    }
  })(seedData);
  console.log('[DB] Seeded demo transactions.');
}

console.log(`[DB] SQLite connected → ${DB_PATH}`);
module.exports = db;
