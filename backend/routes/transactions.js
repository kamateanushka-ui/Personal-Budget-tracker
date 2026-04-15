/**
 * routes/transactions.js
 * ───────────────────────
 * Full CRUD for transactions, scoped to the logged-in user.
 *
 *   GET    /api/transactions        → list (with filters + pagination)
 *   POST   /api/transactions        → create
 *   GET    /api/transactions/:id    → get one
 *   PUT    /api/transactions/:id    → update
 *   DELETE /api/transactions/:id    → delete
 *
 * DBMS concepts demonstrated:
 *   - SELECT with JOIN (transactions ⟕ categories)
 *   - WHERE + AND filtering
 *   - ORDER BY, LIMIT, OFFSET (pagination)
 *   - Aggregation: SUM, COUNT, GROUP BY
 *   - Parameterised/prepared statements
 *   - DML: INSERT, UPDATE, DELETE
 *   - Ownership check (user_id = ?) for row-level security
 */

const express = require('express');
const db      = require('../db/database');
const auth    = require('../middleware/auth');

const router = express.Router();

// All routes require a valid JWT
router.use(auth);


// ══════════════════════════════════════════════════════════════
// GET /api/transactions
// Supports: ?type=income|expense  ?category=Food  ?search=...
//           ?from=YYYY-MM-DD  ?to=YYYY-MM-DD
//           ?page=1  ?limit=20
// ══════════════════════════════════════════════════════════════
router.get('/', (req, res) => {
  const { type, category, search, from, to } = req.query;
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 50);
  const offset = (page - 1) * limit;

  // Build dynamic WHERE clauses
  const conditions = ['t.user_id = ?'];
  const params     = [req.user.id];

  if (type && ['income','expense'].includes(type)) {
    conditions.push('t.type = ?');
    params.push(type);
  }
  if (category) {
    conditions.push('c.name = ?');
    params.push(category);
  }
  if (search) {
    conditions.push('(t.description LIKE ? OR t.note LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (from) {
    conditions.push('t.txn_date >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('t.txn_date <= ?');
    params.push(to);
  }

  const whereClause = conditions.join(' AND ');

  // Count total matching rows (for pagination metadata)
  const total = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE ${whereClause}
  `).get(...params).cnt;

  // Fetch paginated rows  — JOIN to get category name
  const rows = db.prepare(`
    SELECT
      t.id,
      t.type,
      t.description,
      t.amount,
      t.txn_date   AS date,
      t.note,
      t.created_at,
      c.name       AS cat,
      c.id         AS category_id
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE ${whereClause}
    ORDER BY t.txn_date DESC, t.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    data: rows,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
});


// ══════════════════════════════════════════════════════════════
// POST /api/transactions — Create a new transaction
// ══════════════════════════════════════════════════════════════
router.post('/', (req, res) => {
  const { type, description, amount, date, category, note } = req.body;

  // ── Validation ───────────────────────────────────────────
  if (!type || !['income','expense'].includes(type)) {
    return res.status(400).json({ error: 'type must be "income" or "expense".' });
  }
  if (!description || description.trim().length === 0) {
    return res.status(400).json({ error: 'description is required.' });
  }
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number.' });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format.' });
  }
  if (!category) {
    return res.status(400).json({ error: 'category is required.' });
  }

  // ── Resolve category FK ──────────────────────────────────
  const cat = db.prepare(
    `SELECT id FROM categories WHERE name = ? AND (type = ? OR type = 'both')`
  ).get(category, type);

  if (!cat) {
    return res.status(400).json({ error: `Category "${category}" not found for type "${type}".` });
  }

  // ── INSERT ───────────────────────────────────────────────
  const result = db.prepare(`
    INSERT INTO transactions(user_id, category_id, type, description, amount, txn_date, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, cat.id, type, description.trim(), Number(amount), date, (note || '').trim());

  const created = db.prepare(`
    SELECT t.id, t.type, t.description, t.amount, t.txn_date AS date, t.note,
           c.name AS cat, c.id AS category_id
    FROM transactions t JOIN categories c ON c.id = t.category_id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ message: 'Transaction created.', data: created });
});


// ══════════════════════════════════════════════════════════════
// GET /api/transactions/:id — Get single transaction
// ══════════════════════════════════════════════════════════════
router.get('/:id', (req, res) => {
  const txn = db.prepare(`
    SELECT t.id, t.type, t.description, t.amount, t.txn_date AS date, t.note, t.created_at,
           c.name AS cat, c.id AS category_id
    FROM transactions t JOIN categories c ON c.id = t.category_id
    WHERE t.id = ? AND t.user_id = ?
  `).get(req.params.id, req.user.id);

  if (!txn) return res.status(404).json({ error: 'Transaction not found.' });
  res.json({ data: txn });
});


// ══════════════════════════════════════════════════════════════
// PUT /api/transactions/:id — Update a transaction
// ══════════════════════════════════════════════════════════════
router.put('/:id', (req, res) => {
  // Ownership check
  const existing = db.prepare(
    `SELECT id FROM transactions WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Transaction not found.' });

  const { type, description, amount, date, category, note } = req.body;

  // Resolve new category if provided
  let catId = undefined;
  if (category) {
    const effectiveType = type || db.prepare(`SELECT type FROM transactions WHERE id=?`).get(req.params.id).type;
    const cat = db.prepare(
      `SELECT id FROM categories WHERE name = ? AND (type = ? OR type = 'both')`
    ).get(category, effectiveType);
    if (!cat) return res.status(400).json({ error: `Category "${category}" not found.` });
    catId = cat.id;
  }

  // Build dynamic SET clause
  const updates = [];
  const params  = [];

  if (type)        { updates.push('type = ?');        params.push(type); }
  if (description) { updates.push('description = ?'); params.push(description.trim()); }
  if (amount)      { updates.push('amount = ?');      params.push(Number(amount)); }
  if (date)        { updates.push('txn_date = ?');    params.push(date); }
  if (catId)       { updates.push('category_id = ?'); params.push(catId); }
  if (note !== undefined) { updates.push('note = ?'); params.push(note.trim()); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update.' });
  }

  updates.push(`updated_at = datetime('now')`);
  params.push(req.params.id, req.user.id);

  db.prepare(`
    UPDATE transactions SET ${updates.join(', ')}
    WHERE id = ? AND user_id = ?
  `).run(...params);

  const updated = db.prepare(`
    SELECT t.id, t.type, t.description, t.amount, t.txn_date AS date, t.note, t.updated_at,
           c.name AS cat
    FROM transactions t JOIN categories c ON c.id = t.category_id
    WHERE t.id = ?
  `).get(req.params.id);

  res.json({ message: 'Transaction updated.', data: updated });
});


// ══════════════════════════════════════════════════════════════
// DELETE /api/transactions/:id
// ══════════════════════════════════════════════════════════════
router.delete('/:id', (req, res) => {
  const result = db.prepare(
    `DELETE FROM transactions WHERE id = ? AND user_id = ?`
  ).run(req.params.id, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }
  res.json({ message: 'Transaction deleted.' });
});


module.exports = router;
