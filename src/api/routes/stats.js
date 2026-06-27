'use strict';
const express = require('express');
const router = express.Router();
const { getStats } = require('../../ingestion/store_raw');

/**
 * GET /api/stats
 * Retrieves review counts and platform distribution from SQLite.
 */
router.get('/', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    console.error('[API] Error fetching stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch statistics.' });
  }
});

module.exports = router;
