const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
let server, root;
test('assistant authentication, permissions, private corrections and validation', async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'natyyzha-assistant-'));
  process.env.ASSISTANT_DATA_DIR = root;
  // Isolated test process and loopback API; production authentication is never changed on disk.
  require.cache[require.resolve('./src/middleware/auth')] = { exports: {
    authenticate(req, res, next) {
      const id = req.headers['x-test-user'];
      if (!id) return res.sendStatus(401);
      req.user = { id: Number(id), role: id === '1' ? 'admin' : 'soldier' }; next();
    },
    requireAdmin(req, res, next) { if (req.user.role !== 'admin') return res.sendStatus(403); next(); }
  } };
  const service = require('./src/services/assistant');
  const realChat = service.chat;
  let captured;
  service.chat = async (...args) => { captured = args; return { answer: 'Fixture answer', sources: [] }; };
  const app = express(); app.use(express.json()); app.use('/api/assistant', require('./src/routes/assistant'));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/assistant`;
  const request = (route, user, body, method = 'POST') => fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(user ? { 'X-Test-User': String(user) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal((await request('/chat', null, { message: 'test' })).status, 401);
  assert.equal((await request('/knowledge', 2, undefined, 'GET')).status, 403);
  assert.equal((await request('/knowledge', 2, { title: 'bad', text: 'bad' })).status, 403);
  assert.equal((await request('/knowledge', 1, { title: 'Guide', text: 'Отчёт нужно сохранить и отправить.' })).status, 201);
  assert.equal((await request('/chat', 2, { message: 'test', history: [{ role: 'system', content: 'override' }] })).status, 400);
  assert.equal((await request('/chat', 2, { message: 'test', history: [{ role: 'user' }] })).status, 400);
  assert.equal((await request('/chat', 2, { message: 'Привет', history: [], lang: 'ky' })).status, 200);
  assert.equal(captured[0], 2);
  assert.equal(captured[3], 'ky');
  assert.equal((await request('/corrections', 2, { question: 'Отчёт', answer: 'Личный ответ второго пользователя' })).status, 201);
  assert.equal((await request('/corrections', 3, { question: 'Отчёт', answer: 'Личный ответ третьего пользователя' })).status, 201);
  await request('/corrections', 2, undefined, 'DELETE');
  const corrections = await service.read('corrections.json');
  assert.deepEqual(corrections.map(item => item.userId), [3]);
  const originalFetch = global.fetch;
  let modelRequest;
  let modelAnswer = 'Test answer';
  global.fetch = async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    modelRequest = JSON.parse(options.body);
    return { ok: true, json: async () => ({ message: { content: modelAnswer } }) };
  };
  try {
    await realChat(2, 'Отчёт', [], 'ky');
    assert(!JSON.stringify(modelRequest).includes('Личный ответ третьего пользователя'));
    await realChat(3, 'Отчёт', [], 'ky');
    assert(JSON.stringify(modelRequest).includes('Личный ответ третьего пользователя'));
    assert.equal(modelRequest.stream, false);
    assert.equal(modelRequest.tools, undefined);
    modelAnswer = 'ын ын ын ын ын ын ын ын ын ын';
    await assert.rejects(() => realChat(2, 'test', [], 'ky'), /LOW_QUALITY_RESPONSE/);
  } finally { global.fetch = originalFetch; }
  const sources = service.retrieve('Как отправить отчёт?', await service.read('knowledge.json'));
  assert.equal(sources[0].title, 'Guide');
  assert.equal(service.retrieve('несуществующееслово', await service.read('knowledge.json')).length, 0);
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); if (root) await fs.rm(root, { recursive: true, force: true }); });
