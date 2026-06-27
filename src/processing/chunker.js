'use strict';
/**
 * chunker.js
 * ─────────────────────────────────────────────────────────────
 * Splits cleaned reviews into sliding-window text chunks.
 * Uses a basic character/word approximation since gpt-3-encoder
 * can be heavy, but we'll use gpt-3-encoder for accuracy if available.
 * ─────────────────────────────────────────────────────────────
 */

const { encode, decode } = require('gpt-3-encoder');

// Default chunk size and overlap in tokens
const MAX_TOKENS = 300;
const OVERLAP    = 50;

/**
 * Chunks a single string into overlapping token windows.
 * 
 * @param {string} text 
 * @param {number} maxTokens 
 * @param {number} overlap 
 * @returns {string[]} Array of string chunks
 */
function chunkText(text, maxTokens = MAX_TOKENS, overlap = OVERLAP) {
  const tokens = encode(text);
  
  if (tokens.length <= maxTokens) {
    return [text];
  }
  
  const chunks = [];
  let i = 0;
  
  while (i < tokens.length) {
    const chunkTokens = tokens.slice(i, i + maxTokens);
    chunks.push(decode(chunkTokens));
    i += (maxTokens - overlap);
  }
  
  return chunks;
}

/**
 * Processes an array of cleaned reviews into chunks with metadata.
 * 
 * @param {Object[]} cleanedReviews 
 * @returns {Object[]} Array of chunk objects ready for embedding
 */
function chunkReviews(cleanedReviews) {
  const allChunks = [];
  
  for (const review of cleanedReviews) {
    const textChunks = chunkText(review.text);
    
    textChunks.forEach((chunkText, index) => {
      allChunks.push({
        id: `${review.review_id}_chunk${index}`,
        review_id: review.review_id,
        text: chunkText,
        rating: review.rating,
        platform: review.platform,
        review_date: review.review_date,
      });
    });
  }
  
  return allChunks;
}

module.exports = {
  chunkText,
  chunkReviews,
};
