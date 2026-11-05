const express = require('express');
const bcrypt = require('bcrypt');
const authSession = require('../utils/authSession');
const userActivity = require('../utils/userActivity');
const { authenticate } = require('../middleware/auth');
const pool = require('../config/db');
const uploadPhoto = require('../middleware/uploadPhoto');
const registrationFields=require('../utils/registrationFields');
function createAuthRouter(botProtection = require('../middleware/botProtection')) {
const router = express.Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/captcha', botProtection.captchaLimit, botProtection.issue);

// РЕГИСТРАЦИЯ с фото, званием, должностью, частью
router.post('/register', botProtection.registerLimit, botProtection.verify('register'), uploadPhoto.single('photo'), async (req, res) => {
  const { email, password, fullName, requestedRole } = req.body;
  let saved=false;
  const cleanPhoto=()=>{if(!saved&&req.file)require('fs').promises.unlink(req.file.path).catch(()=>{});};

  if (!email || !password || !fullName) {
    cleanPhoto();return res.status(400).json({ error: 'Заполните ФИО, email и пароль' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Загрузите фото' });
  }

  try {
    if(typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email.trim())||typeof password!=='string'||password.length<8||Buffer.byteLength(password)>72||typeof fullName!=='string'||!fullName.trim()||fullName.length>255)throw Object.assign(new Error('Проверьте ФИО, email и пароль'),{status:400});
    if(requestedRole&&!['user','commander'].includes(requestedRole))throw Object.assign(new Error('Неверная роль'),{status:400});
    const [rankId,customRank,positionId,customPosition,unitId,customUnit]=await registrationFields(req.body,pool);
    const hash = await bcrypt.hash(password, 12);
    const photoFile = req.file.filename;

    await pool.execute(
      `INSERT INTO users 
        (email, password_hash, full_name, role, approved, 
         rank_id, position_id, unit_id, photo_file, requested_role,custom_rank,custom_position,custom_unit)
       VALUES (?, ?, ?, 'pending', 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email.trim().toLowerCase(),
        hash,
        fullName.trim(),
        rankId,
        positionId,
        unitId,
        photoFile,
        requestedRole || 'user',
        customRank,customPosition,customUnit,
      ]
    );

    saved=true;res.status(201).json({ message: 'Заявка отправлена. Ожидайте одобрения.' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Этот email уже зарегистрирован' });
    }
    res.status(err.status||500).json({ error: err.status?err.message:'Ошибка регистрации' });
  }
  finally{cleanPhoto();}
});

// ВХОД
router.post('/login', botProtection.loginLimit, async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Укажите email и пароль' });
  }
  try {
    const [rows] = await pool.execute(`SELECT u.*, COALESCE(u.unit_id, s.unit_id) AS resolved_unit_id
      FROM users u LEFT JOIN soldiers s ON s.id = u.soldier_id WHERE u.email = ?`, [email.trim().toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error: 'Неверный email или пароль' });

    const user = rows[0];
    user.unit_id = user.resolved_unit_id;
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный email или пароль' });

    if (!user.approved) {
      return res.status(403).json({ error: 'pending', message: 'Заявка ещё не одобрена' });
    }

    await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
    await userActivity(user.id, user.id, 'Вход в систему');
    res.json(authSession(user));
  } catch (err) {
    res.status(500).json({ error: 'Не удалось выполнить вход. Повторите позже.' });
  }
});

router.post('/change-password', botProtection.loginLimit, authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) return res.status(400).json({ error: 'Новый пароль: от 8 символов, не более 72 байт' });
  if (currentPassword === newPassword) return res.status(400).json({ error: 'Новый пароль должен отличаться от текущего' });
  try {
    const [[user]] = await pool.execute(`SELECT u.*, COALESCE(u.unit_id,s.unit_id) AS resolved_unit_id FROM users u LEFT JOIN soldiers s ON s.id=u.soldier_id WHERE u.id=?`, [req.user.id]);
    if (!await bcrypt.compare(currentPassword, user.password_hash)) return res.status(400).json({ error: 'Неверный текущий пароль' });
    const hash = await bcrypt.hash(newPassword, 12);
    const [result] = await pool.execute('UPDATE users SET password_hash=?, must_change_password=0, token_version=token_version+1 WHERE id=? AND token_version=?', [hash, user.id, user.token_version]);
    if (!result.affectedRows) return res.status(409).json({ error: 'Данные изменились. Войдите заново.' });
    user.token_version++; user.must_change_password = 0;
    await userActivity(user.id, user.id, 'Пароль изменён');
    res.json(authSession(user));
  } catch (err) { res.status(500).json({ error: 'Не удалось изменить пароль' }); }
});

return router;
}
module.exports = createAuthRouter();
module.exports.createAuthRouter = createAuthRouter;
