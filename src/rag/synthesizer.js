'use strict';
/**
 * synthesizer.js
 * ─────────────────────────────────────────────────────────────
 * Prompts the Groq API (LLM) with retrieved context to generate
 * structured PM-grade insights in JSON format.
 * ─────────────────────────────────────────────────────────────
 */

const Groq = require('groq-sdk');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_LLM_MODEL || 'llama3-8b-8192';

const groq = new Groq({
  apiKey: GROQ_API_KEY
});

/**
 * Synthesizes an insight based on a theme and retrieved context.
 * 
 * @param {Object} theme 
 * @param {Object[]} chunks 
 * @returns {Promise<Object>}
 */
async function synthesize(theme, chunks) {
  if (!GROQ_API_KEY || GROQ_API_KEY === 'gsk_PLACEHOLDER_TOKEN') {
    throw new Error('GROQ_API_KEY is not set or is invalid in .env');
  }

  const contextText = chunks.map(c => `[Rating: ${c.rating}/5 | Platform: ${c.platform}]\n${c.text}`).join('\n\n');

  const systemPrompt = `You are a Senior Product Manager at Spotify analyzing real user reviews.
Your job is to extract actionable product insights based on the provided context, not just generic summaries.
Rely strictly on the user context provided. If there is insufficient evidence, mention it.

Respond strictly with a raw JSON object using this exact structure (no markdown formatting or code blocks around it):
{
  "theme": "${theme.title}",
  "key_finding": "...",
  "evidence_quotes": ["quote1", "quote2", "quote3"],
  "user_impact": "HIGH | MEDIUM | LOW",
  "affected_segments": ["Segment 1", "Segment 2"],
  "pm_recommendation": "..."
}`;

  const userPrompt = `CONTEXT (Top Relevant Reviews):
${contextText}

TASK:
Analyze the reviews above and answer this product question:
"${theme.query}"

Return only the raw JSON.`;

  console.log(`[Synthesizer] Generating insight for theme: ${theme.title} using ${GROQ_MODEL}...`);

  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    model: GROQ_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' }
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from Groq API');
  }

  try {
    return JSON.parse(content);
  } catch (err) {
    console.error(`[Synthesizer] Failed to parse JSON response for ${theme.title}:`, content);
    throw new Error('Invalid JSON received from Groq API');
  }
}

module.exports = {
  synthesize
};
