# Spotify Review Discovery Engine 🎧

> **Strategic Goal:** Move Spotify users from passive, repetitive listening into active, meaningful discovery — by mining qualitative app-store feedback at scale and synthesizing PM-grade insights using a fully automated RAG pipeline.

![Dashboard Preview](src/dashboard/public/favicon.svg) *(Imagine a beautiful glassmorphic dashboard here!)*

The **Spotify Review Discovery Engine** is an end-to-end autonomous backend and frontend pipeline. It continually ingests live App Store and Play Store reviews, processes them using a local embedding model, and uses Groq's blazing-fast LLM to extract actionable Product Management insights related to user discovery experiences (e.g., *Echo Chamber Effect*, *Vibe Protection*).

## 🌟 Key Features

### 1. Zero-Cost Data Ingestion
- **No APIs Required:** Directly scrapes live reviews from the iOS App Store and Google Play Store using `app-store-scraper` and `google-play-scraper`.
- **Hugging Face Integration:** Seamlessly ingests external CSV datasets (e.g., from Hugging Face Spaces) mapping them into our structured schema.
- **Deduplication:** All reviews are cleanly stored and deduplicated using a local SQLite (`sql.js`) database.

### 2. Strict Data Quality Filters
- **Language Detection:** Uses `languagedetect` to enforce 100% English-only reviews.
- **Emoji Filtering:** Drops reviews polluted with emojis to ensure maximum NLP quality.
- **Relevance Targeting:** Keywords like *algorithm, discover, recommend, playlist, vibe, shuffle,* and *explore* are enforced to ensure only PM-relevant discovery signals are processed.

### 3. Local-First Vectorization
- **Transformers.js:** Generates embeddings 100% locally inside the Node.js process using `Xenova/all-MiniLM-L6-v2`. No external Ollama servers or Docker required.
- **ChromaDB:** Uses an ephemeral, in-process ChromaDB vector store to house chunked embeddings for lightning-fast cosine similarity retrieval.

### 4. Lightning-Fast LLM Synthesis (Groq)
- Powered by **Groq** (`llama-3.1-8b-instant`), the RAG synthesizer translates retrieved raw user complaints into polished, structured JSON PM insights complete with exact evidence quotes, impact levels, and actionable recommendations.

### 5. Premium React PM Dashboard
- **Vite + React:** A blazing fast frontend dashboard.
- **Spotify Aesthetics:** Pure Vanilla CSS implementation of Spotify's iconic Dark Mode, featuring glassmorphism, dynamic metric cards, and responsive insight grids.

## 🏗️ Architecture Overview

The pipeline runs automatically via an integrated `node-cron` scheduler (set to run nightly at 01:00).

```text
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
│  • Play Store    │    │  • Strict Clean      │   │  • ChromaDB Retrieval │
│  • App Store     │    │  • Transformers.js   │   │  • Groq API (LLM)     │
│  • HF CSVs       │    │  • ChromaDB (in-mem) │   │  • Weekly Digest JSON │
└──────────────────┘    └──────────────────────┘   └───────────────────────┘
                                                               │
                                                               ▼
                                               ┌───────────────────────────┐
                                               │  LAYER 4                  │
                                               │  PM Dashboard (React)     │
                                               │  • Insight Theme Cards    │
                                               │  • Stats & Volume Metrics │
                                               └───────────────────────────┘
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18.0.0+)
- A [Groq API Key](https://console.groq.com/keys)

### 1. Setup Environment
```bash
git clone https://github.com/hritikabhatnagar2003/Spotify-workflow-.git
cd Spotify-workflow-

# Install Backend Dependencies
npm install

# Setup Environment Variables
cp .env.example .env
# Edit .env and insert your GROQ_API_KEY
```

### 2. Run the Engine (Backend)
```bash
# Bootstrap the SQLite database
npm run bootstrap

# Run the complete pipeline (Ingest, Clean, Embed, Synthesize)
npm run pipeline

# Start the Express API (Serves the Dashboard + runs Cron Job)
npm start
```

### 3. Launch the Dashboard (Frontend)
Open a second terminal window:
```bash
cd src/dashboard
npm install
npm run dev
```
Navigate to `http://localhost:5173/` to view the PM Dashboard!

---

*Built for Product Managers who want to listen to their users at scale.* 🚀
