-- Manual fallback only. Not required for deployment: the Worker creates
-- these tables and seeds sample contacts itself on first request (see
-- ensureSchema() in src/index.js). Kept here in case you ever want an
-- explicit, pre-populated database instead of relying on lazy creation.

CREATE TABLE IF NOT EXISTS contacts (
  email TEXT PRIMARY KEY,
  name TEXT,
  plan TEXT,
  open_tickets INTEGER DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  subject TEXT,
  summary TEXT,
  priority TEXT,
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO contacts (email, name, plan, open_tickets, notes) VALUES
  ('demo.customer@example.com', 'Demo Customer', 'pro', 0, 'Sample seeded contact'),
  ('angry.customer@example.com', 'Angry Customer', 'starter', 1, 'Has an existing open ticket');
