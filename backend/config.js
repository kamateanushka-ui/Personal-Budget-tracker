/**
 * config.js
 * ─────────
 * Centralised app configuration.
 * In production, set these as environment variables.
 */

module.exports = {
  PORT:       process.env.PORT       || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'budgetiq_super_secret_key_2025',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '7d',
};
