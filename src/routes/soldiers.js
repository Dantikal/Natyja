const express = require('express');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const uploadPhoto = require('../middleware/uploadPhoto');
const router = express.Router();

const taskPerformanceJoin = `
 LEFT JOIN (
 SELECT soldier_id, SUM(earned) AS earned_points,SUM(penalty) AS penalty_points,
 SUM(done) AS completed_tasks,SUM(late) AS late_tasks,SUM(failed) AS failed_tasks,SUM(overdue) AS overdue_tasks,
 SUM(done+failed+overdue) AS rated_tasks
 FROM (
 SELECT soldier_id,CASE WHEN status='выполнена' THEN 1 ELSE 0 END AS earned,0 AS penalty,
 CASE WHEN status='выполнена' THEN 1 ELSE 0 END AS done,
 CASE WHEN status='выполнена' AND DATE(completed_at)>DATE(due_date) THEN 1 ELSE 0 END AS late,
 CASE WHEN status='провалена' THEN 1 ELSE 0 END AS failed,
 CASE WHEN status IN ('новая','в_работе') AND DATE(due_date)<CURDATE() THEN 1 ELSE 0 END AS overdue,
 COALESCE(approved_at,completed_at,due_date) AS event_date FROM tasks
 UNION ALL
 SELECT t.soldier_id,0,1,0,0,0,0,h.created_at FROM task_history h JOIN tasks t ON t.id=h.task_id WHERE h.action='Отклонено'
 ) events WHERE 1=1 /*RATING_PERIOD*/ GROUP BY soldier_id
 ) task_perf ON task_perf.soldier_id=s.id
`;
const taskPerformanceSelect = `
 CASE WHEN COALESCE(task_perf.rated_tasks,0)>0 OR COALESCE(task_perf.penalty_points,0)>0 THEN COALESCE(task_perf.earned_points,0)-COALESCE(task_perf.penalty_points,0) ELSE NULL END AS task_rating,
 COALESCE(task_perf.earned_points,0) AS earned_points,COALESCE(task_perf.penalty_points,0) AS penalty_points,
 COALESCE(task_perf.rated_tasks,0) AS rated_tasks,COALESCE(task_perf.completed_tasks,0) AS completed_tasks,
 COALESCE(task_perf.late_tasks,0) AS late_tasks,COALESCE(task_perf.failed_tasks,0) AS failed_tasks,COALESCE(task_perf.overdue_tasks,0) AS overdue_tasks
`;

