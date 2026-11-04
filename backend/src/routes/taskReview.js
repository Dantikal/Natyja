const express=require('express');
const pool=require('../config/db');
const router=express.Router();
for(const operation of ['submit','approve','reject']) router.patch(`/:id/${operation}`,async(req,res,next)=>{
 const conn=await pool.getConnection();
 try {
  await conn.beginTransaction();
  const [[task]]=await conn.execute('SELECT * FROM tasks WHERE id=? FOR UPDATE',[req.params.id]);
  if(!task) {await conn.rollback();return res.status(404).json({error:'Задача не найдена'});}
  const fail=(status,error)=>{const e=new Error(error);e.status=status;throw e;};
  const own=Number(req.user.soldier_id)===Number(task.soldier_id);
  if(operation==='submit') {
   if(!own) fail(403,'Нет доступа');
   if(!['новая','в_работе'].includes(task.status)) fail(400,'Задача завершена или уже отправлена');
   if(!task.report_html?.replace(/<[^>]*>/g,'').trim()&&!task.report_table_json&&!task.report_file) fail(400,'Сначала сохраните отчёт');
   const [version]=await conn.execute(`INSERT INTO report_versions (task_id,submitted_by,report_type,report_html,report_table_json,report_note,report_file,report_file_type) SELECT id,?,report_type,report_html,report_table_json,report_note,report_file,report_file_type FROM tasks WHERE id=?`,[req.user.id,task.id]);
   await conn.execute('INSERT INTO report_ai_assessments (task_id,version_id,task_title,task_description,task_attachment) VALUES (?,?,?,?,?)',[task.id,version.insertId,task.title,task.description,task.task_file]);
   await conn.execute("UPDATE tasks SET status='на_проверке',submitted_at=NOW(),rejection_reason=NULL WHERE id=?",[task.id]);
  } else {
   if(!['admin','commander'].includes(req.user.role)||own) fail(403,'Нельзя проверять собственный отчёт');
   if(req.user.role==='commander') { const [[soldier]]=await conn.execute('SELECT unit_id FROM soldiers WHERE id=?',[task.soldier_id]);if(!req.user.unit_id||Number(soldier?.unit_id)!==Number(req.user.unit_id))fail(403,'Нет доступа к задачам другой части'); }
   if(task.assignment_stage==='commander'&&req.user.role!=='admin') fail(403,'Отчёт командира проверяет администратор');
   if(task.status!=='на_проверке') fail(400,'Задача не на проверке');
   const comment=operation==='reject'?req.body.rejectionReason:req.body.adminComment;
   if(comment!==undefined&&(typeof comment!=='string'||comment.length>2000))fail(400,'Комментарий должен быть текстом до 2000 символов');
   if(operation==='reject'&&(typeof comment!=='string'||!comment.trim())) fail(400,'Укажите причину');
   const points=req.body.qualityPoints;
   if(operation==='approve'&&(!Number.isInteger(points)||![3,5,7].includes(points))) fail(400,'Выберите оценку: отлично — 7, хорошо — 5, удовлетворительно — 3 балла');
   const [[ai]]=await conn.execute("SELECT state,points FROM report_ai_assessments WHERE task_id=? ORDER BY version_id DESC LIMIT 1",[task.id]);
   if(ai?.state==='ready'&&((operation==='approve'&&points!==ai.points)||(operation==='reject'&&ai.points>0))&&(!comment||comment.trim().length<10))fail(400,'Обоснуйте отличие от оценки ИИ: комментарий не короче 10 символов');
   await conn.execute(`UPDATE report_versions SET outcome=?,reviewed_at=NOW(),reviewed_by=?,review_comment=? WHERE task_id=? AND outcome='pending'`,[operation==='approve'?'approved':'rejected',req.user.id,comment||null,task.id]);
   if(operation==='approve') await conn.execute("UPDATE tasks SET status='выполнена',approved_by=?,approved_at=NOW(),completed_at=submitted_at,review_status='approved',rejection_reason=NULL,admin_comment=?,awarded_points=?,quality_score=? WHERE id=?",[req.user.id,comment||null,points,points,task.id]);
   else await conn.execute("UPDATE tasks SET status='в_работе',rejection_reason=?,submitted_at=NULL,review_status='rejected' WHERE id=?",[comment,task.id]);
  }
  const action=operation==='submit'?'Отправлено на проверку':operation==='approve'?'Принято':'Отклонено';
  const details=operation==='reject'?req.body.rejectionReason:operation==='approve'?`Оценка: ${req.body.qualityPoints} баллов. ${req.body.adminComment||''}`:null;
  await conn.execute('INSERT INTO task_history (task_id,user_id,action,details) VALUES (?,?,?,?)',[task.id,req.user.id,action,details]);
  await conn.commit();res.json({message:action});
  if(operation==='submit')void require('../services/ideaReview').tick();
 } catch(e){await conn.rollback();if(e.status)return res.status(e.status).json({error:e.message});next(e);} finally{conn.release();}
});
module.exports=router;
