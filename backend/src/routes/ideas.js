const router = require('express').Router();
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { rateLimit } = require('express-rate-limit');
const reviews = require('../services/ideaReview');
router.use(authenticate);
const limit = rateLimit({ windowMs:60000,limit:5,keyGenerator:req=>String(req.user.id),message:{ error:'Подождите минуту перед следующей отправкой.' } });
const manager = (user,idea) => user.role==='admin' || (user.role==='commander' && user.unit_id && Number(user.unit_id)===Number(idea.unit_id));
router.get('/',async(req,res,next) => {
  try {
    const params=[]; let where='1=1';
    if (req.query.mine==='1' || !['admin','commander'].includes(req.user.role)) { where='i.author_id=?'; params.push(req.user.id); }
    else if(req.user.role==='commander') { where='(i.author_id=? OR i.unit_id=?)'; params.push(req.user.id,req.user.unit_id||0); }
    const [rows] = await pool.execute(`SELECT i.*,COALESCE(s.full_name,u.full_name) AS author_name,m.name AS unit_name,r.full_name AS reviewer_name FROM ideas i
      LEFT JOIN users u ON u.id=i.author_id LEFT JOIN soldiers s ON s.id=i.soldier_id LEFT JOIN military_units m ON m.id=i.unit_id LEFT JOIN users r ON r.id=i.reviewed_by
      WHERE ${where} ORDER BY i.status='pending' DESC,COALESCE(i.ai_score,-1) DESC,i.created_at DESC LIMIT 200`,params);
    res.json(rows.map(row=>({ ...row,ai_analysis:typeof row.ai_analysis==='string'?JSON.parse(row.ai_analysis):row.ai_analysis,points:row.status==='approved'?10:0,canReview:!!manager(req.user,row)&&Number(row.author_id)!==Number(req.user.id)&&row.status==='pending' })));
  }catch(error){next(error);}
});
router.post('/',limit,async(req,res,next) => {
  try {
    const { title,description }=req.body;
    if(typeof title!=='string'||title.trim().length<5||title.length>160||typeof description!=='string'||description.trim().length<30||description.length>4000) return res.status(400).json({error:'Название: 5–160 символов. Описание: 30–4000 символов. Укажите пользу и способ реализации.'});
    const [[duplicate]]=await pool.execute('SELECT id FROM ideas WHERE author_id=? AND title=? AND description=? LIMIT 1',[req.user.id,title.trim(),description.trim()]);
    if(duplicate)return res.status(409).json({error:'Вы уже подавали эту идею. Она есть в списке.'});
    const [result]=await pool.execute('INSERT INTO ideas (author_id,soldier_id,unit_id,title,description) VALUES (?,?,?,?,?)',[req.user.id,req.user.soldier_id||null,req.user.unit_id||null,title.trim(),description.trim()]);
    res.status(201).json({id:result.insertId,ai_status:'queued'}); void reviews.tick();
  }catch(error){next(error);}
});
router.post('/:id/retry',limit,async(req,res,next) => {
  try {
    const [[idea]]=await pool.execute('SELECT * FROM ideas WHERE id=?',[req.params.id]);
    if(!idea||(!manager(req.user,idea)&&Number(idea.author_id)!==Number(req.user.id)))return res.status(404).json({error:'Идея не найдена'});
    const [result]=await pool.execute("UPDATE ideas SET ai_status='queued',ai_error=NULL WHERE id=? AND ai_status='error' AND status='pending'",[idea.id]);
    if(!result.affectedRows)return res.status(409).json({error:'Повторный анализ доступен после ошибки для ещё не рассмотренной идеи.'});
    res.json({ok:true}); void reviews.tick();
  }catch(error){next(error);}
});
router.patch('/:id/review',async(req,res,next) => {
  const { decision,comment }=req.body;
  if(!['approved','rejected'].includes(decision)||typeof comment!=='string'||comment.trim().length<5||comment.length>2000)return res.status(400).json({error:'Выберите решение и укажите обоснование (5–2000 символов).'});
  const connection=await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[idea]]=await connection.execute('SELECT * FROM ideas WHERE id=? FOR UPDATE',[req.params.id]);
    if(!idea||!manager(req.user,idea)){await connection.rollback();return res.status(404).json({error:'Идея не найдена'});}
    if(Number(idea.author_id)===Number(req.user.id)){await connection.rollback();return res.status(403).json({error:'Собственную идею рассматривает другой руководитель.'});}
    if(idea.status!=='pending'){await connection.rollback();return res.status(409).json({error:'Решение уже принято. Повторное начисление невозможно.'});}
    await connection.execute("UPDATE ideas SET status=?,reviewed_by=?,reviewed_at=NOW(),review_comment=?,ai_status=CASE WHEN ai_status='queued' THEN 'skipped' ELSE ai_status END WHERE id=?",[decision,req.user.id,comment.trim(),idea.id]);
    await connection.commit();res.json({ok:true,points:decision==='approved'?10:0});
  }catch(error){await connection.rollback();next(error);}finally{connection.release();}
});
module.exports=router;
