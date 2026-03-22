ALTER TABLE accounts ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS idx_accounts_archived ON accounts(is_archived);
