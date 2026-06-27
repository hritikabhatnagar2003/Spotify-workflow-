'use strict';
/**
 * run_ingestion.js
 * ─────────────────────────────────────────────────────────────
 * Manual trigger for the ingestion layer only (Layer 1).
 * Scrapes Play Store + App Store directly (no API key needed)
 * → normalizes reviews → saves raw JSON to data/scraped/
 * → stores normalized reviews in SQLite.
 *
 * Usage:
 *   node scripts/run_ingestion.js
 *   node scripts/run_ingestion.js --source=appstore
 *   node scripts/run_ingestion.js --source=playstore
 *   node scripts/run_ingestion.js --source=both        (default)
 *
 * Flags:
 *   --source=<appstore|playstore|both>   Which platform to scrape
 *   --dry-run                            Scrape but don't write to DB
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const { scrapeAllTargets }        = require('../src/ingestion/scraper');
const { storeReviews, getStats }  = require('../src/ingestion/store_raw');

// ── Parse CLI args ─────────────────────────────────────────────
const args   = process.argv.slice(2);
const source = (args.find((a) => a.startsWith('--source=')) || '--source=both')
  .replace('--source=', '');
const dryRun = args.includes('--dry-run');

// ── Main ───────────────────────────────────────────────────────
async function runIngestion() {
  const startTime = Date.now();

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Spotify Review Engine — Ingestion    ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\nSource:  ${source}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // ── 1. Scrape via google-play-scraper / app-store-scraper ────
  let reviews;
  try {
    reviews = await scrapeAllTargets({ source });
  } catch (err) {
    console.error(`\n❌ Ingestion failed during scraping: ${err.message}`);
    process.exit(1);
  }

  if (reviews.length === 0) {
    console.warn('\n⚠️  No reviews returned. Check your network or app IDs in .env.');
    process.exit(0);
  }

  // ── 2. Store in SQLite ───────────────────────────────────────
  let result = { inserted: 0, skipped: 0, total: 0 };

  if (dryRun) {
    console.log('\n[DRY RUN] Skipping database write.');
    console.log(`[DRY RUN] Would have inserted up to ${reviews.length} reviews.`);
    console.log('\n[DRY RUN] Sample (first 3 reviews):');
    reviews.slice(0, 3).forEach((r, i) => {
      console.log(`\n  Review ${i + 1}:`);
      console.log(`    ID:       ${r.review_id}`);
      console.log(`    Platform: ${r.platform}`);
      console.log(`    Rating:   ${r.rating} ⭐`);
      console.log(`    Date:     ${r.review_date}`);
      console.log(`    Author:   ${r.author}`);
      console.log(`    Text:     ${r.text.slice(0, 120)}...`);
    });
  } else {
    try {
      result = await storeReviews(reviews);
    } catch (err) {
      console.error(`\n❌ Ingestion failed during DB write: ${err.message}`);
      process.exit(1);
    }
  }

  // ── 3. Summary ───────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n══════════════════════════════════════════');
  console.log('              INGESTION SUMMARY           ');
  console.log('══════════════════════════════════════════');
  console.log(`  Scraped (Play+App):    ${reviews.length}`);

  if (!dryRun) {
    console.log(`  New reviews inserted:  ${result.inserted}`);
    console.log(`  Duplicates skipped:    ${result.skipped}`);
    console.log(`  Total in database:     ${result.total}`);

    try {
      const stats = await getStats();
      console.log('\n  Platform breakdown:');
      stats.byPlatform.forEach((p) => {
        console.log(`    ${p.platform.padEnd(12)} ${p.count} reviews`);
      });
      console.log(`\n  Pending vectorization: ${stats.pending}`);
    } catch (_) { /* stats are informational only */ }
  }

  console.log(`\n  Duration: ${elapsed}s`);
  console.log(`  Finished: ${new Date().toISOString()}`);
  console.log('\n✅ Ingestion complete.');

  if (!dryRun && result.inserted > 0) {
    console.log('\nNext step: Run processing layer to embed new reviews:');
    console.log('  node scripts/run_pipeline.js\n');
  }
}

runIngestion().catch((err) => {
  console.error(`\n❌ Unhandled error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
