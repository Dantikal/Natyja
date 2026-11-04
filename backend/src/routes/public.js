const express = require('express');
const pool = require('../config/db');
const router = express.Router();

router.get('/ranks', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, category FROM ranks ORDER BY sort_order, name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/positions', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name FROM positions ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/military-units', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, location FROM military_units ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;