const pool = require('./db');

async function ensureColumn(table, column, definition) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (Number(rows[0].count) === 0) {
    await pool.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

async function migrate() {
  const [legacyUnits]=await pool.execute(`SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='soldiers' AND COLUMN_NAME='unit_id' AND REFERENCED_TABLE_NAME='units'`);
  if(legacyUnits.length){
    const [[orphans]]=await pool.execute('SELECT COUNT(*) AS total FROM soldiers s LEFT JOIN military_units m ON m.id=s.unit_id WHERE s.unit_id IS NOT NULL AND m.id IS NULL');
    if(orphans.total)throw new Error('Необходимо сопоставить старые части перед обновлением связи soldiers.unit_id');
    const constraint=legacyUnits[0].CONSTRAINT_NAME;if(!/^[a-zA-Z0-9_]+$/.test(constraint))throw new Error('Неверное имя ограничения');
    await pool.execute(`ALTER TABLE soldiers DROP FOREIGN KEY \`${constraint}\`, ADD CONSTRAINT soldiers_military_unit_fk FOREIGN KEY (unit_id) REFERENCES military_units(id) ON DELETE SET NULL`);
  }
  for(const column of ['custom_rank','custom_position','custom_unit'])await ensureColumn('users',column,'VARCHAR(100) NULL');
  await pool.execute(`CREATE TABLE IF NOT EXISTS task_notification_reads (user_id INT NOT NULL, task_id INT NOT NULL, PRIMARY KEY(user_id,task_id)) ENGINE=InnoDB`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS report_versions (
    id INT AUTO_INCREMENT PRIMARY KEY, task_id INT NOT NULL, submitted_by INT NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, report_type VARCHAR(20) NULL,
    report_html MEDIUMTEXT NULL, report_table_json JSON NULL, report_note TEXT NULL,
    report_file VARCHAR(255) NULL, report_file_type VARCHAR(255) NULL,
    outcome VARCHAR(20) NOT NULL DEFAULT 'pending', reviewed_at DATETIME NULL,
    reviewed_by INT NULL, review_comment TEXT NULL,
    INDEX idx_report_task (task_id,id), INDEX idx_report_date (submitted_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  // Preserve the latest existing submission; older overwritten versions cannot be recovered.
  await pool.execute(`INSERT INTO report_versions (task_id,submitted_at,report_type,report_html,report_table_json,report_note,report_file,report_file_type,outcome,reviewed_at,review_comment)
    SELECT t.id,COALESCE(t.submitted_at,t.approved_at,t.created_at),t.report_type,t.report_html,t.report_table_json,t.report_note,t.report_file,t.report_file_type,
      CASE WHEN t.status='выполнена' THEN 'approved' WHEN t.status='на_проверке' THEN 'pending' ELSE 'rejected' END,t.approved_at,COALESCE(t.rejection_reason,t.admin_comment)
    FROM tasks t WHERE (t.status IN ('выполнена','на_проверке') OR t.rejection_reason IS NOT NULL)
    AND (t.report_html IS NOT NULL OR t.report_table_json IS NOT NULL OR t.report_file IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM report_versions v WHERE v.task_id=t.id)`);
  await ensureColumn('users', 'must_change_password', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('users', 'token_version', 'INT NOT NULL DEFAULT 0');
  await ensureColumn('users', 'last_login_at', 'DATETIME NULL');
  await pool.execute(`CREATE TABLE IF NOT EXISTS user_activity (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_user_id INT NULL, target_user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL, details TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_activity_target (target_user_id, created_at),
    INDEX idx_user_activity_actor (actor_user_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  // Imported DOCX reports may contain tables and inline images beyond TEXT's 64 KB.
  const [reportColumns] = await pool.execute(`SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'report_html'`);
  if (reportColumns.length && reportColumns[0].DATA_TYPE === 'text') {
    await pool.execute('ALTER TABLE tasks MODIFY COLUMN report_html MEDIUMTEXT NULL');
  }
  await ensureColumn('tasks', 'original_soldier_id', 'INT NULL');
  await ensureColumn('tasks', 'created_by', 'INT NULL');
  await ensureColumn('tasks', 'task_file', 'VARCHAR(255) NULL');
  await ensureColumn('tasks', 'task_file_name', 'VARCHAR(255) NULL');
  await ensureColumn('tasks', 'task_file_type', 'VARCHAR(255) NULL');
  await ensureColumn('tasks', 'quality_score', 'DECIMAL(5,2) NULL');
  await ensureColumn('tasks', 'quality_comment', 'TEXT NULL');
  await ensureColumn('tasks', 'failure_reason', 'TEXT NULL');
  await ensureColumn('tasks', 'assignment_stage', "VARCHAR(20) NOT NULL DEFAULT 'executor'");
  await ensureColumn('tasks', 'review_status', "VARCHAR(20) NOT NULL DEFAULT 'not_required'");
  await ensureColumn('tasks', 'review_comment', 'TEXT NULL');
  await ensureColumn('tasks', 'task_direction', 'VARCHAR(160) NULL');
  await ensureColumn('tasks', 'required_position_id', 'INT NULL');
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS task_transfers (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      from_soldier_id INT NOT NULL,
      to_soldier_id INT NOT NULL,
      transferred_by INT NOT NULL,
      reason TEXT NOT NULL,
      bonus_points INT NOT NULL DEFAULT 10,
      transfer_type VARCHAR(20) NOT NULL DEFAULT 'handoff',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_task_transfers_task (task_id),
      INDEX idx_task_transfers_to_year (to_soldier_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await ensureColumn('task_transfers', 'transfer_type', "VARCHAR(20) NOT NULL DEFAULT 'handoff'");
  await pool.execute("UPDATE tasks SET review_status = 'approved' WHERE status = 'выполнена' AND review_status <> 'approved'");
}

module.exports = migrate;
