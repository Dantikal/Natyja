const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

test('PostgreSQL: registration, access boundaries, review transactions, ratings and password revocation', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async () => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert(url.pathname.endsWith('_test'), 'Integration tests require an isolated *_test database');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET = require('node:crypto').randomBytes(48).toString('hex');
  const pool = require('./src/config/db');
  const migrate = require('./src/config/migrate');
  const express = require('express');
  const bcrypt = require('bcrypt');
  const app = express(); app.use(express.json());
  const pass = (req, res, next) => next();
  const { createAuthRouter } = require('./src/routes/auth');
  app.use('/api/auth', createAuthRouter({ loginLimit: pass, registerLimit: pass, captchaLimit: pass, verify: () => pass, issue: pass }));
  require('./src/services/ideaReview').tick = async () => {};
  for (const name of ['users','tasks','ideas','reports','soldiers','rating','reportAssessments','dictionaries','assistantSupport']) {
    const route = { reportAssessments: 'report-assessments', assistantSupport: 'assistant-support' }[name] || name;
    app.use('/api/' + route, require('./src/routes/' + name));
  }
  app.use((error, req, res, next) => { console.error('Integration API error:', error.code, error.message); res.status(500).json({ error: error.code || error.message }); });
  let server, uploaded;
  try {
    await migrate(); await migrate();
    const tables = ['ideas','military_units','positions','ranks','report_ai_assessments','report_versions','soldiers','task_history','task_notification_reads','task_transfers','tasks','units','user_activity','users'];
    await pool.raw('TRUNCATE ' + tables.join(',') + ' RESTART IDENTITY CASCADE');
    const hash = await bcrypt.hash('Fixture123!', 4);
    const [admin] = await pool.execute("INSERT INTO users(email,password_hash,full_name,role,approved) VALUES (?,?,?,'admin',1)", ['admin@example.invalid',hash,'Test Admin']);
    assert.equal(admin.insertId, 1);
    await assert.rejects(pool.execute("INSERT INTO users(email,password_hash,full_name) VALUES (?,?,?)", ['admin@example.invalid',hash,'Duplicate']), error => error.code === '23505');
    const connection = await pool.getConnection();
    try { await connection.beginTransaction(); await connection.execute('INSERT INTO positions(name) VALUES (?)',['Rolled back']); await connection.rollback(); } finally { connection.release(); }
    assert.equal((await pool.execute('SELECT * FROM positions WHERE name=?',['Rolled back']))[0].length, 0);
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port + '/api';
    async function request(endpoint, token, method = 'GET', body, expected = 200) {
      const response = await fetch(base + endpoint, { method, headers: { ...(token ? { Authorization:'Bearer ' + token } : {}), ...(body && !(body instanceof FormData) ? {'Content-Type':'application/json'} : {}) }, body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined });
      const text = await response.text();
      assert.equal(response.status, expected, endpoint + ': ' + text);
      return text ? JSON.parse(text) : null;
    }
    const login = email => request('/auth/login', null, 'POST', { email,password:'Fixture123!' });
    const adminSession = await login('admin@example.invalid');
    const form = new FormData();
    for (const [key,value] of Object.entries({email:'commander@example.invalid',password:'Fixture123!',fullName:'Test Commander',requestedRole:'commander',customRank:'Test Rank',customPosition:'Test Position',customUnit:'Test Unit'})) form.set(key,value);
    const photo = await require('sharp')({create:{width:10,height:10,channels:3,background:'white'}}).png().toBuffer();
    form.set('photo',new Blob([photo],{type:'image/png'}),'fixture.png');
    await request('/auth/register',null,'POST',form,201);
    const [[pending]] = await pool.execute('SELECT * FROM users WHERE email=?',['commander@example.invalid']); uploaded = pending.photo_file;
    await request('/auth/login',null,'POST',{email:pending.email,password:'Fixture123!'},403);
    await request('/users/'+pending.id+'/approve',adminSession.token,'PATCH',{role:'commander'});
    const commander = await login(pending.email);
    const task = await request('/tasks',adminSession.token,'POST',{soldierId:commander.soldierId,title:'PostgreSQL task',description:'Test assignment',dueDate:'2026-12-31'},201);
    const delegated = await request('/tasks',commander.token,'POST',{soldierId:commander.soldierId,title:'Independent task',dueDate:'2026-12-31'},201);
    const myTasks = await request('/tasks/my',commander.token);
    assert.equal(myTasks.find(item=>item.id===task.id).due_date,'2026-12-31');
    const [troop] = await pool.execute('INSERT INTO soldiers(full_name,unit_id) VALUES (?,?)',['Test subordinate',commander.unitId]);
    await request('/tasks',commander.token,'POST',{soldierId:troop.insertId,title:'Delegated PostgreSQL task',dueDate:'2026-12-30',parentTaskId:task.id},201);
    await request('/tasks',commander.token,'POST',{soldierId:troop.insertId,title:'Invalid late delegation',dueDate:'2027-01-01',parentTaskId:task.id},400);
    const [outsider] = await pool.execute("INSERT INTO users(email,password_hash,full_name,role,approved,soldier_id,unit_id) VALUES (?,?,?,'user',1,?,?)",['outsider@example.invalid',hash,'Other account',troop.insertId,commander.unitId]);
    const other = await login('outsider@example.invalid');
    await request('/tasks/'+task.id+'/history',other.token,'GET',undefined,403);
    await request('/users',other.token,'GET',undefined,403);
    await request('/tasks/notifications/read',commander.token,'POST',{ids:[task.id,delegated.id]});
    await request('/tasks/notifications/read',commander.token,'POST',{ids:[task.id]});
    await request('/tasks/'+task.id+'/report',commander.token,'PATCH',{reportType:'text',reportHtml:'<p>Completed PostgreSQL report.</p>',reportTable:null});
    await request('/tasks/'+task.id+'/submit',commander.token,'PATCH',{});
    await request('/report-assessments/task/'+task.id+'/analyze',commander.token,'POST',{});
    const [[assessment]] = await pool.execute('SELECT id FROM report_ai_assessments WHERE task_id=?',[task.id]);
    await pool.execute("UPDATE report_ai_assessments SET state='ready',points=5,analysis=? WHERE id=?",[JSON.stringify({summary:'Test'}),assessment.id]);
    await request('/report-assessments/'+assessment.id+'/appeal',commander.token,'POST',{text:'Please review this fixture assessment.'});
    await request('/tasks/'+task.id+'/approve',adminSession.token,'PATCH',{qualityPoints:5});
    const reports = await request('/reports?year=2026',commander.token); assert(reports.length);
    await request('/reports/'+reports[0].id,commander.token);
    const idea = await request('/ideas',commander.token,'POST',{title:'PostgreSQL test idea',description:'Improve the registration workflow using a clear checklist for all operators.'},201);
    await request('/ideas',commander.token); await request('/ideas/'+idea.id+'/review',adminSession.token,'PATCH',{decision:'approved',comment:'Fixture approved'});
    await request('/ideas/'+idea.id+'/review',adminSession.token,'PATCH',{decision:'approved',comment:'Duplicate approval'},409);
    await request('/soldiers?from=2026-01-01&to=2026-12-31',adminSession.token);
    await request('/tasks/stats/'+commander.soldierId,commander.token);
    const rating = await request('/rating/my',commander.token); assert(rating.periods.every(item=>Number.isFinite(item.total)));
    await request('/assistant-support/tasks',commander.token);
    await request('/users/'+commander.id,adminSession.token);
    await request('/users/'+commander.id,adminSession.token,'PATCH',{fullName:'Updated Commander',email:pending.email,rankId:pending.rank_id,positionId:pending.position_id,unitId:commander.unitId});
    await request('/auth/change-password',commander.token,'POST',{currentPassword:'Fixture123!',newPassword:'Changed123!'});
    await request('/tasks/my',commander.token,'GET',undefined,401);
    await request('/auth/login',null,'POST',{email:pending.email,password:'Changed123!'});
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (uploaded) await fs.unlink(path.join(__dirname,'uploads',path.basename(uploaded))).catch(()=>{});
    await pool.end();
  }
});
