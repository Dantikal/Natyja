const express = require('express');
const bcrypt = require('bcrypt');
const { randomBytes } = require('crypto');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const userActivity = require('../utils/userActivity');
const router = express.Router();
router.use(authenticate, requireAdmin);

const activityUnion = `SELECT a.id, 'account' AS kind, a.action, a.details, a.created_at,
  actor.full_name AS actor_name, NULL AS task_id, NULL AS task_title
  FROM user_activity a LEFT JOIN users actor ON actor.id=a.actor_user_id
  WHERE a.target_user_id=? OR a.actor_user_id=?
  UNION ALL
  SELECT h.id, 'task' AS kind, h.action, h.details, h.created_at,
  actor.full_name AS actor_name, h.task_id, t.title AS task_title
  FROM task_history h LEFT JOIN users actor ON actor.id=h.user_id LEFT JOIN tasks t ON t.id=h.task_id WHERE h.user_id=?`;
async function activity(id, offset = 0) {
  const [items] = await pool.query(`SELECT * FROM (${activityUnion}) events ORDER BY created_at DESC, id DESC LIMIT 50 OFFSET ?`, [id, id, id, offset]);
  const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM (${activityUnion}) events`, [id, id, id]);
  return { items, total: Number(count.total), nextOffset: offset + items.length < count.total ? offset + items.length : null };
}

router.get('/:id/activity', async (req, res) => {
  const id = Number(req.params.id), offset = Number(req.query.offset || 0);
  if (!Number.isInteger(id) || id <= 0 || !Number.isSafeInteger(offset) || offset < 0) return res.status(400).json({ error: 'Неверные параметры' });
  try { res.json(await activity(id, offset)); } catch { res.status(500).json({ error: 'Не удалось загрузить историю' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [[user]] = await pool.execute(`SELECT u.id,u.email,u.role,u.approved,u.created_at,u.requested_role,u.soldier_id,
      u.last_login_at,u.must_change_password,u.custom_rank,u.custom_position,u.custom_unit,
      COALESCE(s.full_name,u.full_name) AS full_name, u.full_name AS account_name,
      COALESCE(s.photo_file,u.photo_file) AS photo_file,
      COALESCE(u.unit_id,s.unit_id) AS unit_id, COALESCE(s.rank_id,u.rank_id) AS rank_id, COALESCE(s.position_id,u.position_id) AS position_id,
      COALESCE(u.custom_rank,r.name) AS rank_name,COALESCE(u.custom_position,p.name) AS position_name,COALESCE(u.custom_unit,mu.name) AS unit_name,mu.location AS unit_location,
      s.years_of_service,s.reprimands,s.characteristic,s.works_percent,s.shifts_percent
      FROM users u LEFT JOIN soldiers s ON s.id=u.soldier_id
      LEFT JOIN ranks r ON r.id=COALESCE(s.rank_id,u.rank_id)
      LEFT JOIN positions p ON p.id=COALESCE(s.position_id,u.position_id)
      LEFT JOIN military_units mu ON mu.id=COALESCE(u.unit_id,s.unit_id) WHERE u.id=?`, [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const [tasks] = user.soldier_id ? await pool.execute('SELECT id,title,status,priority,classification,due_date,created_at,submitted_at,approved_at,parent_task_id,report_type FROM tasks WHERE soldier_id=? ORDER BY created_at DESC', [user.soldier_id]) : [[]];
    res.set('Cache-Control', 'no-store');
    res.json({ user, tasks, activity: await activity(user.id) });
  } catch { res.status(500).json({ error: 'Не удалось загрузить карточку' }); }
});

router.patch('/:id', async (req, res) => {
  const { fullName, email, rankId, positionId, unitId, yearsOfService = 0, reprimands = 0, characteristic = '' } = req.body;
  if (typeof fullName !== 'string' || !fullName.trim() || fullName.length > 255 || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 255) return res.status(400).json({ error: 'Проверьте ФИО и логин (email)' });
  if (![yearsOfService, reprimands].every(v => Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 150)) return res.status(400).json({ error: 'Выслуга и выговоры: от 0 до 150' });
  if (![rankId, positionId, unitId].every(v => !v || Number.isInteger(Number(v)) && Number(v) > 0) || typeof characteristic !== 'string') return res.status(400).json({ error: 'Проверьте данные карточки' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[user]] = await connection.execute('SELECT soldier_id FROM users WHERE id=? FOR UPDATE', [req.params.id]);
    if (!user) { await connection.rollback(); return res.status(404).json({ error: 'Пользователь не найден' }); }
    await connection.execute('UPDATE users SET full_name=?,email=?,rank_id=?,position_id=?,unit_id=?,custom_rank=IF(? IS NULL,custom_rank,NULL),custom_position=IF(? IS NULL,custom_position,NULL),custom_unit=IF(? IS NULL,custom_unit,NULL) WHERE id=?', [fullName.trim(), email.trim().toLowerCase(), rankId || null, positionId || null, unitId || null,rankId||null,positionId||null,unitId||null,req.params.id]);
    if (user.soldier_id) await connection.execute('UPDATE soldiers SET full_name=?,rank_id=?,position_id=?,unit_id=?,years_of_service=?,reprimands=?,characteristic=? WHERE id=?', [fullName.trim(),rankId || null,positionId || null,unitId || null,Number(yearsOfService),Number(reprimands),characteristic,user.soldier_id]);
    await connection.execute('INSERT INTO user_activity (actor_user_id,target_user_id,action,details) VALUES (?,?,?,?)', [req.user.id,req.params.id,'Данные пользователя изменены','Обновлены данные аккаунта и личной карточки']);
    await connection.commit(); res.json({ message: 'Данные сохранены' });
  } catch (err) {
    await connection.rollback();
    res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 400).json({ error: err.code === 'ER_DUP_ENTRY' ? 'Этот email уже зарегистрирован' : 'Не удалось сохранить данные. Проверьте выбранные значения.' });
  } finally { connection.release(); }
});

router.post('/:id/reset-password', async (req, res) => {
  const id = Number(req.params.id);
  if (id === Number(req.user.id)) return res.status(400).json({ error: 'Свой пароль меняйте в профиле' });
  try {
    const [[user]] = await pool.execute('SELECT id FROM users WHERE id=?', [id]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const temporaryPassword = randomBytes(12).toString('base64url');
    const hash = await bcrypt.hash(temporaryPassword, 12);
    await pool.execute('UPDATE users SET password_hash=?,must_change_password=1,token_version=token_version+1 WHERE id=?', [hash,id]);
    await userActivity(req.user.id, id, 'Пароль сброшен администратором', 'Выдан временный пароль; старые сеансы завершены');
    res.set('Cache-Control', 'no-store');
    res.json({ temporaryPassword, mustChangePassword: true });
  } catch { res.status(500).json({ error: 'Не удалось сбросить пароль' }); }
});
module.exports = router;
