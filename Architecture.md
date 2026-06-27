# Spotify AI-Powered Review Discovery Engine
## Architecture & Implementation Plan

> **Strategic Goal:** Move Spotify users from passive, repetitive listening into active, meaningful discovery — by mining qualitative app-store feedback at scale and synthesizing PM-grade insights using a RAG pipeline.

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   NIGHTLY ORCHESTRATION (node-cron)                     │
│   Cron Job (01:00) → Ingest → Process → Embed → Digest → Console Alert  │
└─────────────────────────────────────────────────────────────────────────┘
          │                          │                          │
          ▼                          ▼                          ▼
┌──────────────────┐    ┌──────────────────────┐   ┌───────────────────────┐
│  LAYER 1         │    │  LAYER 2             │   │  LAYER 3              │
│  Data Ingestion  │───▶│  Processing &        │──▶│  RAG Insight          │
│                  │    │  Vectorization       │   │  Generation           │
│  • google-play-  │    │  • Dedupe + Clean    │   │  • ChromaDB Retrieval │
│    scraper       │    │  • Chunking          │   │  • Groq API (LLM)     │
│  • app-store-    │    │  • Ollama Embeddings │   │  • Theme Extraction   │
│    scraper       │    │  • ChromaDB (in-mem) │   │  • Weekly Digest JSON │
│  • Raw JSON →    │    │                      │   │                       │
│    data/scraped/ │    │                      │   │                       │
│  • Deduped →     │    │                      │   │                       │
│    SQLite DB     │    │                      │   │                       │
└──────────────────┘    └──────────────────────┘   └───────────────────────┘
                                                               │
                                                               ▼
                                               ┌───────────────────────────┐
                                               │  LAYER 4                  │
                                               │  PM Dashboard (React)     │
                                               │  • Insight Theme Cards    │
                                               │  • Sentiment Trend Charts │
                                               │  • "Ask the Reviews" Chat │
                                               │  • Weekly Digest Export   │
                                               └───────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Ingestion** | `google-play-scraper` + `app-store-scraper` (free npm packages) | Scrapes Play Store + App Store reviews directly — no API key |
| **Raw Dump** | JSON files in `data/scraped/` | Timestamped raw dumps per run, separate from SQLite |
| **Raw Storage** | SQLite (`sql.js`) | Deduplication by `review_id`, tracks vectorization state |
| **Cleaning** | Custom Node.js (`cleaner.js`) | Strip bots, HTML, filter non-English, normalize text |
| **Chunking** | Sliding-window (`chunker.js`) | 300-token chunks, 50-token overlap for better retrieval |
| **Embeddings** | Ollama `nomic-embed-text` (local) | 768-dim vectors, purpose-built for semantic search — zero cost |
| **Vector Store** | ChromaDB ephemeral in-process | No Docker required; zero-config, reloaded from SQLite each run |
| **RAG Engine** | Groq API (cloud, fast inference) | Uses `llama3-8b-8192` or `mixtral-8x7b` — free tier available |
| **API Server** | Express.js | Exposes pipeline triggers + RAG endpoints to the dashboard |
| **Orchestration** | `node-cron` (built-in scheduler) | Nightly cron at 01:00 inside the Node.js process, no external tools |
| **Dashboard** | React + Vite | Spotify dark-mode PM dashboard |

---

## 3. Project Folder Structure

```
spotify-review-engine/
├── .env.example                    # All required API key placeholders
├── .gitignore
├── package.json                    # Root dependencies
├── README.md
├── Architecture.md                 # ← This file
│
├── config/
│   └── apps.json                   # Spotify App Store + Play Store URLs
│
├── src/
│   ├── ingestion/
│   │   ├── scraper.js              # google-play-scraper + app-store-scraper; dumps raw JSON
│   │   ├── store_raw.js            # INSERT OR IGNORE into SQLite
│   │   └── schema.sql              # raw_reviews table definition
│   │
│   ├── processing/
│   │   ├── cleaner.js              # Sanitize, filter, normalize reviews
│   │   ├── chunker.js              # Sliding-window text chunking
│   │   └── embedder.js             # Ollama nomic-embed-text embeddings → ChromaDB upsert
│   │
│   ├── rag/
│   │   ├── retriever.js            # ChromaDB similarity search (top-k=15)
│   │   ├── synthesizer.js          # Prompt builder + Ollama local LLM call
│   │   ├── themes.js               # 5 pre-defined PM insight queries
│   │   └── weekly_digest.js        # Runs all themes → digest JSON report
│   │
│   ├── api/
│   │   ├── server.js               # Express.js server (port 3001)
│   │   └── routes/
│   │       ├── insights.js         # GET /api/insights — theme-based RAG
│   │       ├── ask.js              # POST /api/ask — freeform PM questions
│   │       ├── stats.js            # GET /api/stats — volume & sentiment
│   │       └── pipeline.js         # POST /api/pipeline/* — manual triggers
│   │
│   └── dashboard/                  # React + Vite frontend (port 5173)
│       ├── index.html
│       ├── vite.config.js
│       └── src/
│           ├── App.jsx
│           ├── index.css           # Spotify dark-mode design system
│           └── components/
│               ├── InsightCard.jsx
│               ├── SentimentChart.jsx
│               ├── AskTheReviews.jsx
│               └── WeeklyDigest.jsx
│
├── data/
│   ├── raw/                        # reviews.db (SQLite)
│   └── scraped/                    # Raw JSON dumps per run
│                                   #   playstore_<timestamp>.json
│                                   #   appstore_<timestamp>.json
│                                   # ChromaDB: in-process ephemeral (no folder)
│
└── scripts/
    ├── bootstrap.js                # One-time SQLite schema init + Ollama model check
    └── run_pipeline.js             # Manual full pipeline trigger
```

