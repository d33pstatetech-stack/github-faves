-- Github Faves — D1 schema
-- One personal GitHub account, 218 starred repos. D1 free tier allows 5M rows
-- read/day, 100k rows written/day, 5GB total; a full re-sync writes ~250 rows.

CREATE TABLE IF NOT EXISTS repos (
  full_name        TEXT PRIMARY KEY,
  owner            TEXT NOT NULL,
  name             TEXT NOT NULL,

  description      TEXT,
  homepage         TEXT,
  language         TEXT,
  topics           TEXT,              -- JSON array of GitHub topics
  license          TEXT,
  stars            INTEGER DEFAULT 0,
  forks            INTEGER DEFAULT 0,
  open_issues      INTEGER DEFAULT 0,
  is_fork          INTEGER DEFAULT 0,
  is_archived      INTEGER DEFAULT 0,

  created_at       TEXT,              -- repo creation
  pushed_at        TEXT,              -- last push
  starred_at       TEXT,              -- when YOU starred it

  -- Badge-stripped, truncated README head used for classification + card back.
  summary          TEXT,

  -- Classification. cats/tags are JSON arrays of slugs.
  cats             TEXT DEFAULT '[]',
  tags             TEXT DEFAULT '[]',
  cat_source       TEXT,              -- rules | embed | override | mixed
  cat_scores       TEXT,              -- JSON {catSlug: {score, via}}
  embed            BLOB,              -- 384-float bge-small vector (embed fallback)
  classify_version INTEGER DEFAULT 0, -- < env.CLASSIFY_VERSION means stale

  note             TEXT,              -- sticky note
  note_updated_at  TEXT,

  synced_at        TEXT
);

-- Client-side index payload is served from KV, so these indexes only matter
-- for card-back detail reads and re-classification sweeps.
CREATE INDEX IF NOT EXISTS idx_repos_starred   ON repos(starred_at DESC);
CREATE INDEX IF NOT EXISTS idx_repos_pushed     ON repos(pushed_at DESC);
CREATE INDEX IF NOT EXISTS idx_repos_stars      ON repos(stars DESC);
CREATE INDEX IF NOT EXISTS idx_repos_name       ON repos(full_name);
CREATE INDEX IF NOT EXISTS idx_repos_stale      ON repos(classify_version);

CREATE TABLE IF NOT EXISTS categories (
  slug        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT,
  color       TEXT,
  sort        INTEGER DEFAULT 100,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  slug        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  facet       TEXT,                 -- model | effect | hardware | infra | topic | domain
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Manual corrections. Always wins over rules/embeddings.
CREATE TABLE IF NOT EXISTS overrides (
  full_name   TEXT PRIMARY KEY,
  cats        TEXT,                 -- JSON array
  tags        TEXT,                 -- JSON array
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  status      TEXT NOT NULL,        -- running | done | error
  phase       TEXT,                 -- meta | enrich | classify
  cursor      TEXT,
  total       INTEGER DEFAULT 0,
  processed   INTEGER DEFAULT 0,
  created     INTEGER DEFAULT 0,
  updated     INTEGER DEFAULT 0,
  error       TEXT,
  started_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- Only one sync runs at a time; enforced by grabbing this row.
CREATE TABLE IF NOT EXISTS sync_lock (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  run_id      INTEGER,
  started_at  TEXT
);
