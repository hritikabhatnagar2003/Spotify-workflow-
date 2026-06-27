'use strict';
/**
 * bootstrap.js
 * ─────────────────────────────────────────────────────────────
 * One-time setup script. Run this before the first pipeline run.
 *
 * What it does:
 *   1. Validates all required environment variables are present
 *   2. Creates the SQLite database and applies the schema
 *   3. Checks that Ollama is reachable on localhost
 *   4. Confirms required Ollama models are available
 *   5. Creates the data/ output directories
 *
 * Usage:
 *   node scripts/bootstrap.js
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const http = require('http');

// ── ANSI colors for terminal output ───────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

const ok   = (msg) => console.log(`  ${GREEN}✅ ${msg}${RESET}`);
const fail = (msg) => console.log(`  ${RED}❌ ${msg}${RESET}`);
const warn = (msg) => console.log(`  ${YELLOW}⚠️  ${msg}${RESET}`);
const info = (msg) => console.log(`  ℹ️  ${msg}`);

// ── Step 1: Validate env vars ──────────────────────────────────
function checkEnvVars() {
  console.log(`\n${BOLD}[1/4] Checking environment variables...${RESET}`);

  const required = ['APIFY_API_TOKEN'];
  const optional = [
    'SPOTIFY_APPSTORE_ID',
    'SPOTIFY_PLAYSTORE_ID',
    'OLLAMA_HOST',
    'OLLAMA_LLM_MODEL',
    'OLLAMA_EMBED_MODEL',
    'PORT',
  ];

  let allGood = true;

  for (const key of required) {
    if (process.env[key] && process.env[key] !== `${key}_PLACEHOLDER`) {
      ok(`${key} is set`);
    } else {
      fail(`${key} is missing! Add it to your .env file.`);
      allGood = false;
    }
  }

  for (const key of optional) {
    if (process.env[key]) {
      ok(`${key} = ${process.env[key]}`);
    } else {
      warn(`${key} not set — will use default`);
    }
  }

  if (!allGood) {
    console.log(`\n${RED}Bootstrap failed: missing required env vars.${RESET}`);
    console.log(`Copy .env.example → .env and fill in your APIFY_API_TOKEN.\n`);
    process.exit(1);
  }
}

// ── Step 2: Initialize SQLite database ────────────────────────
async function initDatabase() {
  console.log(`\n${BOLD}[2/4] Initializing SQLite database...${RESET}`);

  try {
    const { openDatabase } = require('../src/ingestion/store_raw');
    const { db } = await openDatabase();
    const res = db.exec('SELECT COUNT(*) AS n FROM raw_reviews');
    const count = res[0]?.values[0][0] ?? 0;
    db.close();
    ok(`Database ready at data/raw/reviews.db`);
    info(`Current review count: ${count}`);
  } catch (err) {
    fail(`Database initialization failed: ${err.message}`);
    process.exit(1);
  }
}

// ── Step 3: Check Ollama connectivity ─────────────────────────
async function checkOllama() {
  console.log(`\n${BOLD}[3/4] Checking Ollama connectivity...${RESET}`);

  const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const url = `${ollamaHost}/api/tags`;

  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const models = (data.models || []).map((m) => m.name);
          ok(`Ollama is running at ${ollamaHost}`);

          const llmModel   = process.env.OLLAMA_LLM_MODEL   || 'llama3';
          const embedModel = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

          if (models.some((m) => m.startsWith(llmModel))) {
            ok(`LLM model "${llmModel}" is available`);
          } else {
            warn(`LLM model "${llmModel}" not found. Run: ollama pull ${llmModel}`);
          }

          if (models.some((m) => m.startsWith(embedModel))) {
            ok(`Embedding model "${embedModel}" is available`);
          } else {
            warn(`Embedding model "${embedModel}" not found. Run: ollama pull ${embedModel}`);
          }

          if (models.length > 0) {
            info(`Available Ollama models: ${models.join(', ')}`);
          }

          resolve();
        } catch (e) {
          warn(`Ollama responded but JSON parse failed. It may still work.`);
          resolve();
        }
      });
    });

    req.on('error', () => {
      warn(`Ollama not reachable at ${ollamaHost}.`);
      warn(`Install Ollama: https://ollama.ai`);
      warn(`Then run: ollama pull llama3 && ollama pull nomic-embed-text`);
      warn(`(Ingestion layer works without Ollama — needed for Step 2 onward)`);
      resolve(); // Don't block bootstrap — Ollama is only needed for embedding/RAG
    });

    req.setTimeout(3000, () => {
      req.destroy();
      warn(`Ollama connection timed out. Continuing anyway.`);
      resolve();
    });
  });
}

// ── Step 4: Create output directories ─────────────────────────
function createDirectories() {
  console.log(`\n${BOLD}[4/4] Creating output directories...${RESET}`);

  const dirs = [
    path.resolve(__dirname, '../data/raw'),
    path.resolve(__dirname, '../data/outputs'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      ok(`Created: ${path.relative(process.cwd(), dir)}`);
    } else {
      ok(`Already exists: ${path.relative(process.cwd(), dir)}`);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────
async function bootstrap() {
  console.log(`\n${BOLD}╔════════════════════════════════════════╗`);
  console.log(`║   Spotify Review Engine — Bootstrap    ║`);
  console.log(`╚════════════════════════════════════════╝${RESET}`);

  createDirectories();
  checkEnvVars();
  await initDatabase();
  await checkOllama();

  console.log(`\n${GREEN}${BOLD}🎉 Bootstrap complete! Ready to run the pipeline.${RESET}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Run first ingestion:  npm run ingest`);
  console.log(`  2. Start the API server: npm start`);
  console.log(`  3. Open the dashboard:   cd src/dashboard && npm run dev\n`);
}

bootstrap().catch((err) => {
  console.error(`\n${RED}Bootstrap crashed: ${err.message}${RESET}`);
  process.exit(1);
});
