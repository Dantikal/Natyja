const router=require('express').Router();
const pool=require('../config/db');
const path=require('path');
const {authenticate}=require('../middleware/auth');
router.use(authenticate);
function scope(user,params){
 if(user.role==='admin')return '1=1';
 if(user.role==='commander'&&user.unit_id){params.push(user.unit_id,user.soldier_id||0);return '(s.unit_id=? OR t.soldier_id=?)';}
 params.push(user.soldier_id||0);return 't.soldier_id=?';
}
router.get('/',async(req,res,next)=>{try{
 const year=Number(req.query.year||new Date().getFullYear());
 if(!Number.isInteger(year)||year<2000||year>2200)return res.status(400).json({error:'Проверьте год'});
 const params=[`${year}-01-01`,`${year+1}-01-01`];const where=scope(req.user,params);
 const [rows]=await pool.execute(`SELECT v.id,v.task_id,v.submitted_at,v.outcome,v.reviewed_at,v.review_comment,t.title,s.full_name FROM report_versions v JOIN tasks t ON t.id=v.task_id LEFT JOIN soldiers s ON s.id=t.soldier_id WHERE v.submitted_at>=? AND v.submitted_at<? AND ${where} ORDER BY v.submitted_at DESC,v.id DESC`,params);
 res.json(rows);
 }catch(e){next(e);}});
async function version(req,res,next){try{const params=[req.params.id];const where=scope(req.user,params);const [[v]]=await pool.execute(`SELECT v.*,t.title,s.full_name FROM report_versions v JOIN tasks t ON t.id=v.task_id LEFT JOIN soldiers s ON s.id=t.soldier_id WHERE v.id=? AND ${where}`,params);if(!v)return res.status(404).json({error:'Отчёт не найден'});req.version=v;next();}catch(e){next(e);}}
router.get('/:id',version,(req,res)=>res.json(req.version));
router.get('/:id/file',version,(req,res)=>{if(!req.version.report_file)return res.sendStatus(404);res.download(path.join(__dirname,'../../uploads',path.basename(req.version.report_file)));});
module.exports=router;
