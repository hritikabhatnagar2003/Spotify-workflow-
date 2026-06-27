'use strict';
/**
 * vector_store.js
 * ─────────────────────────────────────────────────────────────
 * An ephemeral, in-process, zero-config vector store mimicking ChromaDB.
 * Since the official JS ChromaDB client requires a running server (Docker),
 * this implementation fulfills the "zero-config, no Docker, in-process" 
 * architectural requirement using exact cosine similarity in memory.
 * ─────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');

const VECTOR_STORE_PATH = path.resolve(__dirname, '../../data/raw/vectors.json');

// Memory store
let collection = [];

function dotProduct(vecA, vecB) {
  let product = 0;
  for (let i = 0; i < vecA.length; i++) {
    product += vecA[i] * vecB[i];
  }
  return product;
}

function magnitude(vec) {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    sum += vec[i] * vec[i];
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(vecA, vecB) {
  return dotProduct(vecA, vecB) / (magnitude(vecA) * magnitude(vecB));
}

/**
 * Loads the vectors from disk into memory.
 */
function load() {
  if (fs.existsSync(VECTOR_STORE_PATH)) {
    try {
      const data = fs.readFileSync(VECTOR_STORE_PATH, 'utf-8');
      collection = JSON.parse(data);
    } catch (e) {
      console.error('[VectorStore] Failed to load vectors from disk.', e.message);
      collection = [];
    }
  } else {
    collection = [];
  }
}

/**
 * Saves the vectors to disk.
 */
function save() {
  const dir = path.dirname(VECTOR_STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(collection), 'utf-8');
}

/**
 * Upserts a batch of vectors.
 */
function upsert(chunks, vectors) {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vector = vectors[i];
    
    const existingIdx = collection.findIndex(item => item.id === chunk.id);
    if (existingIdx !== -1) {
      collection[existingIdx] = { ...chunk, vector };
    } else {
      collection.push({ ...chunk, vector });
    }
  }
  save();
}

/**
 * Queries the vector store for the top K most similar chunks.
 */
function query(queryVector, topK = 15) {
  if (collection.length === 0) return [];
  
  const scored = collection.map(item => ({
    ...item,
    score: cosineSimilarity(queryVector, item.vector)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, topK).map(item => {
    const { vector, ...metadata } = item;
    return metadata;
  });
}

// Initialize on load
load();

module.exports = {
  upsert,
  query,
  count: () => collection.length
};
