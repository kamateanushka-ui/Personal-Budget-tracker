/**
 * middleware/auth.js
 * ──────────────────
 * JWT verification middleware.
 * Attaches req.user = { id, username } on success.
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, username: payload.username };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
};
