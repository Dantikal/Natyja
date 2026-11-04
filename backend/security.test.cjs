const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { normalizePhoto } = require('./src/middleware/uploadPhoto');

test('photo upload rejects HTML, SVG and corrupt files, and re-encodes real images', async () => {
  for (const content of ['<html><script>alert(1)</script></html>', '<svg width="1" height="1"></svg>', 'invalid']) {
    await assert.rejects(normalizePhoto(Buffer.from(content)));
  }
  const input = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).png().toBuffer();
  const result = await normalizePhoto(input);
  assert.equal((await sharp(result).metadata()).format, 'jpeg');
  const oversized = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: 'red' } }).png().toBuffer();
  await assert.rejects(normalizePhoto(oversized));
});

test('browser security headers prohibit framing and executable object embeds', () => {
  const headers = {};
  let continued = false;
  require('./src/middleware/securityHeaders')({}, { setHeader: (name, value) => { headers[name] = value; } }, () => { continued = true; });
  assert(continued);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.match(headers['Content-Security-Policy'], /object-src 'none'/);
});
