/**
 * routes/categories.js
 * ─────────────────────
 *   GET /api/categories          → list all categories
 *   GET /api/categories?type=income|expense  → filtered list
 *
 * DBMS concepts: simple SELECT with optional WHERE filter
 */

const express = require('express');
const db      = require('../db/database');
const auth    = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const { type } = req.query;
  let rows;

  if (type && ['income','expense'].includes(type)) {
    rows = db.prepare(
      `SELECT id, name, type FROM categories WHERE type = ? OR type = 'both' ORDER BY name`
    ).all(type);
  } else {
    rows = db.prepare(`SELECT id, name, type FROM categories ORDER BY type, name`).all();
  }

  res.json({ data: rows });
});

module.exports = router;
