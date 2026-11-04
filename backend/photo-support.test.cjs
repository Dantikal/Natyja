const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { extract } = require('./src/services/supportAssistant');

test('reads a real photo fixture offline and rejects corrupt and oversized images', async () => {
  const svg = Buffer.from('<svg width="1400" height="260"><rect width="100%" height="100%" fill="white"/><text x="40" y="100" font-family="Arial" font-size="48" fill="black">REPORT 2026</text><text x="40" y="180" font-family="Arial" font-size="44" fill="black">Prepare the monthly report.</text></svg>');
  const image = await sharp(svg).png().toBuffer();
  const parsed = await extract(image, '.png');
  assert.match(parsed.text, /REPORT 2026/);
  assert.match(parsed.text, /monthly report/i);
  await assert.rejects(extract(Buffer.from('fake photo'), '.jpg'), /Не удалось/);
  const oversized = await sharp({ create: { width: 5000, height: 4000, channels: 3, background: 'white' } }).png().toBuffer();
  await assert.rejects(extract(oversized, '.png'), /Не удалось/);
});
