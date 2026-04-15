/**
 * routes/auth.js
 * ──────────────
 * Authentication endpoints:
 *   POST /api/auth/login   → returns JWT
 *   POST /api/auth/logout  → client-side (stateless JWT)
 *   GET  /api/auth/me      → returns current user info
 *
 * DBMS concepts:
 *   - Parameterised queries (prevent SQL injection)
 *   - SELECT with WHERE clause
 */

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db/database');
const auth    = require('../middleware/auth');
const { JWT_SECRET, JWT_EXPIRY } = require('../config');

const router = express.Router();

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // Parameterised query — safe against SQL injection
  const user = db.prepare(
    `SELECT id, username, password_hash, display_name FROM users WHERE username = ?`
  ).get(username.trim().toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  res.json({
    message:      'Login successful.',
    token,
    user: {
      id:           user.id,
      username:     user.username,
      display_name: user.display_name,
    },
  });
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', auth, (req, res) => {
  const user = db.prepare(
    `SELECT id, username, display_name, created_at FROM users WHERE id = ?`
  ).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
});

// ── POST /api/auth/logout ────────────────────────────────────
// JWT is stateless — client simply discards the token.
router.post('/logout', auth, (_req, res) => {
  res.json({ message: 'Logged out. Please discard your token.' });
});

module.exports = router;