// ========== СПИСОК — зависит от роли ==========
router.get('/', authenticate, async (req, res) => {
  try {
    const { role, soldier_id, unit_id } = req.user;
    if(!['admin','commander'].includes(role))return res.status(403).json({error:'Рейтинг доступен только администратору и командиру своей части'});

    let query = `
      SELECT 
        s.id, s.full_name, s.unit_id, s.position_id, s.years_of_service, s.reprimands,
        s.characteristic, s.photo_url, s.photo_file,
        s.works_percent, s.shifts_percent, s.useful_percent, s.created_at,
        r.name AS rank_name, r.category AS rank_category,
        p.name AS position_name,
        mu.name AS military_unit_name,
        mu.location AS military_unit_location,
        ${taskPerformanceSelect}
      FROM soldiers s
      LEFT JOIN ranks r ON s.rank_id = r.id
      LEFT JOIN positions p ON s.position_id = p.id
      LEFT JOIN military_units mu ON s.unit_id = mu.id
      ${taskPerformanceJoin}
    `;

    let params = [];
    if (req.query.from || req.query.to) {
      const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
      if (!valid(req.query.from) || !valid(req.query.to) || req.query.from > req.query.to) return res.status(400).json({error:'Проверьте период'});
      query=query.replace('/*RATING_PERIOD*/','AND event_date >= ? AND event_date < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(req.query.from,req.query.to);
    }

    // Фильтрация по роли
    if (role === 'admin') {
      // Видят всё — без фильтра
    } else if (role === 'commander' && unit_id) {
      // Видят только свою часть
      query += ' WHERE s.unit_id = ?';
      params.push(unit_id);
    } else if (role === 'user' && soldier_id) {
      // Видят только себя
      query += ' WHERE s.id = ?';
      params.push(soldier_id);
    } else {
      // Нет привязки — пустой результат
      return res.json([]);
    }

    query += ' ORDER BY task_rating DESC, s.full_name';

    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== СВОЙ ПРОФИЛЬ (для user) ==========
router.get('/me', authenticate, async (req, res) => {
  try {
    const { soldier_id } = req.user;
    if (!soldier_id) {
      return res.status(404).json({ error: 'Ваш аккаунт не привязан к военнослужащему' });
    }

    const [rows] = await pool.execute(`
      SELECT 
        s.*,
        r.name AS rank_name, r.category AS rank_category,
        p.name AS position_name,
        mu.name AS military_unit_name,
        mu.location AS military_unit_location,
        ${taskPerformanceSelect}
      FROM soldiers s
      LEFT JOIN ranks r ON s.rank_id = r.id
      LEFT JOIN positions p ON s.position_id = p.id
      LEFT JOIN military_units mu ON s.unit_id = mu.id
      ${taskPerformanceJoin}
      WHERE s.id = ?
    `, [soldier_id]);

    if (!rows.length) return res.status(404).json({ error: 'Профиль не найден' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== ОДИН ПО ID (с проверкой доступа) ==========
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { role, soldier_id, unit_id } = req.user;
    const targetId = req.params.id;

    // Проверка доступа
    if (role === 'user' && String(soldier_id) !== String(targetId)) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const [rows] = await pool.execute(`
      SELECT 
        s.*,
        r.name AS rank_name, r.category AS rank_category,
        p.name AS position_name,
        mu.name AS military_unit_name,
        mu.location AS military_unit_location,
        ${taskPerformanceSelect}
      FROM soldiers s
      LEFT JOIN ranks r ON s.rank_id = r.id
      LEFT JOIN positions p ON s.position_id = p.id
      LEFT JOIN military_units mu ON s.unit_id = mu.id
      ${taskPerformanceJoin}
      WHERE s.id = ?
    `, [targetId]);

    if (!rows.length) return res.status(404).json({ error: 'Не найдено' });

    const soldier = rows[0];

    // Командир — только своя часть
    if (role === 'commander' && soldier.unit_id !== unit_id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    res.json(soldier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== РЕДАКТИРОВАНИЕ СВОИХ ДАННЫХ (user) ==========
router.patch('/me', authenticate, async (req, res) => {
  try {
    const { soldier_id } = req.user;
    if (!soldier_id) {
      return res.status(404).json({ error: 'Аккаунт не привязан' });
    }

    const { fullName } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: 'ФИО обязательно' });
    }

    await pool.execute(
      'UPDATE soldiers SET full_name = ?, photo_url = NULL WHERE id = ?',
      [fullName.trim(), soldier_id]
    );

    res.json({ message: 'Обновлено' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Загрузить фото своего профиля.
router.post('/me/photo', authenticate, uploadPhoto.single('photo'), async (req, res) => {
  if (!req.user.soldier_id) {
    return res.status(404).json({ error: 'Аккаунт не привязан' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Выберите фото' });
  }

  try {
    await pool.execute(
      'UPDATE soldiers SET photo_file = ?, photo_url = NULL WHERE id = ?',
      [req.file.filename, req.user.soldier_id]
    );
    res.json({ photoFile: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Фото военнослужащего может менять только администратор.
router.post('/:id/photo', authenticate, requireAdmin, uploadPhoto.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Выберите фото' });
  }

  try {
    const [result] = await pool.execute(
      'UPDATE soldiers SET photo_file = ?, photo_url = NULL WHERE id = ?',
      [req.file.filename, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Военнослужащий не найден' });
    res.json({ photoFile: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ========== ДОБАВИТЬ (только админ) ==========
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const {
    fullName, rankId, positionId, unitId,
    yearsOfService = 0, reprimands = 0,
    characteristic = '', photoUrl = '',
    worksPercent = 0, shiftsPercent = 0
  } = req.body;

  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ error: 'ФИО обязательно' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO soldiers 
        (full_name, rank_id, position_id, unit_id, years_of_service, reprimands, 
         characteristic, photo_url, works_percent, shifts_percent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fullName.trim(),
        rankId || null, positionId || null, unitId || null,
        yearsOfService, reprimands, characteristic,
        photoUrl || null, worksPercent, shiftsPercent
      ]
    );
    res.status(201).json({ id: result.insertId, message: 'Добавлено' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== РЕДАКТИРОВАТЬ ЛЮБОГО (только админ) ==========
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const {
    fullName, rankId, positionId, unitId,
    yearsOfService, reprimands, characteristic,
    photoUrl, worksPercent, shiftsPercent
  } = req.body;

  try {
    await pool.execute(
      `UPDATE soldiers SET 
        full_name = ?, rank_id = ?, position_id = ?, unit_id = ?,
        years_of_service = ?, reprimands = ?, characteristic = ?,
        photo_url = ?, works_percent = ?, shifts_percent = ?
       WHERE id = ?`,
      [
        fullName, rankId || null, positionId || null, unitId || null,
        yearsOfService, reprimands, characteristic,
        photoUrl || null, worksPercent, shiftsPercent,
        req.params.id
      ]
    );
    res.json({ message: 'Обновлено' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== УДАЛИТЬ (только админ) ==========
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const [[archive]]=await pool.execute('SELECT COUNT(*) AS total FROM report_versions v JOIN tasks t ON t.id=v.task_id WHERE t.soldier_id=?',[req.params.id]);
    if(archive.total)return res.status(409).json({error:'Личная карточка содержит архив отчётов и не может быть удалена'});
    await pool.execute('DELETE FROM soldiers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
