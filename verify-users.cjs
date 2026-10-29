require('dotenv').config();
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./src/config/db');
const ids = [], soldiers = [], stamp = Date.now();
let admin, member, oldToken;
let fixture;
async function call(token, path, method='GET', body, expected=200) {
 const captcha = path === '/auth/login' ? await fixture.headers('login') : {};
 const base = path.startsWith('/auth/') ? fixture.base : 'http://localhost:5000/api';
 const res = await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,...captcha,...(body ? {'Content-Type':'application/json'}:{})},body:body ? JSON.stringify(body):undefined});
 const data=await res.json(); assert.equal(res.status,expected,method+' '+path+': '+(data.error||'')); return data;
}
(async()=>{
 fixture = await require('./verification-auth.cjs')();
 const hash=await bcrypt.hash('FixtureOriginal123!',10);
 for(const role of ['admin','user']) {
  const [s]=await db.execute('INSERT INTO soldiers (full_name) VALUES (?)',['VERIFY '+role+' '+stamp]); soldiers.push(s.insertId);
  const [u]=await db.execute('INSERT INTO users (email,password_hash,full_name,role,approved,soldier_id) VALUES (?,?,?,?,1,?)',[`verify-${role}-${stamp}@example.invalid`,hash,'VERIFY '+role,role,s.insertId]); ids.push(u.insertId);
 }
 admin=jwt.sign({id:ids[0]},process.env.JWT_SECRET); oldToken=jwt.sign({id:ids[1]},process.env.JWT_SECRET);
 let detail=await call(admin,`/users/${ids[1]}`); assert.equal(detail.user.reprimands,0); assert(!JSON.stringify(detail).includes('password_hash')); assert(!JSON.stringify(detail).includes(hash));
 const users=await call(admin,'/users'); assert(users.some(u=>u.id===ids[1]));
 await call(oldToken,`/users/${ids[1]}`,'GET',null,403);
 await call(oldToken,`/users/${ids[1]}/reset-password`,'POST',{},403);
 await call(admin,`/users/${ids[1]}`,'PATCH',{fullName:'VERIFY Changed',email:`verify-updated-${stamp}@example.invalid`,yearsOfService:3,reprimands:0});
 detail=await call(admin,`/users/${ids[1]}`); assert.equal(detail.user.full_name,'VERIFY Changed');
 const [[s]]=await db.execute('SELECT full_name FROM soldiers WHERE id=?',[soldiers[1]]); assert.equal(s.full_name,'VERIFY Changed');
 await call(admin,`/users/${ids[1]}`,'PATCH',{fullName:'Should rollback',email:`verify-admin-${stamp}@example.invalid`},409);
 detail=await call(admin,`/users/${ids[1]}`); assert.equal(detail.user.full_name,'VERIFY Changed');
 const reset=await call(admin,`/users/${ids[1]}/reset-password`,'POST',{}); assert(reset.temporaryPassword.length>=16);
 await call(oldToken,'/soldiers','GET',null,401);
 const email=detail.user.email;
 await call(null,'/auth/login','POST',{email,password:'FixtureOriginal123!'},401);
 member=await call(null,'/auth/login','POST',{email,password:reset.temporaryPassword}); assert.equal(member.mustChangePassword,true);
 const blocked=await call(member.token,'/soldiers','GET',null,403); assert.equal(blocked.code,'PASSWORD_CHANGE_REQUIRED');
 await call(member.token,'/auth/change-password','POST',{currentPassword:'wrong',newPassword:'FixtureReplacement123!'},400);
 const updated=await call(member.token,'/auth/change-password','POST',{currentPassword:reset.temporaryPassword,newPassword:'FixtureReplacement123!'}); assert.equal(updated.mustChangePassword,false);
 await call(updated.token,'/soldiers/me'); await call(updated.token,'/soldiers','GET',null,403); await call(member.token,'/soldiers','GET',null,401);
 await call(null,'/auth/login','POST',{email,password:reset.temporaryPassword},401);
 await call(null,'/auth/login','POST',{email,password:'FixtureReplacement123!'});
 const history=await call(admin,`/users/${ids[1]}/activity`); assert(history.items.some(i=>i.action==='Пароль изменён')); assert(history.items.some(i=>i.action==='Пароль сброшен администратором'));
 assert(!JSON.stringify(history).includes(reset.temporaryPassword)); assert(!JSON.stringify(history).includes('FixtureReplacement123!'));
 console.log('PASS: admin list/detail/edit, permissions, atomic duplicate handling, reset, session invalidation, mandatory password change, history excludes credentials.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{
 if(fixture) await fixture.close();
 for(const id of ids) await db.execute('DELETE FROM user_activity WHERE target_user_id=? OR actor_user_id=?',[id,id]);
 for(const id of ids) await db.execute('DELETE FROM users WHERE id=?',[id]);
 for(const id of soldiers) await db.execute('DELETE FROM soldiers WHERE id=?',[id]);
 await db.end();
});
