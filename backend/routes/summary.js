/**
 * routes/summary.js
 * ─────────────────
 * Analytics / summary endpoints for the dashboard and budget page.
 *
 *   GET /api/summary/overview          → total income, expense, balance, savings rate
 *   GET /api/summary/by-category       → expense grouped by category (for budget bars)
 *   GET /api/summary/monthly           → monthly breakdown (last 6 months)
 *
 * DBMS concepts:
 *   - Aggregate functions: SUM(), COUNT(), ROUND()
 *   - GROUP BY + ORDER BY
 *   - Subqueries and conditional aggregation (CASE WHEN)
 *   - strftime() for date grouping
 */

const express = require('express');
const db      = require('../db/database');
const auth    = require('../middleware/auth');

const router = express.Router();
router.use(auth);


// ══════════════════════════════════════════════════════════════
// GET /api/summary/overview
// Returns: total income, total expense, balance, savings rate
// Optional: ?from=YYYY-MM-DD  ?to=YYYY-MM-DD
// ══════════════════════════════════════════════════════════════
router.get('/overview', (req, res) => {
  const { from, to } = req.query;
  const conditions = ['user_id = ?'];
  const params     = [req.user.id];

  if (from) { conditions.push('txn_date >= ?'); params.push(from); }
  if (to)   { conditions.push('txn_date <= ?'); params.push(to); }

  const where = conditions.join(' AND ');

  // Conditional aggregation — single table scan
  const row = db.prepare(`
    SELECT
      ROUND(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 2) AS total_income,
      ROUND(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 2) AS total_expense,
      COUNT(*) AS total_transactions
    FROM transactions
    WHERE ${where}
  `).get(...params);

  const income  = row.total_income  || 0;
  const expense = row.total_expense || 0;
  const balance = income - expense;
  const savings_rate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

  res.json({
    data: {
      total_income:       income,
      total_expense:      expense,
      balance,
      savings_rate,
      total_transactions: row.total_transactions,
    },
  });
});


// ══════════════════════════════════════════════════════════════
// GET /api/summary/by-category
// Returns expense amounts grouped by category, sorted desc
// ══════════════════════════════════════════════════════════════
router.get('/by-category', (req, res) => {
  const { from, to } = req.query;
  const conditions = [`t.user_id = ?`, `t.type = 'expense'`];
  const params     = [req.user.id];

  if (from) { conditions.push('t.txn_date >= ?'); params.push(from); }
  if (to)   { conditions.push('t.txn_date <= ?'); params.push(to); }

  const rows = db.prepare(`
    SELECT
      c.name                   AS category,
      ROUND(SUM(t.amount), 2)  AS total,
      COUNT(t.id)              AS count
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE ${conditions.join(' AND ')}
    GROUP BY c.name
    ORDER BY total DESC
  `).all(...params);

  // Compute grand total for percentage share
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const data = rows.map(r => ({
    ...r,
    share: grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0,
  }));

  res.json({ data, grand_total: grandTotal });
});


// ══════════════════════════════════════════════════════════════
// GET /api/summary/monthly
// Returns last 6 months of income vs expense
// ══════════════════════════════════════════════════════════════
router.get('/monthly', (req, res) => {
  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m', txn_date)                                       AS month,
      ROUND(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 2)   AS income,
      ROUND(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 2)   AS expense
    FROM transactions
    WHERE user_id = ?
      AND txn_date >= date('now', '-6 months')
    GROUP BY month
    ORDER BY month ASC
  `).all(req.user.id);

  res.json({ data: rows });
});


// ══════════════════════════════════════════════════════════════
// GET /api/summary/recent
// Returns latest N transactions for the dashboard table
// ══════════════════════════════════════════════════════════════
router.get('/recent', (req, res) => {
  const limit = Math.min(20, parseInt(req.query.limit) || 6);

  const rows = db.prepare(`
    SELECT
      t.id, t.type, t.description, t.amount,
      t.txn_date AS date, t.note,
      c.name AS cat
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = ?
    ORDER BY t.txn_date DESC, t.id DESC
    LIMIT ?
  `).all(req.user.id, limit);

  res.json({ data: rows });
});


module.exports = router;
