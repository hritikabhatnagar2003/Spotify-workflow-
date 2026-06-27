'use strict';
/**
 * weekly_digest.js
 * ─────────────────────────────────────────────────────────────
 * Iterates through all predefined PM themes, retrieves relevant
 * context, generates insights via the LLM, and compiles them
 * into a single Weekly Digest JSON file.
 * ─────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const THEMES = require('./themes');
const { retrieve } = require('./retriever');
const { synthesize } = require('./synthesizer');

const OUTPUT_DIR = path.resolve(__dirname, '../../data/outputs');

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Runs the RAG pipeline for all themes and generates a digest.
 * 
 * @returns {Promise<string>} Path to the generated digest file
 */
async function generateDigest() {
  console.log('\n[Digest] Starting Weekly Insight Digest Generation...');
  ensureOutputDir();
  
  const digest = {
    generated_at: new Date().toISOString(),
    insights: []
  };
  
  for (const theme of THEMES) {
    try {
      console.log(`\n[Digest] Processing Theme: ${theme.title}`);
      
      const chunks = await retrieve(theme.query, 15);
      
      if (chunks.length === 0) {
        console.warn(`[Digest] ⚠️ No context found for theme: ${theme.title}`);
        continue;
      }
      
      const insight = await synthesize(theme, chunks);
      digest.insights.push(insight);
      
      console.log(`[Digest] ✅ Generated insight for ${theme.title}`);
    } catch (err) {
      console.error(`[Digest] ❌ Failed to generate insight for ${theme.title}:`, err.message);
    }
  }
  
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `digest_${dateStr}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(digest, null, 2), 'utf-8');
  console.log(`\n[Digest] 💾 Weekly digest saved to: ${filepath}`);
  
  return filepath;
}

module.exports = {
  generateDigest
};
