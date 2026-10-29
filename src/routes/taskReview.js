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
   await conn.execute(`INSERT INTO report_versions (task_id,submitted_by,report_type,report_html,report_table_json,report_note,report_file,report_file_type) SELECT id,?,report_type,report_html,report_table_json,report_note,report_file,report_file_type FROM tasks WHERE id=?`,[req.user.id,task.id]);
   await conn.execute("UPDATE tasks SET status='на_проверке',submitted_at=NOW(),rejection_reason=NULL WHERE id=?",[task.id]);
  } else {
   if(!['admin','commander'].includes(req.user.role)||own) fail(403,'Нельзя проверять собственный отчёт');
   if(task.assignment_stage==='commander'&&req.user.role!=='admin') fail(403,'Отчёт командира проверяет администратор');
   if(task.status!=='на_проверке') fail(400,'Задача не на проверке');
   const comment=operation==='reject'?req.body.rejectionReason:req.body.adminComment;
   if(operation==='reject'&&(typeof comment!=='string'||!comment.trim())) fail(400,'Укажите причину');
   await conn.execute(`UPDATE report_versions SET outcome=?,reviewed_at=NOW(),reviewed_by=?,review_comment=? WHERE task_id=? AND outcome='pending'`,[operation==='approve'?'approved':'rejected',req.user.id,comment||null,task.id]);
   if(operation==='approve') await conn.execute("UPDATE tasks SET status='выполнена',approved_by=?,approved_at=NOW(),completed_at=submitted_at,review_status='approved',rejection_reason=NULL,admin_comment=? WHERE id=?",[req.user.id,comment||null,task.id]);
   else await conn.execute("UPDATE tasks SET status='в_работе',rejection_reason=?,submitted_at=NULL,review_status='rejected' WHERE id=?",[comment,task.id]);
  }
  const action=operation==='submit'?'Отправлено на проверку':operation==='approve'?'Принято':'Отклонено';
  await conn.execute('INSERT INTO task_history (task_id,user_id,action,details) VALUES (?,?,?,?)',[task.id,req.user.id,action,operation==='reject'?req.body.rejectionReason:req.body.adminComment||null]);
  await conn.commit();res.json({message:action});
 } catch(e){await conn.rollback();if(e.status)return res.status(e.status).json({error:e.message});next(e);} finally{conn.release();}
});
module.exports=router;
