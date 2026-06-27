'use strict';
/**
 * scraper.js
 * ─────────────────────────────────────────────────────────────
 * Scrapes Spotify reviews directly from the Google Play Store
 * and the Apple App Store using free, open-source libraries.
 * No API key required.
 *
 * Raw JSON dumps are saved to: data/scraped/
 *   • playstore_<timestamp>.json
 *   • appstore_<timestamp>.json
 *
 * Dependencies: google-play-scraper (ESM), node-fetch, dotenv
 * Called by:   scripts/run_ingestion.js, src/api/routes/pipeline.js
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const path  = require('path');
const fs    = require('fs');
const fetch = require('node-fetch');

// ── Config ──────────────────────────────────────────────────────
const PLAYSTORE_ID = process.env.SPOTIFY_PLAYSTORE_ID || 'com.spotify.music';
const APPSTORE_ID  = parseInt((process.env.SPOTIFY_APPSTORE_ID || '324684580').replace(/^id/i, ''), 10);
const MAX_REVIEWS  = parseInt(process.env.MAX_REVIEWS || '500', 10);

// Directory for raw JSON dumps (separate from SQLite)
const SCRAPED_DIR = path.resolve(__dirname, '../../data/scraped');

// ── Helpers ─────────────────────────────────────────────────────
function ensureScrapedDir() {
  if (!fs.existsSync(SCRAPED_DIR)) {
    fs.mkdirSync(SCRAPED_DIR, { recursive: true });
    console.log(`[Scraper] Created directory: ${SCRAPED_DIR}`);
  }
}

/**
 * Saves raw scraped items as a timestamped JSON file in data/scraped/
 */
function saveRawDump(platform, items) {
  ensureScrapedDir();
  const ts       = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${platform}_${ts}.json`;
  const filepath = path.join(SCRAPED_DIR, filename);
  fs.writeFileSync(
    filepath,
    JSON.stringify({ platform, scraped_at: new Date().toISOString(), count: items.length, reviews: items }, null, 2),
    'utf-8'
  );
  console.log(`[Scraper] 💾 Raw dump → ${filepath} (${items.length} items)`);
  return filepath;
}

// ── Normalizers ─────────────────────────────────────────────────

function normalizePlayStore(item) {
  const reviewId =
    item.id ||
    `playstore_${(item.userName || 'anon')}_${(item.date || '')}_${(item.text || '').slice(0, 40)}`
      .replace(/\s+/g, '_').toLowerCase();
  return {
    review_id:   String(reviewId).slice(0, 255),
    platform:    'playstore',
    rating:      parseInt(item.score || 0, 10),
    review_date: item.date ? new Date(item.date).toISOString() : null,
    text:        (item.text || '').trim(),
    title:       null,
    author:      (item.userName || 'Anonymous').trim(),
    app_version: item.version || null,
    language:    'en',
  };
}

function normalizeAppStore(item) {
  // Handles items from the amp-api format
  const attrs    = item.attributes || item;
  const reviewId =
    item.id ||
    `appstore_${(attrs.userName || attrs.reviewerNickname || 'anon')}_${(attrs.date || '')}_${(attrs.review || attrs.text || '').slice(0, 40)}`
      .replace(/\s+/g, '_').toLowerCase();
  return {
    review_id:   String(reviewId).slice(0, 255),
    platform:    'appstore',
    rating:      parseInt(attrs.rating || attrs.score || 0, 10),
    review_date: attrs.date ? new Date(attrs.date).toISOString() : null,
    text:        (attrs.review || attrs.body || attrs.text || '').trim(),
    title:       (attrs.title || '').trim() || null,
    author:      (attrs.userName || attrs.reviewerNickname || 'Anonymous').trim(),
    app_version: attrs.versionExternalIdentifier || attrs.version || null,
    language:    'en',
  };
}

// ── Play Store ──────────────────────────────────────────────────

/**
 * Scrapes reviews from the Google Play Store.
 * google-play-scraper is an ESM package — loaded via dynamic import().
 */
async function scrapePlayStore(maxReviews = MAX_REVIEWS) {
  console.log(`\n[Scraper] 🤖 Fetching Play Store reviews for: ${PLAYSTORE_ID}`);
  console.log(`[Scraper]    Max: ${maxReviews} reviews`);

  // Dynamic import for ESM package inside CommonJS project
  const { default: gplay } = await import('google-play-scraper');

  const rawItems = [];
  let nextToken  = undefined;
  let page       = 0;
  const BATCH    = 150;

  while (rawItems.length < maxReviews) {
    const needed = maxReviews - rawItems.length;
    let result;
    try {
      result = await gplay.reviews({
        appId:               PLAYSTORE_ID,
        lang:                'en',
        country:             'in',          // IN locale as per user-provided URL
        sort:                gplay.sort.NEWEST,
        num:                 Math.min(BATCH, needed),
        paginate:            true,
        nextPaginationToken: nextToken,
      });
    } catch (err) {
      console.error(`[Scraper] ❌ Play Store fetch failed on page ${page}:`, err.message);
      break;
    }

    const batch = Array.isArray(result) ? result : (result.data || []);
    nextToken   = result.nextPaginationToken || null;

    if (!batch.length) break;
    rawItems.push(...batch);
    page++;
    console.log(`[Scraper]    Page ${page}: +${batch.length} (total: ${rawItems.length})`);

    if (!nextToken || batch.length < BATCH) break;
  }

  console.log(`[Scraper] ✅ Play Store: ${rawItems.length} raw reviews`);
  saveRawDump('playstore', rawItems);

  const normalized = rawItems
    .map(normalizePlayStore)
    .filter((r) => r.text && r.text.length >= 10);
  console.log(`[Scraper]    ${normalized.length} usable reviews after filtering`);
  return normalized;
}

// ── App Store ───────────────────────────────────────────────────

/**
 * Fetches a bearer token from the App Store web page (required by amp-api).
 * The token is embedded as a meta tag in the app's store page HTML.
 */
async function fetchAppStoreToken() {
  const url = `https://apps.apple.com/us/app/spotify-music-and-podcasts/id${APPSTORE_ID}`;
  const res  = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`App Store page fetch failed: ${res.status}`);
  const html  = await res.text();
  const match = html.match(/token%22%3A%22([^%]+)%22/);
  if (match) return decodeURIComponent(match[1]);
  // fallback: look for meta tag
  const meta = html.match(/<meta name="web-experience-app\/config\/environment" content="([^"]+)"/);
  if (meta) {
    const config = JSON.parse(decodeURIComponent(meta[1]));
    const token  = config?.MEDIA_API?.token;
    if (token) return token;
  }
  throw new Error('Could not extract App Store bearer token from page HTML');
}

