const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const taskAttachment = require('../middleware/taskAttachment');
const { randomUUID } = require('crypto');
const router = express.Router();

async function scopedTask(req, res, next) {
  try {
    const [rows] = await pool.execute(`SELECT t.*, s.unit_id AS task_unit_id FROM tasks t
      LEFT JOIN soldiers s ON s.id = t.soldier_id WHERE t.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Задача не найдена' });
    const task = rows[0]; const user = req.user;
    const owner = Number(task.soldier_id) === Number(user.soldier_id);
    const manager = user.role === 'commander' && user.unit_id && Number(task.task_unit_id) === Number(user.unit_id);
    if (user.role !== 'admin' && !owner && !manager) return res.status(403).json({ error: 'Нет доступа' });
    req.task = task; next();
  } catch (err) { next(err); }
}
// Every task detail, report, history, and attachment uses the same access boundary.
router.use('/:id/history', authenticate, scopedTask);
router.use('/:id/report', authenticate, scopedTask);
router.use('/:id/submit', authenticate, scopedTask);
router.use('/:id/approve', authenticate, scopedTask);
router.use('/:id/reject', authenticate, scopedTask);
router.use('/:id/status', authenticate, scopedTask);
router.use('/:id/download', authenticate, scopedTask);
router.use('/:id/upload-file', authenticate, scopedTask, (req, res, next) => {
  if (Number(req.user.soldier_id) !== Number(req.task.soldier_id)) return res.status(403).json({ error: 'Файл загружает только исполнитель' });
  if (['на_проверке', 'выполнена', 'провалена'].includes(req.task.status)) return res.status(403).json({ error: 'Отчёт заблокирован' });
  next();
});

function getCurrentWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

async function logAction(taskId, userId, action, details = null) {
  try {
    await pool.execute(
      'INSERT INTO task_history (task_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [taskId, userId, action, details]
    );
  } catch (err) {
    console.error('History log error:', err);
  }
}

// СПИСОК ЗАДАЧ
router.get('/', authenticate, async (req, res) => {
  const { role, unit_id } = req.user;
  if (role !== 'admin' && role !== 'commander') {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  try {
    let query = `
      SELECT t.*, s.full_name AS soldier_name, s.photo_url AS soldier_photo,
        s.photo_file AS soldier_photo_file, r.name AS rank_name, u.name AS unit_name,
        approver.full_name AS approver_name
      FROM tasks t
      LEFT JOIN soldiers s ON t.soldier_id = s.id
      LEFT JOIN ranks r ON s.rank_id = r.id
      LEFT JOIN military_units u ON s.unit_id = u.id
      LEFT JOIN users approver ON t.approved_by = approver.id
    `;
    const params = [];

    if (role === 'commander') {
      query += ' WHERE (s.unit_id = ? OR t.soldier_id = ?)';
      params.push(unit_id || null, req.user.soldier_id || null);
    }

    query += ' ORDER BY t.due_date DESC, t.created_at DESC';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// МОИ ЗАДАЧИ
router.get('/notifications',authenticate,async(req,res,next)=>{try{
 const [rows]=await pool.execute(`SELECT t.id,t.title FROM tasks t WHERE t.soldier_id=? AND t.status='новая' AND NOT EXISTS (SELECT 1 FROM task_notification_reads n WHERE n.user_id=? AND n.task_id=t.id) ORDER BY t.id DESC`,[req.user.soldier_id||0,req.user.id]);res.json(rows);
}catch(e){next(e);}});
router.post('/notifications/read',authenticate,async(req,res,next)=>{try{
 const ids=req.body.ids;if(!Array.isArray(ids)||ids.length>500||!ids.every(Number.isInteger))return res.sendStatus(400);
 if(ids.length)await pool.query('INSERT IGNORE INTO task_notification_reads (user_id,task_id) SELECT ?,id FROM tasks WHERE soldier_id=? AND id IN (?)',[req.user.id,req.user.soldier_id||0,ids]);res.json({ok:true});
}catch(e){next(e);}});
router.get('/my', authenticate, async (req, res) => {
  try {
    const { soldier_id } = req.user;
    if (!soldier_id) return res.json([]);

    const [rows] = await pool.execute(`
      SELECT t.*, t.parent_task_id, s.full_name AS soldier_name, r.name AS rank_name,
        approver.full_name AS approver_name
      FROM tasks t
      LEFT JOIN soldiers s ON t.soldier_id = s.id
      LEFT JOIN ranks r ON s.rank_id = r.id
      LEFT JOIN users approver ON t.approved_by = approver.id
      WHERE t.soldier_id = ?
      ORDER BY t.due_date DESC, t.created_at DESC
    `, [soldier_id]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// СТАТИСТИКА
router.get('/stats/:soldierId', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'выполнена' AND approved_at IS NOT NULL AND approved_at <= due_date THEN 1 ELSE 0 END) AS done_on_time,
        SUM(CASE WHEN status = 'выполнена' AND approved_at IS NOT NULL AND approved_at > due_date THEN 1 ELSE 0 END) AS done_late,
        SUM(CASE WHEN status = 'провалена' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status IN ('новая', 'в_работе', 'на_проверке') THEN 1 ELSE 0 END) AS in_progress
      FROM tasks WHERE soldier_id = ?
    `, [req.params.soldierId]);

    const s = rows[0];
    const total = s.total || 0;
    const [[penalties]]=await pool.execute("SELECT COUNT(*) AS total FROM task_history h JOIN tasks t ON t.id=h.task_id WHERE t.soldier_id=? AND h.action='Отклонено'",[req.params.soldierId]);
    const rating = Number(s.done_on_time||0)+Number(s.done_late||0)-Number(penalties.total);

    res.json({
      total, doneOnTime: s.done_on_time || 0, doneLate: s.done_late || 0,
      failed: s.failed || 0, inProgress: s.in_progress || 0,
      taskRating: rating, earnedPoints:Number(s.done_on_time||0)+Number(s.done_late||0), penaltyPoints:Number(penalties.total),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ИСТОРИЯ
router.get('/:id/history', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT h.*, u.full_name AS user_name, u.role AS user_role
      FROM task_history h LEFT JOIN users u ON h.user_id = u.id
      WHERE h.task_id = ? ORDER BY h.created_at ASC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// СОЗДАТЬ ЗАДАЧУ
router.post('/', authenticate, (req, res, next) => {
  if (!['admin', 'commander'].includes(req.user.role)) return res.status(403).json({ error: 'Нет доступа' });
  next();
}, taskAttachment, async (req, res) => {
  const { role, unit_id, id: userId } = req.user;
  if (role !== 'admin' && role !== 'commander') {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  const { soldierId, title, description, priority, classification, dueDate, parentTaskId } = req.body;
  if (!soldierId || !title || !dueDate) {
    return res.status(400).json({ error: 'Укажите военнослужащего, название и срок' });
  }

  let newFilePath;
  try {
    if (!['обычная', 'важная', 'срочная'].includes(priority || 'обычная') || !['открыто', 'ДСП', 'секретно'].includes(classification || 'открыто')) return res.status(400).json({ error: 'Неверный приоритет или гриф' });
    if (typeof title !== 'string' || !title.trim() || title.length > 255 || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate))) return res.status(400).json({ error: 'Проверьте название и срок' });
    let parentTask;
    if (parentTaskId) {
      const [parents] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [parentTaskId]);
      if (role !== 'commander' || !parents.length || Number(parents[0].soldier_id) !== Number(req.user.soldier_id) || ['выполнена', 'провалена'].includes(parents[0].status)) return res.status(403).json({ error: 'Можно делегировать только свою активную задачу' });
      if (Number(soldierId) === Number(req.user.soldier_id)) return res.status(400).json({ error: 'Выберите подчинённого' });
      if (dueDate > new Date(parents[0].due_date.getTime() - parents[0].due_date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)) return res.status(400).json({ error: 'Срок подзадачи не может быть позже основной задачи' });
      parentTask = parents[0];
    }
    if (role === 'admin') {
      const [cmdrRows] = await pool.execute(
        "SELECT id FROM users WHERE soldier_id = ? AND role = 'commander' AND approved = 1",
        [soldierId]
      );
      if (!cmdrRows.length) {
        return res.status(403).json({ error: 'Администратор может ставить задачи только командирам' });
      }
    } else if (role === 'commander') {
      const [checkRows] = await pool.execute('SELECT unit_id FROM soldiers WHERE id = ?', [soldierId]);
      if (!unit_id || !checkRows.length || Number(checkRows[0].unit_id) !== Number(unit_id)) {
        return res.status(403).json({ error: 'Только своей части' });
      }
    }

    const weekStart = getCurrentWeekStart();
    let taskFile = parentTask?.task_file || null;
    let taskFileName = parentTask?.task_file_name || null;
    let taskFileType = parentTask?.task_file_type || null;
    if (req.file) {
      taskFile = `instruction-${randomUUID()}${path.extname(req.file.originalname).toLowerCase()}`;
      const rawName = Buffer.from(req.file.originalname, 'latin1');
      const decoded = rawName.toString('utf8');
      const originalName = Buffer.from(decoded, 'utf8').equals(rawName) ? decoded : req.file.originalname;
      taskFileName = originalName.replace(/[\\/\u0000-\u001f\u007f]/g, '_').slice(0, 255);
      taskFileType = req.file.mimetype;
      newFilePath = path.join(__dirname, '..', '..', 'uploads', taskFile);
      await fs.promises.writeFile(newFilePath, req.file.buffer, { flag: 'wx' });
    }
    const [result] = await pool.execute(`
      INSERT INTO tasks (soldier_id, title, description, priority, classification, week_start, due_date, status, parent_task_id, created_by, assignment_stage, task_file, task_file_name, task_file_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'новая', ?, ?, ?, ?, ?, ?)
    `, [soldierId, title.trim(), description || '', priority || 'обычная', classification || 'открыто', weekStart, dueDate, parentTaskId || null, userId, role === 'admin' ? 'commander' : 'executor', taskFile, taskFileName, taskFileType]);

    await logAction(result.insertId, userId, 'Создана', `Задача "${title}"`);
    res.status(201).json({ id: result.insertId, message: 'Создано' });
  } catch (err) {
    if (newFilePath) await fs.promises.unlink(newFilePath).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// СОХРАНИТЬ ОТЧЁТ
router.get('/:id/attachment', authenticate, scopedTask, async (req, res, next) => {
  if (!req.task.task_file) return res.status(404).json({ error: 'Файл не найден' });
  const filePath = path.join(__dirname, '..', '..', 'uploads', path.basename(req.task.task_file));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Файл отсутствует на сервере' });
  res.download(filePath, req.task.task_file_name || req.task.task_file, (err) => { if (err) next(err); });
});

router.patch('/:id/report', authenticate, async (req, res) => {
  const taskId = req.params.id;
  const { reportType, reportHtml, reportTable, reportNote } = req.body;
  const { role, soldier_id, id: userId } = req.user;

  try {
    const [taskRows] = await pool.execute('SELECT soldier_id, status FROM tasks WHERE id = ?', [taskId]);
    if (!taskRows.length) return res.status(404).json({ error: 'Не найдено' });
    if (role !== 'admin' && soldier_id !== taskRows[0].soldier_id) return res.status(403).json({ error: 'Нет доступа' });
    if (!['text', 'table'].includes(reportType)) return res.status(400).json({ error: 'Выберите тип отчёта' });
    if (taskRows[0].status === 'провалена') return res.status(403).json({ error: 'Задача завершена' });
    if (taskRows[0].status === 'на_проверке') return res.status(403).json({ error: 'Задача на проверке — нельзя изменить' });
    if (taskRows[0].status === 'выполнена') return res.status(403).json({ error: 'Задача уже принята — нельзя изменить' });

    await pool.execute(`
      UPDATE tasks SET report_type = ?, report_html = ?, report_table_json = ?, report_note = ? WHERE id = ?
    `, [reportType || null, reportHtml || null, reportTable ? JSON.stringify(reportTable) : null, reportNote || null, taskId]);

    await logAction(taskId, userId, 'Отчёт сохранён', reportType === 'text' ? 'Текстовый' : 'Таблица');
    res.json({ message: 'Отчёт сохранён' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(require('./taskReview'));

// ПРОВАЛЕНА
router.patch('/:id/status', authenticate, async (req, res) => {
  const { status, reportComment } = req.body;
  if (!['провалена'].includes(status)) return res.status(400).json({ error: 'Неверный статус' });

  try {
    const taskId = req.params.id;
    const { role, soldier_id, id: userId } = req.user;

    const [taskRows] = await pool.execute('SELECT soldier_id, status FROM tasks WHERE id = ?', [taskId]);
    if (!taskRows.length) return res.status(404).json({ error: 'Не найдено' });
    if (role !== 'admin' && soldier_id !== taskRows[0].soldier_id) return res.status(403).json({ error: 'Нет доступа' });
    if (taskRows[0].status === 'на_проверке' || taskRows[0].status === 'выполнена') return res.status(403).json({ error: 'Нельзя изменить' });

    await pool.execute('UPDATE tasks SET status = ?, report_comment = ? WHERE id = ?', [status, reportComment || null, taskId]);
    await logAction(taskId, userId, 'Провалена', reportComment || '');
    res.json({ message: 'Обновлено' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// УДАЛИТЬ
router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только админ' });
  try {
    const [[archive]] = await pool.execute('SELECT COUNT(*) AS total FROM report_versions WHERE task_id=?',[req.params.id]);
    if (archive.total) return res.status(409).json({error:'Задача содержит архив отчётов и не может быть удалена'});
    const [rows] = await pool.execute('SELECT report_file, task_file FROM tasks WHERE id = ?', [req.params.id]);
    await pool.execute('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    if (rows[0]?.report_file) await fs.promises.unlink(path.join(__dirname, '..', '..', 'uploads', path.basename(rows[0].report_file))).catch(() => {});
    if (rows[0]?.task_file) {
      const [references] = await pool.execute('SELECT id FROM tasks WHERE task_file = ? LIMIT 1', [rows[0].task_file]);
      if (!references.length) await fs.promises.unlink(path.join(__dirname, '..', '..', 'uploads', path.basename(rows[0].task_file))).catch(() => {});
    }
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ЗАГРУЗИТЬ ФАЙЛ
router.post('/:id/upload-file', authenticate, upload.single('file'), async (req, res) => {
  const taskId = req.params.id;
  const { role, soldier_id } = req.user;

  try {
    const [taskRows] = await pool.execute('SELECT soldier_id, status FROM tasks WHERE id = ?', [taskId]);
    if (!taskRows.length) return res.status(404).json({ error: 'Не найдено' });
    if (role !== 'admin' && soldier_id !== taskRows[0].soldier_id) return res.status(403).json({ error: 'Нет доступа' });
    if (taskRows[0].status === 'на_проверке' || taskRows[0].status === 'выполнена') return res.status(403).json({ error: 'Отчёт заблокирован' });
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

    await pool.execute('UPDATE tasks SET report_file = ?, report_file_type = ? WHERE id = ?', [req.file.filename, req.file.mimetype, taskId]);
    res.json({ message: 'Файл загружен', filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// СКАЧАТЬ ФАЙЛ
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT report_file FROM tasks WHERE id = ?', [req.params.id]);
    if (!rows.length || !rows[0].report_file) return res.status(404).json({ error: 'Файл не найден' });
    const filePath = path.join(__dirname, '..', '..', 'uploads', rows[0].report_file);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Файл отсутствует на сервере' });
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
