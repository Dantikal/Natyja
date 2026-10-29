const express = require('express');
const cors = require('cors');
const migrate = require('./config/migrate');
const path = require('path');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');
// Only the local gateway is trusted; it replaces client-supplied forwarding headers.
app.set('trust proxy', 'loopback');
app.use('/api', require('./middleware/botProtection').apiLimit);

app.use(cors());
app.use(express.json({ limit: '12mb' }));
// Фото доступны для отображения, но отчёты задач остаются за авторизацией.
app.use('/uploads', (req, res, next) => {
  if (!/^photo-[\w.-]+$/.test(path.basename(req.path))) {
    return res.sendStatus(404);
  }
  next();
}, express.static(path.join(__dirname, '..', 'uploads')));

// Подключение роутов
app.use('/api/auth', require('./routes/auth'));
app.use('/api/soldiers', require('./routes/soldiers'));
app.use('/api/users', require('./routes/users'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dictionaries', require('./routes/dictionaries'));
app.use('/api/public', require('./routes/public'));

// Проверка что сервер жив
app.get('/', (req, res) => res.json({ status: 'OK', message: 'Сервер работает' }));

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Файл не должен превышать 10 МБ' });
  if (err.status && err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: err.message });
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const PORT = process.env.PORT || 5000;
migrate().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Не удалось обновить схему базы данных:', err);
  process.exitCode = 1;
});
