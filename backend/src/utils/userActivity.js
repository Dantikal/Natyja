const pool = require('../config/db');
module.exports = async function userActivity(actorId, targetId, action, details = '') {
  await pool.execute('INSERT INTO user_activity (actor_user_id, target_user_id, action, details) VALUES (?, ?, ?, ?)', [actorId, targetId, action, details]);
};
