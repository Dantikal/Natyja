const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

function isLocalRequest(req) {
  const loopback = value => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(value);
  return loopback(req.socket?.remoteAddress) && !req.get('x-public-gateway') && !req.get('cf-connecting-ip') &&
    (!req.get('x-forwarded-for') || loopback(req.get('x-forwarded-for'))) &&
    ['localhost', '127.0.0.1', '[::1]'].includes(req.hostname);
}

function createLibrary({ root, extract, interval = 30000, maxFiles = 300, maxBytes = 5 * 1024 * 1024 } = {}) {
  const records = new Map();
  let pending, checkedAt = null, lastCheck = 0, errors = [], skipped = 0, fatal = null;
  async function scan() {
    const found = new Set(), nextErrors = [];
    skipped = 0; fatal = null;
    let count = 0, directories = 0;
    const resolvedRoot = await fs.realpath(root);
    async function walk(directory, depth = 0) {
      if (depth > 16 || ++directories > 1000) { skipped++; return; }
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink() || entry.name.startsWith('~$')) continue;
        const full = path.join(directory, entry.name);
        const real = await fs.realpath(full).catch(() => null);
        if (!real || (!real.startsWith(resolvedRoot + path.sep) && real !== resolvedRoot)) continue;
        if (entry.isDirectory()) { await walk(real, depth + 1); continue; }
        if (!entry.isFile() || !['.txt', '.md', '.docx', '.pdf'].includes(path.extname(entry.name).toLowerCase())) continue;
        if (++count > maxFiles) { skipped++; continue; }
        const name = path.relative(resolvedRoot, real);
        found.add(name);
        try {
          const stat = await fs.stat(real);
          if (stat.size > maxBytes) throw new Error('Файл больше 5 МБ. Разделите документ.');
          const signature = `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
          if (records.get(name)?.signature === signature) continue;
          // Drop stale text before attempting to read a replacement.
          records.delete(name);
          const extension = path.extname(real).toLowerCase();
          const parsed = await extract(await fs.readFile(real), extension === '.md' ? '.txt' : extension);
          const after = await fs.stat(real);
          if (`${after.mtimeMs}:${after.ctimeMs}:${after.size}` !== signature) throw new Error('Файл изменяется. Повторная проверка через 30 секунд.');
          records.set(name, { id: 'folder-' + crypto.createHash('sha256').update(name).digest('hex').slice(0, 24), name, text: parsed.text, limited: !!parsed.truncated, signature });
        } catch (error) { records.delete(name); nextErrors.push({ name, error: error.message }); }
      }
    }
    await walk(resolvedRoot);
    for (const name of records.keys()) if (!found.has(name)) records.delete(name);
    errors = nextErrors;
    checkedAt = new Date().toISOString();
  }
  function refresh(force = false) {
    if (pending) return pending;
    if (!force && Date.now() - lastCheck < interval) return Promise.resolve();
    lastCheck = Date.now();
    pending = scan().catch(() => {
      records.clear(); errors = []; fatal = 'Папка недоступна. Проверьте, что она существует и доступна для чтения.';
      checkedAt = new Date().toISOString();
    }).finally(() => { pending = null; });
    return pending;
  }
  function status() {
    return { enabled: true, localOnly: true, path: root, scanning: !!pending, checkedAt, count: records.size, skipped, error: fatal,
      files: [...records.values()].map(({ id, name, limited }) => ({ id, name, limited })), errors };
  }
  return { refresh, status, documents: () => [...records.values()] };
}

const root = process.env.LOCAL_KNOWLEDGE_DIR || path.join(os.homedir(), 'Desktop', 'ИИ знания');
const library = createLibrary({ root, extract: (...args) => require('./supportAssistant').extract(...args) });
module.exports = { ...library, isLocalRequest, createLibrary };
