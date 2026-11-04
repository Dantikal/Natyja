const express = require('express');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// ============ ЗВАНИЯ ============
router.get('/ranks', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM ranks ORDER BY sort_order, name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/ranks', authenticate, requireAdmin, async (req, res) => {
  const { name, category = 'гражданский', sortOrder = 999 } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Введите название' });
  try {
    const [r] = await pool.execute(
      'INSERT INTO ranks (name, category, sort_order) VALUES (?, ?, ?)',
      [name.trim(), category, sortOrder]
    );
    res.status(201).json({ id: r.insertId, name: name.trim(), category, sort_order: sortOrder });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Уже есть' });
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.delete('/ranks/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM ranks WHERE id = ?', [req.params.id]);
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ============ ПОДРАЗДЕЛЕНИЯ ============
router.get('/units', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM units ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/units', authenticate, requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Введите название' });
  try {
    const [r] = await pool.execute('INSERT INTO units (name) VALUES (?)', [name.trim()]);
    res.status(201).json({ id: r.insertId, name: name.trim() });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Уже есть' });
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.delete('/units/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM units WHERE id = ?', [req.params.id]);
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ============ ДОЛЖНОСТИ ============
router.get('/positions', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM positions ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/positions', authenticate, requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Введите название' });
  try {
    const [r] = await pool.execute('INSERT INTO positions (name) VALUES (?)', [name.trim()]);
    res.status(201).json({ id: r.insertId, name: name.trim() });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Уже есть' });
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.delete('/positions/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM positions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ============ ВОЙСКОВЫЕ ЧАСТИ ============
router.get('/military-units', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM military_units ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/military-units', authenticate, requireAdmin, async (req, res) => {
  const { name, location = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Введите название' });
  try {
    const [r] = await pool.execute(
      'INSERT INTO military_units (name, location) VALUES (?, ?)',
      [name.trim(), location.trim()]
    );
    res.status(201).json({ id: r.insertId, name: name.trim(), location: location.trim() });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Уже есть' });
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.delete('/military-units/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM military_units WHERE id = ?', [req.params.id]);
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;