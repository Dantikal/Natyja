const crypto = require('node:crypto');
const svgCaptcha = require('svg-captcha');
const { rateLimit } = require('express-rate-limit');

function limiter(windowMs, limit) {
  return rateLimit({
    windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { code: 'RATE_LIMITED', error: 'Слишком много запросов. Повторите позже.' },
  });
}

function createProtection({ now = Date.now, ttl = 5 * 60 * 1000, capacity = 3000, generate } = {}) {
  const challenges = new Map();
  const secret = crypto.randomBytes(32);
  const digest = value => crypto.createHmac('sha256', secret).update(value).digest();
  const clean = () => { for (const [id, item] of challenges) if (item.expires <= now()) challenges.delete(id); };
  const timer = setInterval(clean, 60000);
  timer.unref();

  function issue(req, res) {
    res.set('Cache-Control', 'no-store');
    const purpose = req.query.purpose || 'login';
    if (!['login', 'register'].includes(purpose)) return res.status(400).json({ error: 'Неверный тип проверки' });
    clean();
    if (challenges.size >= capacity) return res.status(503).json({ error: 'Проверка временно недоступна. Повторите позже.' });
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const answer = generate ? generate() : Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
    const id = crypto.randomBytes(24).toString('hex');
    const svg = svgCaptcha(answer, { width: 220, height: 72, fontSize: 48, noise: 4, color: true, background: '#f2f5f8' });
    challenges.set(id, { hash: digest(answer.toUpperCase()), ip: req.ip, purpose, expires: now() + ttl });
    res.json({ id, image: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'), expiresIn: ttl / 1000 });
  }

  function verify(purpose) {
    return (req, res, next) => {
      const id = req.get('X-Captcha-Id');
      const answer = req.get('X-Captcha-Answer');
      const item = typeof id === 'string' && challenges.get(id);
      // Consume a challenge on its first attempt. A different client cannot consume it.
      if (item && item.ip === req.ip) challenges.delete(id);
      if (!item || item.ip !== req.ip || item.purpose !== purpose || item.expires <= now() ||
          typeof answer !== 'string' || !/^[a-z0-9]{6}$/i.test(answer.trim()) ||
          !crypto.timingSafeEqual(item.hash, digest(answer.trim().toUpperCase()))) {
        return res.status(400).json({ code: 'CAPTCHA_REQUIRED', error: 'Введите код с новой картинки.' });
      }
      next();
    };
  }
  return { issue, verify, close: () => clearInterval(timer) };
}

const protection = createProtection();
module.exports = {
  ...protection, createProtection,
  apiLimit: limiter(60000, 240),
  captchaLimit: limiter(5 * 60000, 30),
  loginLimit: limiter(15 * 60000, 20),
  registerLimit: limiter(60 * 60000, 5),
};
