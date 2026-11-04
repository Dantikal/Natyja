const fs = require('node:fs/promises');
const path = require('node:path');
const root = process.env.SUPPORT_DATA_DIR || path.resolve(__dirname, '../../assistant-data/private-documents');
const queues = new Map();
function target(userId) {
  if (!Number.isSafeInteger(Number(userId)) || Number(userId) < 1) throw new Error('INVALID_USER');
  return path.join(root, Number(userId) + '.json');
}
async function read(userId) {
  try { return JSON.parse(await fs.readFile(target(userId), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
function update(userId, operation) {
  const key = target(userId);
  const result = (queues.get(key) || Promise.resolve()).then(async () => {
    await fs.mkdir(root, { recursive: true });
    const records = operation(await read(userId));
    await fs.writeFile(key + '.tmp', JSON.stringify(records), 'utf8');
    await fs.rename(key + '.tmp', key);
    return records;
  });
  const settled = result.catch(() => {});
  queues.set(key, settled);
  settled.finally(() => { if (queues.get(key) === settled) queues.delete(key); });
  return result;
}
async function references(userId) {
  const base = process.env.ASSISTANT_DATA_DIR || path.resolve(__dirname, '../../assistant-data');
  async function list(name) {
    try { return JSON.parse(await fs.readFile(path.join(base, name), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  const shared = await list('knowledge.json');
  const own = (await list('corrections.json')).filter(item => item.userId === userId);
  return [...shared, ...own].filter(item => typeof item.text === 'string').map(item => ({ ...item, name: item.title }));
}
module.exports = { read, update, references };
