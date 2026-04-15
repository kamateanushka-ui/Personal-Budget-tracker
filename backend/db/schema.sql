-- ============================================================
-- BudgetIQ — Personal Budget Tracker Database Schema
-- DBMS: SQLite  |  Concepts: DDL, Constraints, FK, Indexes
-- ============================================================

PRAGMA foreign_keys = ON;

-- ── 1. USERS ────────────────────────────────────────────────
-- Stores user accounts with hashed passwords
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  username      TEXT     NOT NULL UNIQUE,
  password_hash TEXT     NOT NULL,
  display_name  TEXT     NOT NULL DEFAULT 'User',
  created_at    TEXT     NOT NULL DEFAULT (datetime('now'))
);

-- ── 2. CATEGORIES ───────────────────────────────────────────
-- Lookup table for transaction categories (normalised design)
-- 'type' differentiates income vs expense categories
CREATE TABLE IF NOT EXISTS categories (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT    NOT NULL UNIQUE,
  type  TEXT    NOT NULL CHECK(type IN ('income','expense','both'))
);

-- ── 3. TRANSACTIONS ─────────────────────────────────────────
-- Core table; every income / expense entry lives here.
-- Uses FK to users (owner) and categories (category lookup).
CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  type        TEXT    NOT NULL CHECK(type IN ('income','expense')),
  description TEXT    NOT NULL,
  amount      REAL    NOT NULL CHECK(amount > 0),
  txn_date    TEXT    NOT NULL,          -- ISO 8601: YYYY-MM-DD
  note        TEXT    DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── INDEXES (for frequent query patterns) ───────────────────
CREATE INDEX IF NOT EXISTS idx_txn_user_id   ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_txn_type      ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_txn_date      ON transactions(txn_date);
CREATE INDEX IF NOT EXISTS idx_txn_category  ON transactions(category_id);

-- ── SEED: default categories ────────────────────────────────
INSERT OR IGNORE INTO categories(name, type) VALUES
  ('Salary',        'income'),
  ('Freelance',     'income'),
  ('Investment',    'income'),
  ('Business',      'income'),
  ('Gift',          'income'),
  ('Food',          'expense'),
  ('Transport',     'expense'),
  ('Shopping',      'expense'),
  ('Utilities',     'expense'),
  ('Healthcare',    'expense'),
  ('Entertainment', 'expense'),
  ('Education',     'expense'),
  ('Rent',          'expense'),
  ('Other',         'both');

-- ── SEED: demo admin user (password: 1234) ──────────────────
-- bcrypt hash of "1234" with salt rounds = 10
-- Generated via: bcrypt.hashSync('1234', 10)
-- We insert a placeholder; the app will re-hash on first run.
INSERT OR IGNORE INTO users(username, password_hash, display_name)
  VALUES('admin', '__PLACEHOLDER__', 'Admin User');
