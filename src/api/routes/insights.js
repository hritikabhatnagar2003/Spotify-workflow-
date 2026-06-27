'use strict';
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const OUTPUTS_DIR = path.resolve(__dirname, '../../../data/outputs');

/**
 * GET /api/insights
 * Retrieves the most recently generated weekly digest JSON file.
 */
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(OUTPUTS_DIR)) {
      return res.json({ generated_at: new Date().toISOString(), insights: [] });
    }

    const files = fs.readdirSync(OUTPUTS_DIR)
      .filter(f => f.startsWith('digest_') && f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a)); // Sort descending (newest first)

    if (files.length === 0) {
      return res.json({ generated_at: new Date().toISOString(), insights: [] });
    }

    const latestFile = path.join(OUTPUTS_DIR, files[0]);
    const fileContent = fs.readFileSync(latestFile, 'utf-8');
    const digest = JSON.parse(fileContent);

    res.json(digest);
  } catch (error) {
    console.error('[API] Error fetching insights:', error.message);
    res.status(500).json({ error: 'Failed to fetch insights digest.' });
  }
});

module.exports = router;
