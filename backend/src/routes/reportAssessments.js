const router=require('express').Router(),pool=require('../config/db');
const {authenticate}=require('../middleware/auth');
const {rateLimit}=require('express-rate-limit');
router.use(authenticate);
const limit=rateLimit({windowMs:60000,limit:5,keyGenerator:req=>String(req.user.id),message:{error:'Подождите минуту перед повторной проверкой.'}});
function scope(user,params){if(user.role==='admin')return '1=1';if(user.role==='commander'&&user.unit_id){params.push(user.unit_id,user.soldier_id||0);return '(s.unit_id=? OR t.soldier_id=?)';}params.push(user.soldier_id||0);return 't.soldier_id=?';}
router.get('/',async(req,res,next)=>{try{
 const params=[],where=req.query.mine==='1'?(params.push(req.user.soldier_id||0),'t.soldier_id=?'):scope(req.user,params);
 const [rows]=await pool.execute(`SELECT a.*,v.outcome,t.status AS task_status FROM report_ai_assessments a JOIN tasks t ON t.id=a.task_id JOIN report_versions v ON v.id=a.version_id LEFT JOIN soldiers s ON s.id=t.soldier_id
   WHERE ${where} AND a.version_id=(SELECT MAX(v2.id) FROM report_versions v2 WHERE v2.task_id=t.id) ORDER BY a.created_at DESC LIMIT 500`,params);
 res.json(rows.map(row=>({...row,analysis:typeof row.analysis==='string'?JSON.parse(row.analysis):row.analysis})));
 }catch(error){next(error);}});
router.post('/task/:id/analyze',limit,async(req,res,next)=>{try{
 const params=[req.params.id],where=scope(req.user,params);
 const [[task]]=await pool.execute(`SELECT t.id,t.status,t.title,t.description,t.task_file FROM tasks t LEFT JOIN soldiers s ON s.id=t.soldier_id WHERE t.id=? AND ${where}`,params);
 if(!task)return res.status(404).json({error:'Задача не найдена'});
 if(task.status!=='на_проверке')return res.status(409).json({error:'Анализ запускается для отправленного на проверку отчёта.'});
 const [[version]]=await pool.execute('SELECT id FROM report_versions WHERE task_id=? ORDER BY id DESC LIMIT 1',[task.id]);if(!version)return res.status(409).json({error:'Нет сохранённой версии отправленного отчёта.'});
 await pool.execute("INSERT INTO report_ai_assessments (task_id,version_id,task_title,task_description,task_attachment) VALUES (?,?,?,?,?) ON CONFLICT (version_id) DO UPDATE SET state=CASE WHEN report_ai_assessments.state IN ('error','needs_review') THEN 'queued' ELSE report_ai_assessments.state END,error_message=NULL",[task.id,version.id,task.title,task.description,task.task_file]);
 res.json({ok:true});void require('../services/ideaReview').tick();
 }catch(error){next(error);}});
router.post('/:id/appeal',async(req,res,next)=>{try{
 const text=req.body.text;if(typeof text!=='string'||text.trim().length<10||text.length>2000)return res.status(400).json({error:'Опишите причину несогласия: 10–2000 символов.'});
 const [result]=await pool.execute(`UPDATE report_ai_assessments a SET appeal_text=?,appeal_at=NOW() FROM tasks t
   WHERE t.id=a.task_id AND a.id=? AND t.soldier_id=? AND t.status='на_проверке' AND a.state='ready' AND a.version_id=(SELECT MAX(v.id) FROM report_versions v WHERE v.task_id=t.id)`,[text.trim(),req.params.id,req.user.soldier_id||0]);
 if(!result.affectedRows)return res.status(404).json({error:'Оценка не найдена или недоступна для обращения.'});res.json({ok:true});
 }catch(error){next(error);}});
module.exports=router;
