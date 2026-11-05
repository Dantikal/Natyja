const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('./db');
module.exports = async function migrate() {
 const connection = await pool.getConnection();
 try {
  await connection.beginTransaction();
  await connection.raw('SELECT pg_advisory_xact_lock(724952105)');
  const schema = await fs.readFile(path.resolve(__dirname, '../../../database/schema.sql'), 'utf8');
  await connection.raw(schema);
  await connection.commit();
 } catch(error) { await connection.rollback(); throw error; }
 finally { connection.release(); }
};
