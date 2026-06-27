'use strict';
/**
 * cleaner.js
 * ─────────────────────────────────────────────────────────────
 * Cleans raw reviews from SQLite before they are chunked.
 * Removes HTML, excessive whitespace, emojis, non-English text,
 * and filters out reviews irrelevant to the discovery problem statement.
 * ─────────────────────────────────────────────────────────────
 */

const LanguageDetect = require('languagedetect');
const lngDetector = new LanguageDetect();

// Keywords related to the Spotify Review Discovery problem statement
const RELEVANT_KEYWORDS = [
  'discover', 'recommend', 'playlist', 'algorithm', 'dj', 
  'new music', 'shuffle', 'skip', 'repeat', 'loop', 
  'vibe', 'mood', 'explore', 'podcast', 'audiobook',
  'find', 'search', 'queue', 'similar', 'different'
];

// Regex to detect emojis
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/u;

function cleanText(text) {
  if (!text) return '';
  
  // Remove HTML tags
  let cleaned = text.replace(/<[^>]+>/g, ' ');
  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Filters and cleans an array of raw review objects.
 * 
 * @param {Object[]} rawReviews 
 * @returns {Object[]} Cleaned reviews
 */
function cleanReviews(rawReviews) {
  const cleaned = [];
  
  for (const review of rawReviews) {
    const text = cleanText(review.text);
    
    // Filter 1: Very short reviews (likely noise)
    if (text.length < 20) continue;
    
    // Filter 2: Contains Emojis
    if (EMOJI_REGEX.test(text)) continue;
    
    // Filter 3: Non-English text
    // languagedetect returns an array of [language, score] pairs
    const detectedLangs = lngDetector.detect(text, 1);
    const isEnglish = detectedLangs.length > 0 && detectedLangs[0][0] === 'english';
    if (!isEnglish) continue;
    
    // Filter 4: Relevance to Problem Statement
    const lowerText = text.toLowerCase();
    const isRelevant = RELEVANT_KEYWORDS.some(keyword => lowerText.includes(keyword));
    if (!isRelevant) continue;

    cleaned.push({
      ...review,
      text,
    });
  }
  
  return cleaned;
}

module.exports = {
  cleanText,
  cleanReviews,
};
