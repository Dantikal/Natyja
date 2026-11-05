const express = require('express');
const multer = require('multer');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const pool = require('../config/db');
const store = require('../services/supportStore');
const service = require('../services/supportAssistant');
const localKnowledge = require('../services/localKnowledge');
const router = express.Router();
router.use(authenticate);
router.use(rateLimit({ windowMs: 60000, limit: 20, keyGenerator: req => String(req.user.id), message: { error: 'Подождите минуту перед следующим запросом.' } }));
router.use(express.json({ limit: '80kb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } });
const clean = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const meta = ({ text, ...document }) => ({ ...document, characters: text.length });
let busy = false;
let parsing = false;
router.get('/local-knowledge', (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!localKnowledge.isLocalRequest(req)) return res.json({ enabled: false });
  void localKnowledge.refresh();
  res.json(localKnowledge.status());
});
router.post('/local-knowledge/refresh', async (req, res) => {
  if (!localKnowledge.isLocalRequest(req)) return res.sendStatus(403);
  void localKnowledge.refresh(true);
  res.set('Cache-Control', 'no-store').json(localKnowledge.status());
});
async function tasks(user, id) {
  if (!user.soldier_id) return [];
  const parameters = [user.soldier_id];
  let where = "soldier_id=? AND status IN ('новая','в_работе','на_проверке')";
  if (id) { where = 'soldier_id=? AND id=?'; parameters.push(id); }
  const [rows] = await pool.execute(`SELECT id,title,description,status,to_char(due_date,'YYYY-MM-DD') AS due_day FROM tasks WHERE ${where} ORDER BY due_date ASC LIMIT 50`, parameters);
  // This schema stores a DATE, not a time. Its deadline is the end of that day in Bishkek.
  return rows.map(task => ({ ...task, due_date: task.due_day ? `${task.due_day}T23:59:59.999+06:00` : null }));
}
router.get('/tasks', async (req, res, next) => {
  try { res.json({ tasks: await tasks(req.user), serverNow: new Date().toISOString() }); } catch (error) { next(error); }
});
router.get('/documents', async (req, res, next) => {
  try { res.json((await store.read(req.user.id)).map(meta)); } catch (error) { next(error); }
});
router.post('/documents', (req, res, next) => {
  if (parsing) return res.status(429).json({ error: 'Обрабатывается другой файл. Повторите позже.' });
  parsing = true;
  upload.single('file')(req, res, error => { if (error) parsing = false; next(error); });
}, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Выберите файл.' });
    const extension = path.extname(req.file.originalname).toLowerCase();
    if (!['.txt', '.docx', '.pdf', '.jpg', '.jpeg', '.png'].includes(extension)) return res.status(400).json({ error: 'Поддерживаются TXT, DOCX, PDF, JPG и PNG, до 5 МБ.' });
    if ((await store.read(req.user.id)).length >= 10) return res.status(400).json({ error: 'Можно хранить до 10 документов. Удалите ненужные.' });
    const parsed = await service.extract(req.file.buffer, extension);
    const original = req.file.originalname;
    const decoded = /[^\u0000-\u00ff]/.test(original) ? original : Buffer.from(original, 'latin1').toString('utf8');
    const record = { id: randomUUID(), name: path.basename(decoded.includes('\ufffd') ? original : decoded).replace(/[\u0000-\u001f]/g, '').slice(0, 160), text: parsed.text, limited: parsed.truncated, createdAt: new Date().toISOString() };
    await store.update(req.user.id, records => {
      if (records.length >= 10) throw Object.assign(new Error('Удалите ненужные документы.'), { status: 400 });
      return [...records, record];
    });
    res.status(201).json(meta(record));
  } catch (error) { if (!error.status) error.status = 400; next(error); }
  finally { parsing = false; }
});
router.delete('/documents/:id', async (req, res, next) => {
  try { await store.update(req.user.id, records => records.filter(doc => doc.id !== req.params.id)); res.sendStatus(204); } catch (error) { next(error); }
});
router.get('/status', async (req, res) => {
  try { const response = await fetch(service.origin + '/api/tags', { signal: AbortSignal.timeout(3000) }); const data = await response.json(); res.json({ ready: data.models?.some(item => item.name === service.model) || false }); }
  catch { res.json({ ready: false }); }
});
router.post('/chat', async (req, res, next) => {
  const { message, history = [], lang, documentIds = [], taskId, webQuery = '' } = req.body;
  if (!clean(message, 4000) || !Array.isArray(history) || history.length > 6 || history.some(item => !item || !['user','assistant'].includes(item.role) || !clean(item.content, 2400)) ||
      !Array.isArray(documentIds) || documentIds.length > 3 || documentIds.some(id => typeof id !== 'string' || id.length > 50) ||
      (taskId !== undefined && (!Number.isSafeInteger(taskId) || taskId < 1)) || typeof webQuery !== 'string' || webQuery.length > 160) return res.status(400).json({ error: 'Проверьте вопрос, выбранные файлы и задачу.' });
  if (busy) return res.status(429).json({ error: 'Помощник занят. Повторите через минуту.' });
  const useFolder = localKnowledge.isLocalRequest(req);
  if (useFolder && webQuery.trim()) return res.status(400).json({ error: 'Локальный режим: интернет-поиск отключён. Документы обрабатываются только на этом ПК.' });
  busy = true;
  try {
    const ownDocuments = await store.read(req.user.id);
    const selected = documentIds.map(id => ownDocuments.find(doc => doc.id === id));
    if (selected.some(doc => !doc)) return res.status(404).json({ error: 'Документ не найден в вашем аккаунте.' });
    const sources = service.fragments(message, selected);
    if (useFolder) {
      void localKnowledge.refresh();
      sources.unshift(...service.fragments(message, localKnowledge.documents(), true).map(source => ({ ...source, kind: 'local-folder' })));
    }
    sources.push(...service.fragments(message, await store.references(req.user.id), true).slice(0, 1));
    let taskSummary;
    if (taskId) {
      const task = (await tasks(req.user, taskId))[0];
      if (!task) return res.status(404).json({ error: 'В ваших задачах такой задачи нет.' });
      taskSummary = { id: task.id, title: task.title, status: task.status, due_date: task.due_date, serverNow: new Date().toISOString() };
      sources.unshift({ id: 'task-' + task.id, title: 'Моя задача: ' + task.title, kind: 'task', text: `Название: ${task.title}\nОписание: ${String(task.description || '').replace(/<[^>]*>/g,' ').slice(0,4000)}\nСтатус: ${task.status}\nСрок UTC: ${task.due_date ? new Date(task.due_date).toISOString() : 'не указан'}` });
    } else {
      const ownTasks = await tasks(req.user);
      sources.unshift({ id: 'my-active-tasks', title: 'Мои активные задачи на сайте', kind: 'task-list', text: `Получено активных задач: ${ownTasks.length}${ownTasks.length === 50 ? ' (достигнут лимит списка)' : ''}. Ближайшие до 5 задач:\n` + ownTasks.slice(0, 5).map(task => `#${task.id}: ${task.title.slice(0, 90)}; статус ${task.status}; срок ${task.due_date || 'не указан'}`).join('\n') + '\nДля подробного разбора выберите задачу в списке. Срок означает конец указанного дня по Бишкеку.' });
    }
    if (webQuery.trim()) {
      // Only the explicit search terms leave this server; never task/file text or chat history.
      const found = await service.search(webQuery.trim(), lang);
      if (!found.length) return res.status(422).json({ error: 'В Википедии ничего не найдено. Уточните поисковые слова или отключите поиск.' });
      sources.push(...found);
    }
    res.json({ ...await service.answer({ message: message.trim(), history, lang, sources }), ...(taskSummary ? { task: taskSummary } : {}) });
  } catch (error) {
    if (error.message === 'MODEL_NOT_INSTALLED') return res.status(503).json({ error: 'Не найдена локальная модель справочного помощника. Нужна установленная qwen3:4b-instruct.' });
    if (error.message === 'SEARCH_UNAVAILABLE') return res.status(503).json({ error: 'Интернет-поиск сейчас недоступен. Повторите позже или отключите его.' });
    if (['TypeError','TimeoutError','AbortError'].includes(error.name) || error.message === 'MODEL_UNAVAILABLE') return res.status(503).json({ error: 'Не удалось получить ответ. Проверьте подключение и локальную модель.' });
    next(error);
  } finally { busy = false; }
});
router.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Файл должен быть не больше 5 МБ.' });
  if (error instanceof multer.MulterError) return res.status(400).json({ error: 'Загрузите один файл, до 5 МБ.' });
  if (error.status && error.status < 500) return res.status(error.status).json({ error: error.message });
  console.error('Assistant support:', error.name);
  res.status(500).json({ error: 'Не удалось выполнить запрос.' });
});
module.exports = router;
