'use strict';
/**
 * embedder.js
 * ─────────────────────────────────────────────────────────────
 * Uses Transformers.js to generate embeddings completely locally 
 * within the Node.js process. No external server (like Ollama) is needed.
 * Upserts the resulting vectors into the local VectorStore.
 * ─────────────────────────────────────────────────────────────
 */

const { pipeline } = require('@xenova/transformers');
const vectorStore = require('./vector_store');

// We use a small, fast, highly effective embedding model
const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';

let extractorPromise = null;

function getExtractor() {
  if (!extractorPromise) {
    console.log(`[Embedder] Loading local embedding model: ${EMBED_MODEL}...`);
    extractorPromise = pipeline('feature-extraction', EMBED_MODEL);
  }
  return extractorPromise;
}

/**
 * Fetches embeddings using local Transformers.js for an array of strings.
 * 
 * @param {string[]} texts 
 * @returns {Promise<number[][]>} Array of vectors
 */
async function fetchEmbeddings(texts) {
  const extractor = await getExtractor();
  const vectors = [];
  
  for (let i = 0; i < texts.length; i++) {
    try {
      const output = await extractor(texts[i], { pooling: 'mean', normalize: true });
      vectors.push(Array.from(output.data));
    } catch (err) {
      console.error(`[Embedder] Failed to embed chunk ${i}:`, err.message);
      throw err;
    }
  }
  
  return vectors;
}

/**
 * Embeds a list of chunk objects and saves them to the vector store.
 * 
 * @param {Object[]} chunks 
 */
async function embedAndStore(chunks) {
  if (!chunks || chunks.length === 0) return;
  
  const texts = chunks.map(c => c.text);
  
  console.log(`[Embedder] Generating embeddings for ${texts.length} chunks via Transformers.js (${EMBED_MODEL})...`);
  const vectors = await fetchEmbeddings(texts);
  
  console.log(`[Embedder] Upserting ${vectors.length} vectors into local vector store...`);
  vectorStore.upsert(chunks, vectors);
}

module.exports = {
  fetchEmbeddings,
  embedAndStore,
};
