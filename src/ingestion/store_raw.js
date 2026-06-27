'use strict';
/**
 * store_raw.js
 * ─────────────────────────────────────────────────────────────
 * Opens (or creates) the SQLite database at data/raw/reviews.db
 * using sql.js (pure JavaScript/WASM — no native build required).
 *
 * Because sql.js operates entirely in memory, we persist the DB
 * to disk manually (save on write, load on open).
 *
 * Dependencies: sql.js, fs, path
 * Called by:   scripts/run_ingestion.js, src/api/routes/pipeline.js
 * ─────────────────────────────────────────────────────────────
 */

const path  = require('path');
const fs    = require('fs');
const initSqlJs = require('sql.js');

// ── Paths ──────────────────────────────────────────────────────
const DB_DIR      = path.resolve(__dirname, '../../data/raw');
const DB_PATH     = path.join(DB_DIR, 'reviews.db');
const SCHEMA_PATH = path.resolve(__dirname, './schema.sql');

/**
 * Loads (or creates) the SQLite DB using sql.js.
 * Returns { db, SQL } — call persistDb(db) after writes.
 *
 * @returns {Promise<{ db: object, SQL: object }>}
 */
async function openDatabase() {
  // Ensure data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  let db;
  if (fs.existsSync(DB_PATH)) {
    // Load existing DB from disk
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    // Create new in-memory DB
    db = new SQL.Database();
    console.log('[DB] Created new database at', DB_PATH);
  }

  // Apply schema (CREATE TABLE IF NOT EXISTS — safe to re-run)
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.run(schema);

  return { db, SQL };
}

/**
 * Persists the in-memory sql.js database to disk.
 *
 * @param {object} db  sql.js Database instance
 */
function persistDb(db) {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * Inserts an array of normalized review objects into SQLite.
 * INSERT OR IGNORE prevents duplicates by review_id.
 *
 * @param {Object[]} reviews  Array of normalized review objects
 * @returns {Promise<{ inserted: number, skipped: number, total: number }>}
 */
async function storeReviews(reviews) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    console.log('[DB] No reviews to store.');
    return { inserted: 0, skipped: 0, total: 0 };
  }

  const { db } = await openDatabase();

  // Count rows before
  const beforeRes = db.exec('SELECT COUNT(*) FROM raw_reviews');
  const before = beforeRes.length ? beforeRes[0].values[0][0] : 0;

  // Prepare insert statement
  const insertSQL = `
    INSERT OR IGNORE INTO raw_reviews (
      review_id, platform, rating, review_date,
      text, title, author, app_version, language
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Execute all inserts
  for (const row of reviews) {
    try {
      db.run(insertSQL, [
        row.review_id,
        row.platform,
        row.rating    ?? null,
        row.review_date ?? null,
        row.text,
        row.title     ?? null,
        row.author    ?? null,
        row.app_version ?? null,
        row.language  ?? 'en',
      ]);
    } catch (err) {
      console.warn(`[DB] Skipping row (${row.review_id}): ${err.message}`);
    }
  }

  // Count rows after
  const afterRes = db.exec('SELECT COUNT(*) FROM raw_reviews');
  const after = afterRes.length ? afterRes[0].values[0][0] : 0;

  // Persist to disk
  persistDb(db);
  db.close();

  const inserted = after - before;
  const skipped  = reviews.length - inserted;

  console.log(`[DB] ✅ Stored ${inserted} new reviews | Skipped ${skipped} duplicates`);
  console.log(`[DB] Total reviews in database: ${after}`);

  return { inserted, skipped, total: after };
}

/**
 * Returns database statistics for the /api/stats route.
 *
 * @returns {Promise<Object>}
 */
async function getStats() {
  const { db } = await openDatabase();

  const exec = (sql) => {
    const res = db.exec(sql);
    if (!res.length) return [];
    return res[0].values.map((row) => {
      const obj = {};
      res[0].columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  };

  const totalRes = db.exec('SELECT COUNT(*) AS n FROM raw_reviews');
  const vectorizedRes = db.exec("SELECT COUNT(*) AS n FROM raw_reviews WHERE vectorized = 1");
  const pendingRes = db.exec("SELECT COUNT(*) AS n FROM raw_reviews WHERE vectorized = 0");

  const total      = totalRes.length ? totalRes[0].values[0][0] : 0;
  const vectorized = vectorizedRes.length ? vectorizedRes[0].values[0][0] : 0;
  const pending    = pendingRes.length ? pendingRes[0].values[0][0] : 0;

  const byPlatform = exec(`
    SELECT platform, COUNT(*) AS count FROM raw_reviews GROUP BY platform
  `);

  const byRating = exec(`
    SELECT rating, COUNT(*) AS count FROM raw_reviews
    WHERE rating IS NOT NULL GROUP BY rating ORDER BY rating
  `);

  const recentIngestions = exec(`
    SELECT DATE(ingested_at) AS date, COUNT(*) AS count
    FROM raw_reviews GROUP BY DATE(ingested_at)
    ORDER BY date DESC LIMIT 30
  `);

  const lastRes = db.exec('SELECT MAX(ingested_at) AS ts FROM raw_reviews');
  const lastIngested = lastRes[0]?.values[0][0] || null;

  db.close();

  return { total, vectorized, pending, byPlatform, byRating, recentIngestions, lastIngested };
}

/**
 * Returns all reviews with vectorized = 0 (not yet embedded).
 *
 * @param {number} [limit=1000]
 * @returns {Promise<Object[]>}
 */
async function getPendingReviews(limit = 1000) {
  const { db } = await openDatabase();

  const res = db.exec(`
    SELECT * FROM raw_reviews WHERE vectorized = 0
    ORDER BY ingested_at ASC LIMIT ${Number(limit)}
  `);

  db.close();

  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const obj = {};
    cols.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

/**
 * Marks an array of review_ids as vectorized = 1.
 *
 * @param {string[]} reviewIds
 */
async function markVectorized(reviewIds) {
  if (!reviewIds || reviewIds.length === 0) return;

  const { db } = await openDatabase();
  for (const id of reviewIds) {
    db.run('UPDATE raw_reviews SET vectorized = 1 WHERE review_id = ?', [id]);
  }
  persistDb(db);
  db.close();
  console.log(`[DB] Marked ${reviewIds.length} reviews as vectorized`);
}

module.exports = { storeReviews, getStats, getPendingReviews, markVectorized, openDatabase };
