'use strict';
/**
 * server.js
 * ─────────────────────────────────────────────────────────────
 * Express API serving the Spotify Review Engine backend.
 * Provides endpoints for the React dashboard to fetch stats and insights.
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const statsRoute = require('./routes/stats');
const insightsRoute = require('./routes/insights');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/stats', statsRoute);
app.use('/api/insights', insightsRoute);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Spotify Review Engine API is running.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[API] Server is running on http://localhost:${PORT}`);
});
