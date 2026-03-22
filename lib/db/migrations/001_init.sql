PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL UNIQUE,
  filename TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT,
  display_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS account_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_uid TEXT NOT NULL UNIQUE,
  source_hash TEXT NOT NULL UNIQUE,
  source_type INTEGER,
  name TEXT NOT NULL,
  order_seq INTEGER,
  source_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_uid TEXT NOT NULL UNIQUE,
  source_hash TEXT NOT NULL UNIQUE,
  account_group_id INTEGER REFERENCES account_groups(id) ON DELETE SET NULL,
  source_group_uid TEXT,
  currency_uid TEXT,
  display_name TEXT NOT NULL,
  nickname TEXT,
  card_day_fin TEXT,
  card_day_pay TEXT,
  app_package TEXT,
  app_name TEXT,
  sms_tel TEXT,
  sms_string TEXT,
  is_transfer_expense INTEGER NOT NULL DEFAULT 0,
  is_card_auto_pay INTEGER NOT NULL DEFAULT 0,
  source_type INTEGER,
  order_seq INTEGER,
  source_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_uid TEXT NOT NULL UNIQUE,
  source_hash TEXT NOT NULL UNIQUE,
  parent_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  source_parent_uid TEXT,
  name TEXT NOT NULL,
  category_type INTEGER,
  status INTEGER,
  order_seq INTEGER,
  source_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_uid TEXT NOT NULL UNIQUE,
  account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  source_account_uid TEXT,
  target_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  source_target_account_uid TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  source_category_uid TEXT,
  transaction_type INTEGER,
  transaction_date TEXT,
  booked_at TEXT,
  paid_at TEXT,
  amount REAL,
  amount_account REAL,
  memo TEXT,
  content TEXT,
  payee TEXT,
  sms_origin TEXT,
  source_hash TEXT NOT NULL,
  source_deleted INTEGER NOT NULL DEFAULT 0,
  is_paid INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  origin TEXT NOT NULL DEFAULT 'import',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file_name TEXT NOT NULL,
  source_file_path TEXT NOT NULL,
  source_file_sha256 TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS import_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_batch_id INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  action TEXT NOT NULL,
  local_payload_json TEXT,
  incoming_payload_json TEXT,
  diff_payload_json TEXT,
  resolved_at TEXT,
  resolved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_accounts_group_id ON accounts(account_group_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_import_candidates_batch_id ON import_candidates(import_batch_id);
