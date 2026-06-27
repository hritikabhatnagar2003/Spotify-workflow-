'use strict';
/**
 * themes.js
 * ─────────────────────────────────────────────────────────────
 * Defines the 5 PM insight queries used for the weekly digest.
 * ─────────────────────────────────────────────────────────────
 */

const THEMES = [
  {
    id: 'vibe_protection',
    title: 'Vibe Protection',
    query: 'Why do users avoid new music during focus, work, or commute sessions? Do they treat music as a utility?'
  },
  {
    id: 'echo_chamber',
    title: 'Echo Chamber Effect',
    query: 'How does the recommendation algorithm create repetitive listening loops? Are users complaining about hearing the same songs?'
  },
  {
    id: 'discovery_anxiety',
    title: 'Discovery Anxiety',
    query: 'What emotional barriers prevent users from exploring Discover Weekly? Do they perceive it as high-risk?'
  },
  {
    id: 'novelty_control',
    title: 'Novelty Control',
    query: 'What micro-controls do users wish they had over the degree of newness? Do they want a slider from familiar to adventurous?'
  },
  {
    id: 'skip_behavior',
    title: 'Skip Behavior',
    query: 'What specific triggers cause users to skip algorithmically recommended tracks?'
  }
];

module.exports = THEMES;
