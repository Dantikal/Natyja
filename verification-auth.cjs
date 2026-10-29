// Isolated loopback-only fixture API; never mounted by the production server.
// It uses real CAPTCHA validation with a test-generated answer held only in this process.
const crypto = require('node:crypto');
const express = require('express');
const protection = require('./src/middleware/botProtection');
const { createAuthRouter } = require('./src/routes/auth');
module.exports = async function fixtureAuth() {
  const answer = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
  const guard = protection.createProtection({ generate: () => answer });
  const app = express(); app.use(express.json());
  app.use('/api/auth', createAuthRouter({ ...protection, ...guard }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return {
    base,
    async headers(purpose) {
      const response = await fetch(base + '/auth/captcha?purpose=' + purpose);
      if (!response.ok) throw new Error('Fixture CAPTCHA unavailable');
      const data = await response.json();
      return { 'X-Captcha-Id': data.id, 'X-Captcha-Answer': answer };
    },
    async close() { guard.close(); await new Promise(resolve => server.close(resolve)); },
  };
};
