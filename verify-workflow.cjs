require('dotenv').config();
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const db = require('./src/config/db');
const created = { users: [], soldiers: [], tasks: [] };
const stamp = Date.now();
const tokens = {};
async function call(role, path, method = 'GET', body, expected = 200) {
 const response = await fetch('http://localhost:5000/api' + path, { method, headers: { Authorization: 'Bearer ' + tokens[role], ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
 const data = await response.json(); assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`); return data;
}
(async () => {
 const [units] = await db.query('SELECT id FROM military_units ORDER BY id LIMIT 2');
 assert.equal(units.length, 2);
 for (const role of ['admin','commander','user','outsider']) {
  const unit = role === 'outsider' ? units[1].id : units[0].id;
  const [soldier] = await db.execute('INSERT INTO soldiers (full_name,unit_id) VALUES (?,?)',[`TEST ${role} ${stamp}`,unit]); created.soldiers.push(soldier.insertId);
  const [user] = await db.execute('INSERT INTO users (email,password_hash,full_name,role,approved,soldier_id,unit_id) VALUES (?,?,?,?,1,?,?)',[`test-${role}-${stamp}@example.invalid`, 'test-disabled', `TEST ${role}`, role === 'outsider' ? 'user' : role, soldier.insertId, role === 'commander' ? null : unit]); created.users.push(user.insertId);
  tokens[role] = jwt.sign({id:user.insertId,approved:1},process.env.JWT_SECRET,{expiresIn:'1h'});
 }
 const commander = created.soldiers[1], user = created.soldiers[2];
 await call('user','/soldiers','GET',null,403);
 const unitRoster=await call('commander','/soldiers?unitId='+units[1].id);
 assert(unitRoster.length>0);assert(unitRoster.every(s=>Number(s.unit_id)===Number(units[0].id)));assert(!unitRoster.some(s=>s.id===created.soldiers[3]));
 const base = { title:'Temporary workflow verification', dueDate:'2026-12-20', priority:'важная', classification:'открыто' };
 const taskForm = new FormData(); Object.entries({...base,soldierId:commander,description:'Task document verification'}).forEach(([k,v])=>taskForm.append(k,v));
 taskForm.append('attachment',new Blob(['%PDF-1.4\nTask instructions'],{type:'application/pdf'}),'Инструкция.pdf');
 const parentResponse = await fetch('http://localhost:5000/api/tasks',{method:'POST',headers:{Authorization:'Bearer '+tokens.admin},body:taskForm});
 const parent = await parentResponse.json(); assert.equal(parentResponse.status,201,JSON.stringify(parent)); created.tasks.push(parent.id);
 const listing = await call('commander','/tasks'); assert(listing.some(t=>t.id===parent.id));
 await call('admin','/tasks','POST',{...base,soldierId:user},403);
 const child = await call('commander','/tasks','POST',{...base,soldierId:user,parentTaskId:parent.id},201); created.tasks.push(child.id);
 assert((await call('user','/tasks/notifications')).some(t=>t.id===child.id));
 await call('outsider','/tasks/notifications/read','POST',{ids:[child.id]});
 assert((await call('user','/tasks/notifications')).some(t=>t.id===child.id));
 await call('user','/tasks/notifications/read','POST',{ids:[child.id]});
 assert(!(await call('user','/tasks/notifications')).some(t=>t.id===child.id));
 const [[attachmentRow]] = await db.execute('SELECT task_file,task_file_name,report_file FROM tasks WHERE id=?',[parent.id]);
 assert.equal(attachmentRow.task_file_name,'Инструкция.pdf'); assert.equal(attachmentRow.report_file,null); assert(attachmentRow.task_file.startsWith('instruction-'));
 const taskDownload = await fetch(`http://localhost:5000/api/tasks/${child.id}/attachment`,{headers:{Authorization:'Bearer '+tokens.user}}); assert.equal(taskDownload.status,200); assert.equal(await taskDownload.text(),'%PDF-1.4\nTask instructions');
 await call('outsider',`/tasks/${child.id}/attachment`,'GET',null,403);
 const plain = await call('commander','/tasks','POST',{...base,soldierId:user},201); created.tasks.push(plain.id);
 await call('user',`/tasks/${plain.id}/attachment`,'GET',null,404);
 await call('user',`/tasks/${child.id}/history`);
 await call('outsider',`/tasks/${child.id}/history`,'GET',null,403);
 const report = {version:2,active:0,sheets:[{id:'test',name:'Sheet1',data:[[2,3,'=SUM(A1:B1)']],styles:{'0:0':{bold:true}},merges:[],widths:[110,110,110]}]};
 await call('user',`/tasks/${child.id}/report`,'PATCH',{reportType:'table',reportTable:report,reportHtml:'<p>Preserved text</p>'});
 const mine = await call('user','/tasks/my'); const saved=mine.find(t=>t.id===child.id); const actual=typeof saved.report_table_json==='string'?JSON.parse(saved.report_table_json):saved.report_table_json;
 assert.equal(actual.sheets[0].data[0][2],'=SUM(A1:B1)'); assert(actual.sheets[0].styles['0:0'].bold);
 await call('user',`/tasks/${child.id}/submit`,'PATCH');
 await call('user',`/tasks/${child.id}/report`,'PATCH',{reportType:'text',reportHtml:'changed'},403);
 await call('outsider',`/tasks/${child.id}/download`,'GET',null,403);
 await call('commander',`/tasks/${child.id}/reject`,'PATCH',{rejectionReason:'Fix report'});
 const attachment = new FormData(); attachment.append('file', new Blob(['%PDF-1.4\nTemporary verification'], {type:'application/pdf'}), 'verification.pdf');
 const upload = await fetch(`http://localhost:5000/api/tasks/${child.id}/upload-file`, {method:'POST',headers:{Authorization:'Bearer '+tokens.user},body:attachment}); assert.equal(upload.status,200,await upload.text());
 const download = await fetch(`http://localhost:5000/api/tasks/${child.id}/download`,{headers:{Authorization:'Bearer '+tokens.commander}}); assert.equal(download.status,200); assert((await download.text()).startsWith('%PDF'));
 await call('user',`/tasks/${child.id}/report`,'PATCH',{reportType:'text',reportHtml:'<p>Fixed report</p>'});
 await call('user',`/tasks/${child.id}/submit`,'PATCH');
 await call('commander',`/tasks/${child.id}/approve`,'PATCH',{adminComment:'Verified'});
 await call('user',`/tasks/${child.id}/submit`,'PATCH',null,400);
 const [rows]=await db.execute('SELECT completed_at,approved_at,status FROM tasks WHERE id=?',[child.id]); assert(rows[0].completed_at); assert.equal(rows[0].status,'выполнена');
 // Commanders use the same text/table editors and report upward to the administrator.
 await call('commander',`/tasks/${parent.id}/report`,'PATCH',{reportType:'text',reportHtml:'<h1>Доклад командира</h1><p>Подчинённый выполнил задачу.</p>'});
 await call('commander',`/tasks/${parent.id}/submit`,'PATCH');
 await call('commander',`/tasks/${parent.id}/approve`,'PATCH',{},403);
 await call('admin',`/tasks/${parent.id}/reject`,'PATCH',{rejectionReason:'Добавьте таблицу'});
 await call('commander',`/tasks/${parent.id}/report`,'PATCH',{reportType:'table',reportHtml:'<p>Доклад командира</p>',reportTable:report});
 await call('commander',`/tasks/${parent.id}/submit`,'PATCH');
 await call('admin',`/tasks/${parent.id}/approve`,'PATCH',{adminComment:'Доклад принят'});
 const [[accepted]]=await db.execute('SELECT status,approved_by,report_html,report_table_json FROM tasks WHERE id=?',[parent.id]); assert.equal(accepted.status,'выполнена'); assert.equal(accepted.approved_by,created.users[0]); assert(accepted.report_html.includes('Доклад командира')); assert(accepted.report_table_json);
 const versions=await call('admin','/reports?year='+new Date().getFullYear());const old=versions.find(v=>v.task_id===child.id&&v.outcome==='rejected');assert(old);const archived=await call('admin','/reports/'+old.id);assert(archived.report_table_json);await call('outsider','/reports/'+old.id,'GET',null,404);
 const score=(await call('admin','/soldiers?from=2026-01-01&to=2026-12-31')).find(s=>s.id===user);assert.equal(Number(score.earned_points),1);assert.equal(Number(score.penalty_points),1);assert.equal(Number(score.task_rating),0);
 const future=(await call('admin','/soldiers?from=2027-01-01&to=2027-12-31')).find(s=>s.id===user);assert.equal(Number(future.earned_points),0);assert.equal(Number(future.penalty_points),0);
 await call('admin','/tasks/'+child.id,'DELETE',null,409);
 await call('admin',`/soldiers?from=invalid&to=2026-12-31`,'GET',null,400);
 const approvedVersion=versions.find(v=>v.task_id===child.id&&v.outcome==='approved');assert(approvedVersion);
 const archivedFile=await fetch(`http://localhost:5000/api/reports/${approvedVersion.id}/file`,{headers:{Authorization:'Bearer '+tokens.admin}});assert.equal(archivedFile.status,200);assert((await archivedFile.text()).startsWith('%PDF'));
 console.log('PASS: immutable report versions and archived attachments, year filter, cross-unit archive access, +1 accepted / -1 revision, period boundaries, archive deletion protection.');
 console.log('PASS: admin → commander → subordinate; subordinate report → commander; commander Word/table reports → admin, rejection/resubmission/approval; own review denied; task attachments; report workbook round trip; cross-unit access denied.');
})().catch(err=>{console.error(err);process.exitCode=1;}).finally(async()=>{
 const instructionFiles=new Set();
 for(const id of created.tasks.reverse()) { const [[task]]=await db.execute('SELECT report_file,task_file FROM tasks WHERE id=?',[id]); if(task?.task_file) instructionFiles.add(task.task_file); if(task?.report_file) {const path=require('path');const fs=require('fs');fs.rmSync(path.join(__dirname,'uploads',path.basename(task.report_file)),{force:true});} await db.execute('DELETE FROM report_versions WHERE task_id=?',[id]); await db.execute('DELETE FROM task_history WHERE task_id=?',[id]); await db.execute('DELETE FROM task_transfers WHERE task_id=?',[id]); await db.execute('DELETE FROM tasks WHERE id=?',[id]); }
 for(const file of instructionFiles) {const [refs]=await db.execute('SELECT id FROM tasks WHERE task_file=? LIMIT 1',[file]);if(!refs.length)require('fs').rmSync(require('path').join(__dirname,'uploads',require('path').basename(file)),{force:true});}
 for(const id of created.users) {await db.execute('DELETE FROM task_notification_reads WHERE user_id=?',[id]); await db.execute('DELETE FROM users WHERE id=?',[id]);}
 for(const id of created.soldiers) await db.execute('DELETE FROM soldiers WHERE id=?',[id]);
 await db.end();
});
