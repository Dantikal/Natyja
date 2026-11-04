const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const { authenticate, requireAdmin } = require('../middleware/auth');
const service = require('../services/assistant');
router.use(authenticate);
router.use(rateLimit({ windowMs: 60000, limit: 15, keyGenerator: req => String(req.user.id), message: { error: 'Слишком много запросов. Подождите минуту.' } }));
let busy = false;
const clean = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
router.get('/status', async (req, res) => {
  try {
    const response = await fetch(service.origin + '/api/tags', { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error('UNAVAILABLE');
    const data = await response.json();
    res.json({ ready: data.models?.some(item => item.name === service.model || item.model === service.model) || false, model: service.model, local: true });
  } catch { res.json({ ready: false, model: service.model, local: true }); }
});
router.post('/chat', async (req, res, next) => {
  const { message, history = [], lang } = req.body;
  if (!clean(message, 4000) || !Array.isArray(history) || history.length > 8 || history.some(item => !item || !['user', 'assistant'].includes(item.role) || !clean(item.content, 5000)) || history.reduce((sum, item) => sum + item.content.length, 0) > 16000) {
    return res.status(400).json({ error: 'Сократите сообщение или очистите историю.' });
  }
  if (busy) return res.status(429).json({ error: 'Помощник занят. Повторите через минуту.' });
  busy = true;
  try { res.json(await service.chat(req.user.id, message.trim(), history, lang)); }
  catch (error) {
    if (error.message === 'LOW_QUALITY_RESPONSE') return res.status(503).json({ error: lang === 'ky' ? 'Модель түшүнүктүү жооп бере алган жок. Суроону кыскартыңыз же орусча сурап көрүңүз.' : 'Модель не смогла составить связный ответ. Сократите вопрос или попробуйте на русском.' });
    if (['TypeError', 'TimeoutError', 'AbortError'].includes(error.name) || ['MODEL_UNAVAILABLE', 'EMPTY_RESPONSE'].includes(error.message)) return res.status(503).json({ error: 'Локальная модель недоступна или отвечает слишком долго. Проверьте Ollama.' });
    next(error);
  } finally { busy = false; }
});
router.post('/corrections', async (req, res, next) => {
  const { question, answer } = req.body;
  if (!clean(question, 2000) || !clean(answer, 4000)) return res.status(400).json({ error: 'Укажите вопрос и правильный ответ.' });
  try {
    const id = service.newId();
    await service.update('corrections.json', records => [...records.filter(item => item.userId !== req.user.id),
      ...records.filter(item => item.userId === req.user.id).slice(-49),
      { id, userId: req.user.id, title: 'Личное исправление / Жеке оңдоо', text: `Вопрос: ${question}\nИсправленный ответ: ${answer}`, createdAt: new Date().toISOString() }]);
    res.status(201).json({ id });
  } catch (error) { next(error); }
});
router.delete('/corrections', async (req, res, next) => {
  try { await service.update('corrections.json', records => records.filter(item => item.userId !== req.user.id)); res.sendStatus(204); }
  catch (error) { next(error); }
});
router.get('/knowledge', requireAdmin, async (req, res, next) => {
  try { res.json(await service.read('knowledge.json')); } catch (error) { next(error); }
});
router.post('/knowledge', requireAdmin, async (req, res, next) => {
  const { title, text } = req.body;
  if (!clean(title, 160) || !clean(text, 40000)) return res.status(400).json({ error: 'Название до 160 знаков, текст до 40 000 знаков.' });
  try {
    const id = service.newId();
    await service.update('knowledge.json', records => {
      if (records.length >= 100) { const error = new Error('База заполнена. Удалите старый документ.'); error.status = 400; throw error; }
      return [...records, { id, title: title.trim(), text: text.trim(), createdAt: new Date().toISOString() }];
    });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});
router.delete('/knowledge/:id', requireAdmin, async (req, res, next) => {
  try { await service.update('knowledge.json', records => records.filter(item => item.id !== req.params.id)); res.sendStatus(204); }
  catch (error) { next(error); }
});
module.exports = router;
