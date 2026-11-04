const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createLibrary, isLocalRequest } = require('./src/services/localKnowledge');

test('local folder updates nested files, removes stale data, and reports unsupported reads', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'local-knowledge-'));
  let reads = 0;
  const library = createLibrary({ root, interval: 0, maxBytes: 200, extract: async buffer => {
    reads++; const text = buffer.toString(); if (text === 'broken') throw new Error('Cannot read text');
    return { text, truncated: false };
  } });
  try {
    await fs.mkdir(path.join(root, 'nested'));
    const file = path.join(root, 'nested', 'данные.md');
    await fs.writeFile(file, 'Original local reference');
    await fs.writeFile(path.join(root, 'ignored.exe'), 'Never run');
    await library.refresh(true);
    assert.equal(library.status().count, 1); assert.equal(reads, 1);
    assert.equal(library.documents()[0].text, 'Original local reference');
    await library.refresh(true); assert.equal(reads, 1, 'unchanged file is cached');
    await fs.writeFile(file, 'Replacement knowledge text that is different');
    await library.refresh(true);
    assert.match(library.documents()[0].text, /Replacement/);
    await fs.writeFile(file, 'broken'); await library.refresh(true);
    assert.equal(library.status().count, 0, 'unreadable replacement cannot leave old content');
    assert.equal(library.status().errors.length, 1);
    await fs.writeFile(file, 'Recovered reference'); await library.refresh(true);
    await fs.unlink(file); await library.refresh(true); assert.equal(library.status().count, 0);
    await fs.writeFile(path.join(root, 'large.txt'), 'a'.repeat(201)); await library.refresh(true);
    assert.equal(library.status().errors.length, 1);
    assert.equal(library.status().count, 0);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('public tunnel and forwarded traffic cannot use the PC knowledge folder', () => {
  const request = (hostname = 'localhost', headers = {}, remoteAddress = '127.0.0.1') => ({
    hostname, socket: { remoteAddress }, get: name => headers[name],
  });
  assert.equal(isLocalRequest(request()), true);
  assert.equal(isLocalRequest(request('127.0.0.1', { 'x-public-gateway': '1', 'x-forwarded-for': '127.0.0.1' })), false);
  assert.equal(isLocalRequest(request('127.0.0.1')), true);
  assert.equal(isLocalRequest(request('example.trycloudflare.com')), false);
  assert.equal(isLocalRequest(request('localhost', { 'cf-connecting-ip': '203.0.113.7' })), false);
  assert.equal(isLocalRequest(request('localhost', { 'x-forwarded-for': '203.0.113.7' })), false);
  assert.equal(isLocalRequest(request('localhost', {}, '192.168.1.5')), false);
});
