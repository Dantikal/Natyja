const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const protection = require('./src/middleware/botProtection');

test('CAPTCHA is private, single-use, expiring and bound to client and form', async () => {
  let clock = 1000;
  const guard = protection.createProtection({ now: () => clock, ttl: 1000, generate: () => 'AB2CD3' });
  const app = express(); app.set('trust proxy', 'loopback');
  app.get('/captcha', guard.issue);
  app.post('/login', guard.verify('login'), (req, res) => res.json({ ok: true }));
  app.post('/register', guard.verify('register'), (req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const issue = async (purpose = 'login') => {
    const r = await fetch(base + '/captcha?purpose=' + purpose);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    const data = await r.json();
    assert(!JSON.stringify(data).includes('AB2CD3'));
    const svg = Buffer.from(data.image.split(',')[1], 'base64').toString();
    assert(svg.includes('<path')); assert(!svg.includes('<text')); assert(!svg.includes('AB2CD3'));
    return data;
  };
  const attempt = (id, answer = 'AB2CD3', path = '/login', ip) => fetch(base + path, { method: 'POST', headers: {
    ...(id ? { 'X-Captcha-Id': id } : {}), 'X-Captcha-Answer': answer, ...(ip ? { 'X-Forwarded-For': ip } : {}),
  } });
  try {
    assert.equal((await attempt()).status, 400);
    let c = await issue();
    assert.equal((await attempt(c.id, 'wrong!')).status, 400);
    assert.equal((await attempt(c.id)).status, 400, 'wrong answer consumes challenge');
    c = await issue();
    assert.equal((await attempt(c.id, 'ab2cd3')).status, 200);
    assert.equal((await attempt(c.id)).status, 400, 'no replay');
    c = await issue(); clock += 1001;
    assert.equal((await attempt(c.id)).status, 400, 'expiry');
    c = await issue('register');
    assert.equal((await attempt(c.id)).status, 400, 'cannot use registration code for login');
    c = await issue('register');
    assert.equal((await attempt(c.id, 'AB2CD3', '/register')).status, 200);
    c = await issue();
    assert.equal((await attempt(c.id, 'AB2CD3', '/login', '203.0.113.5')).status, 400);
    assert.equal((await attempt(c.id)).status, 200, 'another client cannot consume code');
    assert.equal((await fetch(base + '/captcha?purpose=invalid')).status, 400);
  } finally { guard.close(); await new Promise(resolve => server.close(resolve)); }
});

test('login throttling cannot be bypassed by asking for new CAPTCHA codes', async () => {
  const app = express();
  let passed = 0;
  app.post('/login', protection.loginLimit, (req, res) => { passed++; res.status(400).json({ code: 'CAPTCHA_REQUIRED' }); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/login`;
    for (let i = 0; i < 20; i++) assert.equal((await fetch(url, { method: 'POST' })).status, 400);
    const blocked = await fetch(url, { method: 'POST' });
    assert.equal(blocked.status, 429); assert(blocked.headers.get('retry-after'));
    assert.equal(passed, 20);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('challenge storage fails closed when full and recovers after expiry', () => {
  let clock = 0;
  const guard = protection.createProtection({ now: () => clock, ttl: 1000, capacity: 1 });
  const req = { query: {}, ip: '127.0.0.1' };
  let status = 200;
  const res = { set() { return this; }, status(n) { status = n; return this; }, json() {} };
  try {
    guard.issue(req, res); assert.equal(status, 200);
    guard.issue(req, res); assert.equal(status, 503);
    clock = 1001; status = 200; guard.issue(req, res); assert.equal(status, 200);
  } finally { guard.close(); }
});
