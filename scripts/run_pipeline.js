'use strict';
/**
 * run_pipeline.js
 * ─────────────────────────────────────────────────────────────
 * Executes the full Processing and RAG Insight Generation pipeline.
 *   1. Fetch pending reviews from SQLite
 *   2. Clean and filter reviews
 *   3. Chunk into overlapping token windows
 *   4. Embed chunks via Ollama and store in vector store
 *   5. Generate PM insights using Groq API
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const { getPendingReviews, markVectorized } = require('../src/ingestion/store_raw');
const { cleanReviews } = require('../src/processing/cleaner');
const { chunkReviews } = require('../src/processing/chunker');
const { embedAndStore } = require('../src/processing/embedder');
const { generateDigest } = require('../src/rag/weekly_digest');

async function runPipeline() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Spotify Review Engine — Pipeline     ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const startTime = Date.now();
  
  // 1. Fetch
  console.log('[Pipeline] Fetching pending reviews from SQLite...');
  const pending = await getPendingReviews(2000); // Process up to 2000 at a time
  
  if (pending.length === 0) {
    console.log('[Pipeline] No pending reviews to process.');
    // We can still run the digest generation over existing vector store
    // data if the user wants, but typically we only run if new data exists.
    // For now, let's proceed to digest generation anyway using existing vectors.
    console.log('[Pipeline] Proceeding to generate digest from existing vector store data...');
  } else {
    console.log(`[Pipeline] Found ${pending.length} pending reviews.`);
    
    // 2. Clean
    const cleaned = cleanReviews(pending);
    console.log(`[Pipeline] Cleaned reviews: ${cleaned.length} remaining (filtered short/noisy)`);
    
    // 3. Chunk
    const chunks = chunkReviews(cleaned);
    console.log(`[Pipeline] Created ${chunks.length} chunks from reviews`);
    
    // 4. Embed
    if (chunks.length > 0) {
      await embedAndStore(chunks);
      
      // Mark as vectorized in DB
      const reviewIds = cleaned.map(r => r.review_id);
      await markVectorized(reviewIds);
    }
  }
  
  // 5. Generate Digest
  await generateDigest();
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n══════════════════════════════════════════');
  console.log(`✅ Pipeline Complete in ${elapsed}s`);
  console.log('══════════════════════════════════════════\n');
}

runPipeline().catch(err => {
  console.error(`\n❌ Pipeline Error: ${err.message}`);
  process.exit(1);
});
