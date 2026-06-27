-- ============================================================
-- schema.sql
-- SQLite table for raw Spotify app-store reviews.
-- review_id is the PRIMARY KEY — INSERT OR IGNORE prevents
-- duplicate ingestion across nightly runs.
-- ============================================================

CREATE TABLE IF NOT EXISTS raw_reviews (
  review_id    TEXT    PRIMARY KEY,          -- Unique review ID from Apify
  platform     TEXT    NOT NULL,             -- 'appstore' | 'playstore'
  rating       INTEGER,                      -- Star rating 1–5
  review_date  TEXT,                         -- ISO 8601 date string
  text         TEXT    NOT NULL,             -- Full review body
  title        TEXT,                         -- Review title (App Store only)
  author       TEXT,                         -- Reviewer display name
  app_version  TEXT,                         -- App version at time of review
  language     TEXT    DEFAULT 'en',         -- Detected language code
  ingested_at  TEXT    DEFAULT (datetime('now')),
  vectorized   INTEGER DEFAULT 0             -- 0 = pending, 1 = embedded in ChromaDB
);

-- Index for fast querying of un-vectorized reviews (used by embedder.js)
CREATE INDEX IF NOT EXISTS idx_vectorized ON raw_reviews (vectorized);

-- Index for date-range queries (used by stats API)
CREATE INDEX IF NOT EXISTS idx_date ON raw_reviews (review_date);

-- Index for platform filtering
CREATE INDEX IF NOT EXISTS idx_platform ON raw_reviews (platform);
