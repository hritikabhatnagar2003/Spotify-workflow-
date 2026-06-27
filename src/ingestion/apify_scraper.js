'use strict';
/**
 * apify_scraper.js
 * ─────────────────────────────────────────────────────────────
 * Triggers the Apify app-reviews-scraper actor for both the
 * Spotify App Store (iOS) and Play Store (Android) listings,
 * waits for the run to complete, and returns a normalized array
 * of review objects ready for SQLite insertion.
 *
 * Dependencies: apify-client, dotenv
 * Called by:   scripts/run_ingestion.js, src/api/routes/pipeline.js
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const { ApifyClient } = require('apify-client');
const appsConfig = require('../../config/apps.json');

// ── Client initialization ──────────────────────────────────────
const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

/**
 * Normalizes a raw Apify review item into our standard schema shape.
 * Different actors return slightly different field names — this
 * function handles both App Store and Play Store conventions.
 *
 * @param {Object} item   Raw item from Apify dataset
 * @param {string} platform  'appstore' | 'playstore'
 * @returns {Object} Normalized review object
 */
function normalizeReview(item, platform) {
  // Apify actors use different field names per store
  const reviewId =
    item.id ||
    item.reviewId ||
    item.review_id ||
    // Fallback: hash author + date + first 40 chars of text
    `${platform}_${(item.userName || item.author || 'anon')}_${(item.date || item.at || '')}_${(item.text || '').slice(0, 40)}`
      .replace(/\s+/g, '_')
      .toLowerCase();

  return {
    review_id:   String(reviewId).slice(0, 255),
    platform,
    rating:      parseInt(item.score || item.rating || item.stars || 0, 10),
    review_date: item.date || item.at || item.reviewCreatedVersion || null,
    text:        (item.text || item.content || item.body || '').trim(),
    title:       (item.title || item.reviewTitle || '').trim() || null,
    author:      (item.userName || item.author || item.name || 'Anonymous').trim(),
    app_version: item.appVersion || item.reviewCreatedVersion || null,
    language:    item.language || 'en',
  };
}

/**
 * Runs the Apify actor for a single app target and returns
 * normalized review objects.
 *
 * @param {Object} target   Entry from config/apps.json
 * @returns {Promise<Object[]>} Array of normalized reviews
 */
async function scrapeTarget(target) {
  console.log(`\n[Apify] Scraping ${target.label}...`);
  console.log(`[Apify] Actor: ${appsConfig.apifyActor}`);
  console.log(`[Apify] Max reviews: ${target.maxReviews}`);

  const input = {
    appUrls: [target.url],
    maxReviews: target.maxReviews,
    // Some actors accept these optional params
    language: 'en',
    sortBy: 'mostRecent',
  };

  let run;
  try {
    run = await client.actor(appsConfig.apifyActor).call(input, {
      memory: appsConfig.runOptions.memoryMbytes,
      timeout: appsConfig.runOptions.timeoutSecs,
    });
  } catch (err) {
    console.error(`[Apify] ❌ Actor run failed for ${target.label}:`, err.message);
    throw err;
  }

  console.log(`[Apify] ✅ Run complete. Dataset ID: ${run.defaultDatasetId}`);

  // Fetch all items from the run's dataset
  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: target.maxReviews });

  console.log(`[Apify] Fetched ${items.length} raw items from ${target.label}`);

  // Normalize and filter out empty reviews
  const normalized = items
    .map((item) => normalizeReview(item, target.platform))
    .filter((r) => r.text && r.text.length >= 10);

  console.log(`[Apify] ${normalized.length} usable reviews after normalization`);
  return normalized;
}

/**
 * Main export: scrapes all configured app targets.
 *
 * @param {Object} [options]
 * @param {string} [options.source]  'appstore' | 'playstore' | 'both' (default)
 * @returns {Promise<Object[]>} Combined array of normalized reviews from all targets
 */
async function scrapeAllTargets(options = {}) {
  const { source = 'both' } = options;

  if (!process.env.APIFY_API_TOKEN) {
    throw new Error(
      'APIFY_API_TOKEN is not set. Copy .env.example → .env and add your token.'
    );
  }

  const targets = appsConfig.targets.filter((t) => {
    if (source === 'both') return true;
    return t.platform === source;
  });

  if (targets.length === 0) {
    throw new Error(`No targets found for source="${source}". Check config/apps.json.`);
  }

  console.log(`\n[Apify] Starting scrape for ${targets.length} target(s)...`);

  const allReviews = [];

  for (const target of targets) {
    try {
      const reviews = await scrapeTarget(target);
      allReviews.push(...reviews);
    } catch (err) {
      // Log but continue to the next target
      console.error(`[Apify] ⚠️  Skipping ${target.label} due to error: ${err.message}`);
    }
  }

  console.log(`\n[Apify] ✅ Total reviews scraped across all targets: ${allReviews.length}`);
  return allReviews;
}

module.exports = { scrapeAllTargets, scrapeTarget, normalizeReview };
