// One-time, transactional copy into an EMPTY PostgreSQL database. Never uploads data.
const fs = require('node:fs/promises');
const path = require('node:path');
const mysql = require('mysql2/promise'); // migration-only dev dependency
const { Client } = require('pg');
const dotenv = require('dotenv');
const tables = ['ranks','positions','military_units','units','soldiers','users','tasks','task_history','task_notification_reads','task_transfers','report_versions','report_ai_assessments','ideas','user_activity'];
async function main() {
  if (!process.env.MYSQL_ENV_FILE || !process.env.DATABASE_URL) throw new Error('Set MYSQL_ENV_FILE to the old private .env path and DATABASE_URL to the new PostgreSQL database.');
  const sourceConfig = dotenv.parse(await fs.readFile(path.resolve(process.env.MYSQL_ENV_FILE)));
  const source = await mysql.createConnection({host:sourceConfig.DB_HOST,port:Number(sourceConfig.DB_PORT||3306),user:sourceConfig.DB_USER,password:sourceConfig.DB_PASSWORD,database:sourceConfig.DB_NAME,dateStrings:true});
  const target = new Client({connectionString:process.env.DATABASE_URL});
  try {
    await source.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await source.beginTransaction();
    const [[clock]] = await source.query('SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW()) AS offset_minutes');
    const offset = Number(clock.offset_minutes), sign = offset < 0 ? '-' : '+';
    const zone = sign + String(Math.floor(Math.abs(offset)/60)).padStart(2,'0') + ':' + String(Math.abs(offset)%60).padStart(2,'0');
    await target.connect();
    await target.query('BEGIN');
    await target.query("SET LOCAL TIME ZONE 'Asia/Bishkek'");
    await target.query('SELECT pg_advisory_xact_lock(724952105)');
    await target.query(await fs.readFile(path.resolve(__dirname,'../..','database/schema.sql'),'utf8'));
    for (const table of tables) {
      const result = await target.query(`SELECT COUNT(*) AS count FROM ${table}`);
      if (Number(result.rows[0].count)) throw new Error('Target must be empty; existing data was not changed.');
    }
    await target.query('SET CONSTRAINTS ALL DEFERRED');
    for (const table of tables) {
      const columns = await target.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER' ORDER BY ordinal_position",[table]);
      const [rows] = await source.query('SELECT * FROM `' + table + '`');
      for (const row of rows) {
        const selected = columns.rows.filter(column => Object.hasOwn(row,column.column_name));
        const values = selected.map(column => {
          const value = row[column.column_name];
          if (value === null) return null;
          if (column.data_type === 'timestamp with time zone' && typeof value === 'string') return value.replace(' ','T') + zone;
          if (column.data_type === 'jsonb' && typeof value !== 'string') return JSON.stringify(value);
          return value;
        });
        await target.query(`INSERT INTO ${table} (${selected.map(c=>c.column_name).join(',')}) VALUES (${values.map((_,i)=>'$'+(i+1)).join(',')})`, values);
      }
      if (columns.rows.some(column => column.column_name === 'id')) await target.query(`SELECT setval(pg_get_serial_sequence('${table}','id'),GREATEST(COALESCE((SELECT MAX(id) FROM ${table}),0),1),(SELECT COUNT(*)>0 FROM ${table}))`);
      const check = await target.query(`SELECT COUNT(*) AS count FROM ${table}`);
      if (Number(check.rows[0].count) !== rows.length) throw new Error('Row count mismatch');
      console.log(table + ': ' + rows.length + ' rows verified');
    }
    await target.query('COMMIT');
    await source.commit();
    console.log('Migration committed. Original MySQL data was not changed.');
  } catch(error) {
    await target.query('ROLLBACK').catch(()=>{}); await source.rollback().catch(()=>{}); throw error;
  } finally { await source.end(); await target.end(); }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode=1; });