---

## 4. Data Flow — Step by Step

### Step 1: Ingestion (Nightly via node-cron)
```
node-cron scheduler fires at 01:00 (inside src/api/server.js)
  → scraper.js:
      → google-play-scraper fetches up to 500 Play Store reviews
      → app-store-scraper fetches up to 500 App Store reviews
      → Raw JSON dumped to data/scraped/<platform>_<timestamp>.json
  → store_raw.js: INSERT OR IGNORE into SQLite (deduplication by review_id)
  → Returns: { new: N, skipped: M }
```

### Step 2: Processing & Vectorization
```
node-cron → embedder.js (auto-triggered after ingestion)
  → cleaner.js: filters bots (<20 chars), strips HTML, detects English
  → chunker.js: splits each review into 300-token chunks (50 overlap)
  → embedder.js:
      → Batch chunks → Ollama REST API: POST /api/embeddings (model: nomic-embed-text)
      → Upsert vectors + metadata into ChromaDB ephemeral in-process client
      → ChromaDB collection "spotify_reviews" lives in-memory for the session
      → Mark vectorized=1 in SQLite (persists across runs)
```

### Step 3: RAG Insight Generation
```
node-cron → weekly_digest.js (runs after embedding is complete)
  → retriever.js: embed query → ChromaDB in-process cosine search → top 15 chunks
  → synthesizer.js: build prompt → Groq API (https://api.groq.com/openai/v1)
      → Model: llama3-8b-8192 (default) or mixtral-8x7b-32768
      → OpenAI-compatible API — fast cloud inference, free tier available
      → Returns structured JSON insight response
  → Saves digest_YYYY-MM-DD.json to data/outputs/
```

### Step 4: Dashboard Consumption
```
React Dashboard (port 5173) → Express API (port 3001)
  GET /api/insights     → Insight theme cards
  GET /api/stats        → Charts and volume metrics
  POST /api/ask         → "Ask the Reviews" freeform chat
```

---

## 5. SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS raw_reviews (
  review_id    TEXT PRIMARY KEY,
  platform     TEXT,       -- 'appstore' | 'playstore'
  rating       INTEGER,    -- 1 to 5
  review_date  TEXT,
  text         TEXT,
  title        TEXT,
  author       TEXT,
  ingested_at  TEXT DEFAULT (datetime('now')),
  vectorized   INTEGER DEFAULT 0
);
```

---

## 6. RAG Prompt Architecture

Each insight query follows this structured prompt pattern:

```
SYSTEM:
  You are a Senior Product Manager at Spotify analyzing real user reviews.
  Your job is to extract actionable product insights, not summaries.

CONTEXT:
  [Top 15 semantically similar review chunks retrieved from ChromaDB]

TASK:
  [Theme-specific question — e.g., "Why do users avoid new music during focus sessions?"]

OUTPUT FORMAT (JSON):
  {
    "theme": "Vibe Protection",
    "key_finding": "...",
    "evidence_quotes": ["quote1", "quote2", "quote3"],
    "user_impact": "HIGH | MEDIUM | LOW",
    "affected_segments": ["Focus listeners", "Commuters", ...],
    "pm_recommendation": "..."
  }
```

---

## 7. The 5 Pre-Defined PM Insight Themes

| # | Theme | Query |
|---|---|---|
| 1 | **Vibe Protection** | Why do users avoid new music during focus/work/commute sessions? |
| 2 | **Echo Chamber Effect** | How does the recommendation algorithm create repetitive listening loops? |
| 3 | **Discovery Anxiety** | What emotional barriers prevent users from exploring Discover Weekly? |
| 4 | **Novelty Control** | What micro-controls do users wish they had over the degree of newness? |
| 5 | **Skip Behavior** | What specific triggers cause users to skip algorithmically recommended tracks? |

---

## 8. node-cron Scheduler (Built-in Orchestration)

All orchestration lives inside `src/api/server.js` as a `node-cron` job.
No external tools required — the pipeline runs automatically when the server is running.

```javascript
// src/api/server.js (simplified)
cron.schedule('0 1 * * *', async () => {
  console.log('[CRON] Starting nightly pipeline...');
  try {
    const { newCount } = await runIngestion();        // Step 1: direct scrape
    console.log(`[CRON] Ingested ${newCount} new reviews`);

    await runProcessing();                            // Step 2: Clean + embed
    console.log('[CRON] Embeddings upserted to ChromaDB');

    await runDigest();                                // Step 3: Groq RAG digest
    console.log('[CRON] Weekly digest saved to data/outputs/');

    console.log('[CRON] ✅ Pipeline complete');
  } catch (err) {
    console.error('[CRON] ❌ Pipeline failed:', err.message);
  }
});
```

**Pipeline Sequence:**
```
[node-cron fires at 01:00]
        │
        ▼
