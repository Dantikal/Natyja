const express = require('express');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();
const userActivity = require('../utils/userActivity');

// СПИСОК ВСЕХ ПОЛЬЗОВАТЕЛЕЙ (админ) — с данными заявки
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        u.id, u.email, COALESCE(s.full_name,u.full_name) AS full_name, u.role, u.approved, u.created_at,
        u.requested_role, COALESCE(s.photo_file,u.photo_file) AS photo_file, u.soldier_id, COALESCE(u.unit_id,s.unit_id) AS unit_id,
        COALESCE(u.custom_rank,r.name) AS rank_name,
        COALESCE(u.custom_position,p.name) AS position_name,
        COALESCE(u.custom_unit,mu.name) AS unit_name
      FROM users u
      LEFT JOIN soldiers s ON s.id=u.soldier_id
      LEFT JOIN ranks r ON COALESCE(s.rank_id,u.rank_id) = r.id
      LEFT JOIN positions p ON COALESCE(s.position_id,u.position_id) = p.id
      LEFT JOIN military_units mu ON COALESCE(u.unit_id,s.unit_id) = mu.id
      ORDER BY u.approved ASC, u.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve the application and resolve manually entered dictionary values atomically.
router.patch('/:id/approve',authenticate,requireAdmin,async(req,res,next)=>{
 const {role='user'}=req.body;if(!['user','commander','admin'].includes(role))return res.status(400).json({error:'Неверная роль'});
 const conn=await pool.getConnection();
 try{await conn.beginTransaction();const [[user]]=await conn.execute('SELECT * FROM users WHERE id=? FOR UPDATE',[req.params.id]);
 if(!user){await conn.rollback();return res.sendStatus(404);}
 if(user.approved){await conn.rollback();return res.status(409).json({error:'Доступ уже одобрен'});}
 for(const [field,custom,table]of [['rank_id','custom_rank','ranks'],['position_id','custom_position','positions'],['unit_id','custom_unit','military_units']]){
  if(!user[field]&&user[custom]){const [[existing]]=await conn.execute('SELECT id FROM '+table+' WHERE name=? LIMIT 1',[user[custom]]);if(existing)user[field]=existing.id;else{const [created]=await conn.execute('INSERT INTO '+table+' (name) VALUES (?)',[user[custom]]);user[field]=created.insertId;}}
 }
 let soldierId=user.soldier_id;
 if(!soldierId){const [created]=await conn.execute('INSERT INTO soldiers (full_name,rank_id,position_id,unit_id,photo_file,works_percent,shifts_percent) VALUES (?,?,?,?,?,0,0)',[user.full_name,user.rank_id,user.position_id,user.unit_id,user.photo_file]);soldierId=created.insertId;}
 await conn.execute('UPDATE users SET approved=1,role=?,soldier_id=?,rank_id=?,position_id=?,unit_id=?,custom_rank=NULL,custom_position=NULL,custom_unit=NULL WHERE id=?',[role,soldierId,user.rank_id,user.position_id,user.unit_id,req.params.id]);
 await conn.execute('INSERT INTO user_activity (actor_user_id,target_user_id,action,details) VALUES (?,?,?,?)',[req.user.id,req.params.id,'Доступ одобрен',role]);
 await conn.commit();res.json({message:'Пользователь одобрен',soldierId});
 }catch(e){await conn.rollback();next(e);}finally{conn.release();}
});

// СМЕНИТЬ РОЛЬ
router.patch('/:id/role', authenticate, requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (Number(req.params.id) === Number(req.user.id) && role !== 'admin') return res.status(400).json({ error: 'Нельзя понизить свою роль' });
  if (!['user', 'commander', 'admin', 'pending'].includes(role)) {
    return res.status(400).json({ error: 'Неверная роль' });
  }
  try {
    await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    await userActivity(req.user.id, req.params.id, 'Роль изменена', role);
    res.json({ message: 'Роль обновлена' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ОТОЗВАТЬ ДОСТУП
router.patch('/:id/revoke', authenticate, requireAdmin, async (req, res) => {
  if (Number(req.params.id) === Number(req.user.id)) return res.status(400).json({ error: 'Нельзя отозвать собственный доступ' });
  try {
    await pool.execute(
      'UPDATE users SET approved = 0, role = ? WHERE id = ?',
      ['pending', req.params.id]
    );
    await userActivity(req.user.id, req.params.id, 'Доступ отозван');
    res.json({ message: 'Доступ отозван' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// УДАЛИТЬ
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Нельзя удалить себя' });
  }
  try {
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'Пользователь удалён' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ========== СПИСОК КОМАНДИРОВ ==========
router.get('/commanders', authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        u.soldier_id AS id, 
        u.full_name, 
        r.name AS rank_name,
        p.name AS position_name,
        m.name AS unit_name
      FROM users u
      LEFT JOIN ranks r ON u.rank_id = r.id
      LEFT JOIN positions p ON u.position_id = p.id
      LEFT JOIN military_units m ON u.unit_id = m.id
      WHERE u.role = 'commander' AND u.approved = 1 AND u.soldier_id IS NOT NULL
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.use(require('./userDetails'));
module.exports = router;
