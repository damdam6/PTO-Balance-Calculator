CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id),
  accrual_day  INTEGER NOT NULL CHECK (accrual_day BETWEEN 1 AND 31),
  base_date    TEXT NOT NULL,
  base_balance REAL NOT NULL
);

CREATE TABLE leaves (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  date       TEXT NOT NULL,
  amount     REAL NOT NULL CHECK (amount > 0 AND amount <= 1),
  type       TEXT NOT NULL CHECK (type IN ('full','half','quarter','custom')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_leaves_user_date ON leaves(user_id, date);
