'use strict';
/**
 * scripts/ingest_csv.js
 * ─────────────────────────────────────────────────────────────
 * Parses a downloaded CSV file of Spotify reviews and ingests 
 * them into the local SQLite database.
 * ─────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { storeReviews } = require('../src/ingestion/store_raw');

const CSV_PATH = path.resolve(__dirname, '../data/hf_dataset/Reviews_Spotify_Discovery_Filtered.csv');

async function main() {
  console.log(`[CSV Ingestion] Reading dataset from ${CSV_PATH}...`);
  
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`[CSV Ingestion] Error: CSV file not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const reviews = [];

  fs.createReadStream(CSV_PATH)
    .pipe(csv())
    .on('data', (data) => {
      // Map CSV columns to SQLite schema
      // CSV: Review_ID,User_Name,Platform,Rating,Thumbs_Up_Count,Review_Text,Date
      reviews.push({
        review_id: data.Review_ID || `hf_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        platform: data.Platform || 'Hugging Face Dataset',
        rating: parseFloat(data.Rating) || null,
        review_date: data.Date || new Date().toISOString(),
        text: data.Review_Text || '',
        title: null,
        author: data.User_Name || 'Unknown',
        app_version: null,
        language: 'en'
      });
    })
    .on('end', async () => {
      console.log(`[CSV Ingestion] Parsed ${reviews.length} reviews from CSV.`);
      console.log(`[CSV Ingestion] Storing into database...`);
      
      try {
        await storeReviews(reviews);
        console.log(`[CSV Ingestion] ✅ Successfully ingested CSV dataset.`);
      } catch (err) {
        console.error(`[CSV Ingestion] ❌ Failed to store reviews: ${err.message}`);
      }
    });
}

main();
