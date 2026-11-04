// Existing completions retain their original 1 point; new reviews store 3/5/7.
const events = `SELECT soldier_id,NULL AS author_id,CASE WHEN status='выполнена' THEN COALESCE(awarded_points,1) ELSE 0 END AS earned,0 AS idea_points,0 AS penalty,
 CASE WHEN status='выполнена' THEN 1 ELSE 0 END AS done,
 CASE WHEN status='выполнена' AND DATE(completed_at)>DATE(due_date) THEN 1 ELSE 0 END AS late,
 CASE WHEN status='провалена' THEN 1 ELSE 0 END AS failed,
 CASE WHEN status IN ('новая','в_работе') AND DATE(due_date)<CURDATE() THEN 1 ELSE 0 END AS overdue,
 COALESCE(approved_at,completed_at,due_date) AS event_date FROM tasks
 UNION ALL SELECT t.soldier_id,NULL,0,0,1,0,0,0,0,h.created_at FROM task_history h JOIN tasks t ON t.id=h.task_id WHERE h.action='Отклонено'
 UNION ALL SELECT soldier_id,author_id,0,10,0,0,0,0,0,reviewed_at FROM ideas WHERE status='approved'`;
const join = `LEFT JOIN (SELECT soldier_id,SUM(earned) AS earned_points,SUM(idea_points) AS idea_points,SUM(penalty) AS penalty_points,
 SUM(done) AS completed_tasks,SUM(late) AS late_tasks,SUM(failed) AS failed_tasks,SUM(overdue) AS overdue_tasks,SUM(done+failed+overdue) AS rated_tasks
 FROM (${events}) events WHERE 1=1 /*RATING_PERIOD*/ GROUP BY soldier_id) task_perf ON task_perf.soldier_id=s.id`;
const select = `CASE WHEN COALESCE(task_perf.rated_tasks,0)>0 OR COALESCE(task_perf.penalty_points,0)>0 OR COALESCE(task_perf.idea_points,0)>0
 THEN COALESCE(task_perf.earned_points,0)+COALESCE(task_perf.idea_points,0)-COALESCE(task_perf.penalty_points,0) ELSE NULL END AS task_rating,
 COALESCE(task_perf.earned_points,0)+COALESCE(task_perf.idea_points,0) AS earned_points,COALESCE(task_perf.idea_points,0) AS idea_points,COALESCE(task_perf.penalty_points,0) AS penalty_points,
 COALESCE(task_perf.rated_tasks,0) AS rated_tasks,COALESCE(task_perf.completed_tasks,0) AS completed_tasks,COALESCE(task_perf.late_tasks,0) AS late_tasks,COALESCE(task_perf.failed_tasks,0) AS failed_tasks,COALESCE(task_perf.overdue_tasks,0) AS overdue_tasks`;
function periodRange(key, now = new Date()) {
  const today = new Date(now.getTime() + 6 * 3600000).toISOString().slice(0, 10);
  const end = new Date(today + 'T00:00:00Z'), start = new Date(end);
  if (key === 'week') start.setUTCDate(start.getUTCDate() - 6);
  else {
    const months = Number(key); if (![1,3,6,12].includes(months)) throw new Error('Неверный период');
    const day = start.getUTCDate(); start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() - months);
    const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate(); start.setUTCDate(Math.min(day, last));
  }
  return { from: start.toISOString().slice(0,10), to: today };
}
module.exports = { events, join, select, periodRange };
