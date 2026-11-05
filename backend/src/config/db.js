const { Pool, types } = require('pg');
require('dotenv').config();
const { wrap } = require('./postgres');
// Preserve DATE calendar strings and numeric API values, independently of the host timezone.
types.setTypeParser(1082, value => value);
types.setTypeParser(20, value => { const number=Number(value); if(!Number.isSafeInteger(number))throw new Error('Database integer outside safe range'); return number; });
types.setTypeParser(1700, value => Number(value));
const pool = new Pool({
  ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||5432),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME}),
  max:20, connectionTimeoutMillis:10000,
  options:'-c timezone=Asia/Bishkek',
});
pool.on('error', error => console.error('PostgreSQL pool:', error.code || error.name));
module.exports = { ...wrap(pool), getConnection: async () => wrap(await pool.connect()), end: () => pool.end() };
