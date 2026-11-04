const router = require('express').Router();
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { events, periodRange } = require('../services/rating');
router.get('/my', authenticate, async (req,res,next) => {
  try {
    const periods = [];
    for (const key of ['week','1','3','6','12']) {
      const range = periodRange(key);
      const [[row]] = await pool.execute(`SELECT COALESCE(SUM(earned),0) AS taskPoints,COALESCE(SUM(idea_points),0) AS ideaPoints,COALESCE(SUM(penalty),0) AS penalties
        FROM (${events}) events WHERE (soldier_id=? OR (soldier_id IS NULL AND author_id=?)) AND event_date>=? AND event_date<DATE_ADD(?,INTERVAL 1 DAY)`,[req.user.soldier_id||0,req.user.id,range.from,range.to]);
      periods.push({ key,...range,taskPoints:Number(row.taskPoints),ideaPoints:Number(row.ideaPoints),penalties:Number(row.penalties),total:Number(row.taskPoints)+Number(row.ideaPoints)-Number(row.penalties) });
    }
    res.json({ periods });
  } catch(error) { next(error); }
});
module.exports = router;