/**
 * Scrapes reviews from the Apple App Store using the amp-api endpoint.
 */
async function scrapeAppStore(maxReviews = MAX_REVIEWS) {
  console.log(`\n[Scraper] 🍎 Fetching App Store reviews for ID: ${APPSTORE_ID}`);
  console.log(`[Scraper]    Max: ${maxReviews} reviews`);

  let token;
  try {
    token = await fetchAppStoreToken();
    console.log(`[Scraper]    ✅ Bearer token acquired`);
  } catch (err) {
    console.warn(`[Scraper]    ⚠️  Could not get App Store token: ${err.message}`);
    console.warn(`[Scraper]    Skipping App Store (Apple RSS is deprecated). Play Store data will be used.`);
    saveRawDump('appstore', []);
    return [];
  }

  const rawItems = [];
  let offset = 0;
  const LIMIT = 20;

  while (rawItems.length < maxReviews) {
    const url = `https://amp-api.apps.apple.com/v1/catalog/us/apps/${APPSTORE_ID}/reviews`
      + `?platform=web&additionalPlatforms=appletv%2Cipad%2Ciphone%2Cmac`
      + `&l=en-US&offset=${offset}&limit=${LIMIT}`;

    let data;
    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Origin':        'https://apps.apple.com',
          'Referer':       'https://apps.apple.com/',
          'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      if (!res.ok) throw new Error(`amp-api status ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.error(`[Scraper] ❌ App Store fetch failed at offset ${offset}:`, err.message);
      break;
    }

    const batch = data.data || [];
    if (!batch.length) break;

    rawItems.push(...batch);
    offset += LIMIT;
    console.log(`[Scraper]    offset ${offset - LIMIT}: +${batch.length} (total: ${rawItems.length})`);

    // Check for next page
    const nextHref = data.next;
    if (!nextHref || rawItems.length >= maxReviews) break;
  }

  console.log(`[Scraper] ✅ App Store: ${rawItems.length} raw reviews`);
  saveRawDump('appstore', rawItems);

  const normalized = rawItems
    .map(normalizeAppStore)
    .filter((r) => r.text && r.text.length >= 10);
  console.log(`[Scraper]    ${normalized.length} usable reviews after filtering`);
  return normalized;
}

// ── Main export ─────────────────────────────────────────────────

/**
 * Scrapes all configured platforms.
 *
 * @param {Object} [options]
 * @param {string} [options.source]     'appstore' | 'playstore' | 'both' (default)
 * @param {number} [options.maxReviews]
 * @returns {Promise<Object[]>} Combined normalized reviews
 */
async function scrapeAllTargets(options = {}) {
  const { source = 'both', maxReviews = MAX_REVIEWS } = options;
  const allReviews = [];

  if (source === 'playstore' || source === 'both') {
    try {
      const reviews = await scrapePlayStore(maxReviews);
      allReviews.push(...reviews);
    } catch (err) {
      console.error(`[Scraper] ⚠️  Play Store skipped: ${err.message}`);
    }
  }

  if (source === 'appstore' || source === 'both') {
    try {
      const reviews = await scrapeAppStore(maxReviews);
      allReviews.push(...reviews);
    } catch (err) {
      console.error(`[Scraper] ⚠️  App Store skipped: ${err.message}`);
    }
  }

  console.log(`\n[Scraper] ✅ Total usable reviews scraped: ${allReviews.length}`);
  return allReviews;
}

module.exports = {
  scrapeAllTargets,
  scrapePlayStore,
  scrapeAppStore,
  normalizePlayStore,
  normalizeAppStore,
};
