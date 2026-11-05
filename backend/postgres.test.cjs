const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parameters, wrap } = require('./src/config/postgres');
test('PostgreSQL binds values without touching quoted question marks or comments', () => {
  const injection = "' OR 1=1 --";
  const query = parameters("SELECT '?' AS literal, \"?\" FROM users /* ? */ WHERE email=? -- ?\nAND id=?", [injection,3]);
  assert.equal(query.text,"SELECT '?' AS literal, \"?\" FROM users /* ? */ WHERE email=$1 -- ?\nAND id=$2");
  assert.deepEqual(query.values,[injection,3]);
  assert.throws(()=>parameters('SELECT ?',[1,2]),/count mismatch/);
});
test('PostgreSQL preserves IDs, affected row counts and transaction connection affinity', async () => {
  const calls=[];
  const client={ query: async query => { calls.push(query); return {command:'INSERT',rows:[{id:7}],rowCount:1}; },release:()=>calls.push('release') };
  const connection=wrap(client);
  const [result]=await connection.execute('INSERT INTO positions(name) VALUES (?)',['name']);
  assert.equal(result.insertId,7);assert.equal(result.affectedRows,1);
  assert.equal(calls[0].text,'INSERT INTO positions(name) VALUES ($1) RETURNING *');
  await connection.beginTransaction();await connection.commit();await connection.rollback();connection.release();
  assert.deepEqual(calls.slice(1),['BEGIN','COMMIT','ROLLBACK','release']);
});