[scraper.js]          ← Fetch reviews (google-play-scraper + app-store-scraper)
        │             ← Dump raw JSON to data/scraped/
        ▼
[cleaner + chunker + embedder.js]   ← Process + embed into ChromaDB in-process
        │
        ▼
[weekly_digest.js]    ← RAG queries via Groq API (cloud)
        │
        ▼
[Console log: ✅ Done / ❌ Error]
```

---

## 9. Environment Variables

```bash
# Ingestion — NO API KEY NEEDED
# Uses google-play-scraper and app-store-scraper directly

# Target Apps
SPOTIFY_APPSTORE_ID=324684580
SPOTIFY_PLAYSTORE_ID=com.spotify.music
MAX_REVIEWS=500

# Groq API (cloud LLM for RAG generation — fast, free tier available)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_LLM_MODEL=llama3-8b-8192

# Ollama (local — handles embeddings only)
OLLAMA_HOST=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text

# ChromaDB: ephemeral in-process — no host/port needed

# API Server
PORT=3001
```

> **Only 1 API key needed** — `GROQ_API_KEY`. Ingestion is fully free (direct scraping). Embeddings run locally via Ollama. LLM inference uses Groq's fast cloud API.

---

## 10. Step-by-Step Execution Plan

| Step | Action | Command | Est. Time |
|------|--------|---------|-----------|
| 1 | Install Ollama + embedding model | `ollama pull nomic-embed-text` | 2–5 min |
| 2 | Install dependencies | `npm install` | 1 min |
| 3 | Configure environment | Copy `.env.example` → `.env`, add `GROQ_API_KEY` | 1 min |
| 4 | Bootstrap database | `node scripts/bootstrap.js` | 30 sec |
| 5 | Run first pipeline manually | `node scripts/run_ingestion.js --source=both` | 2–5 min |
| 6 | Start API server (with cron) | `node src/api/server.js` | instant |
| 7 | Start dashboard | `cd src/dashboard && npm run dev` | instant |
| 8 | Verify end-to-end | `curl http://localhost:3001/api/stats` | 1 min |
| 9 | Confirm nightly cron | Check console logs at 01:00 | — |

> **No Docker. No n8n. No Apify.** Ingestion scrapes directly via npm packages. Embeddings (`nomic-embed-text`) run locally via Ollama. LLM inference uses Groq API.

---

## 11. Cost Estimates

| Service | Usage | Est. Monthly Cost |
|---|---|---|
| `google-play-scraper` | Direct scraping — no limits | **$0** — free npm package |
| `app-store-scraper` | Direct scraping — no limits | **$0** — free npm package |
| Ollama `nomic-embed-text` | All embeddings run locally on device | **$0** — no API calls |
| Groq API `llama3-8b-8192` | 5 queries/night × 30 = 150 queries/month | **$0** — generous free tier |
| ChromaDB | Ephemeral in-process — no server, no infra | **$0** |
| node-cron | Built into Node.js process | **$0** |
| **Total** | | **$0 / month** |

> **Truly zero-cost.** Direct scraping replaces Apify. Groq's free tier comfortably covers 150 LLM calls/month. Embeddings run locally via Ollama.

---

## 12. Key Insights the Engine Will Surface

Based on the qualitative signals from the problem statement, the engine is pre-tuned to detect and validate:

- **Vibe Protection** — Users treat music as a utility (focus, gym, commute). Cognitive load of a bad song > benefit of discovery.
- **Echo Chamber** — The engagement-optimized algorithm feeds sonically identical tracks, creating a novelty desert.
- **10% Novelty Request** — The emerging unmet need: inject ~10% new-but-similar artists into existing playlists, not wholesale replacement.
- **Discover Weekly Gamble** — Users perceive it as high-risk, all-or-nothing. No "safe" way to try new music.
- **Micro-Control Demand** — Users want a "discovery dial" — a simple slider from "familiar" to "adventurous."

---

*Generated by Antigravity AI — Spotify Review Discovery Engine Architecture v1.3 (Updated: Direct scraping via npm · Groq API LLM · Ollama nomic-embed-text · ChromaDB in-process · node-cron · $0 total cost)*
