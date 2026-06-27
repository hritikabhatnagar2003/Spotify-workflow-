'use strict';
/**
 * retriever.js
 * ─────────────────────────────────────────────────────────────
 * Embeds a given query using Ollama and retrieves the top-K
 * most semantically similar review chunks from the vector store.
 * ─────────────────────────────────────────────────────────────
 */

const { fetchEmbeddings } = require('../processing/embedder');
const vectorStore = require('../processing/vector_store');

/**
 * Retrieves the most relevant chunks for a given query.
 * 
 * @param {string} query 
 * @param {number} topK 
 * @returns {Promise<Object[]>}
 */
async function retrieve(query, topK = 15) {
  console.log(`[Retriever] Embedding query: "${query.substring(0, 50)}..."`);
  
  const queryVectors = await fetchEmbeddings([query]);
  const queryVector = queryVectors[0];
  
  if (!queryVector) {
    throw new Error('Failed to generate embedding for query');
  }
  
  const results = vectorStore.query(queryVector, topK);
  console.log(`[Retriever] Found ${results.length} relevant chunks`);
  
  return results;
}

module.exports = {
  retrieve
};
