/**
 * server.js  — BudgetIQ Backend Entry Point
 * ──────────────────────────────────────────
 * Express REST API server.
 * Mounts all route modules and starts listening.
 */

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { PORT } = require('./config');

// Initialise DB on startup (creates file + applies schema if needed)
require('./db/database');

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: '*' }));          // Allow all origins (dev)
app.use(express.json());                 // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// ── Serve frontend static file ────────────────────────────────
// Serves budget_tracker.html from the parent directory
app.use(express.static(path.join(__dirname, '..')));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/summary',      require('./routes/summary'));
app.use('/api/categories',   require('./routes/categories'));

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error.', detail: err.message });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 BudgetIQ API running at http://localhost:${PORT}`);
  console.log(`   Frontend → http://localhost:${PORT}/budget_tracker.html`);
  console.log(`   API docs → see README.md\n`);
});
