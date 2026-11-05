// Keep the existing route result contract while using native PostgreSQL SQL.
// Values always travel separately from SQL; question marks are converted only outside literals/comments.
function parameters(sql, values = []) {
  let output = '', index = 0, position = 0;
  const token = /'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|\?/g;
  for (const match of sql.matchAll(token)) {
    output += sql.slice(position, match.index);
    output += match[0] === '?' ? '$' + (++index) : match[0];
    position = match.index + match[0].length;
  }
  output += sql.slice(position);
  if (index !== values.length) throw new Error('SQL parameter count mismatch');
  return { text: output, values: values.map(value => value === undefined ? null : value) };
}

function resultRows(result) {
  if (['INSERT', 'UPDATE', 'DELETE'].includes(result.command)) {
    return [{ insertId: result.rows[0]?.id, affectedRows: result.rowCount, rows: result.rows }];
  }
  return [result.rows];
}

function wrap(client) {
  async function execute(sql, values = []) {
    const query = parameters(sql, values);
    if (/^\s*INSERT\s/i.test(query.text) && !/\bRETURNING\b/i.test(query.text)) query.text = query.text.replace(/;\s*$/, '') + ' RETURNING *';
    return resultRows(await client.query(query));
  }
  return { execute, query: execute, raw: (text, values) => client.query(text, values),
    beginTransaction: () => client.query('BEGIN'), commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'), release: () => client.release() };
}

module.exports = { parameters, wrap };
