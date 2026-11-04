const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !/^Bearer [^ ]+$/i.test(header)) return res.status(401).json({ error: 'Нет токена' });

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const [rows] = await pool.execute(`SELECT u.id, u.role, u.approved, u.soldier_id, u.token_version, u.must_change_password,
      COALESCE(u.unit_id, s.unit_id) AS unit_id FROM users u LEFT JOIN soldiers s ON s.id = u.soldier_id WHERE u.id = ?`, [decoded.id]);
    if (!rows.length) return res.status(401).json({ error: 'Пользователь не найден' });
    if (Number(decoded.tokenVersion || 0) !== Number(rows[0].token_version || 0)) return res.status(401).json({ error: 'Пароль изменён. Войдите заново.' });
    if (!rows[0].approved) return res.status(403).json({ error: 'Не одобрен' });
    if (rows[0].must_change_password && req.originalUrl.split('?')[0] !== '/api/auth/change-password') return res.status(403).json({ error: 'Необходимо изменить временный пароль', code: 'PASSWORD_CHANGE_REQUIRED' });
    req.user = rows[0];
    next();
  } catch (err) {
    if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name)) return next(err);
    res.status(401).json({ error: 'Неверный токен' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Только для админа' });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
