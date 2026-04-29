const { db } = require('../../db');
const { nowIso } = require('../../utils/time');

function toJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    sourceFile: row.source_file,
    outputFile: row.output_file,
    sourceFileSize: row.source_file_size,
    outputFileSize: row.output_file_size,
    projectId: row.project_id,
    message: row.message,
    error: row.error,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms
  };
}

function createImportJob(job) {
  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO import_jobs (
      id, type, status, source_file, output_file, source_file_size, output_file_size,
      project_id, message, error, created_by, created_at, updated_at
    )
    VALUES (?, ?, 'queued', ?, '', ?, 0, NULL, ?, '', ?, ?, ?)
  `).run(
    job.id,
    job.type,
    job.sourceFile,
    job.sourceFileSize || 0,
    job.message || '等待处理',
    job.createdBy || '',
    timestamp,
    timestamp
  );
  return getImportJob(job.id);
}

function getImportJob(id) {
  return toJob(db.prepare('SELECT * FROM import_jobs WHERE id = ?').get(id));
}

function markJobRunning(id, message) {
  const timestamp = nowIso();
  db.prepare(`
    UPDATE import_jobs
    SET status = 'running', message = ?, error = '', updated_at = ?, started_at = COALESCE(started_at, ?)
    WHERE id = ?
  `).run(message || '正在处理', timestamp, timestamp, id);
}

function updateJobMessage(id, message) {
  db.prepare(`
    UPDATE import_jobs
    SET message = ?, updated_at = ?
    WHERE id = ?
  `).run(message, nowIso(), id);
}

function updateJobOutput(id, outputFile, outputFileSize) {
  db.prepare(`
    UPDATE import_jobs
    SET output_file = ?, output_file_size = ?, updated_at = ?
    WHERE id = ?
  `).run(outputFile || '', outputFileSize || 0, nowIso(), id);
}

function markJobCompleted(id, projectId, finishedAt = nowIso(), durationMs = null) {
  db.prepare(`
    UPDATE import_jobs
    SET status = 'completed',
        project_id = ?,
        message = '导入完成',
        error = '',
        updated_at = ?,
        finished_at = ?,
        duration_ms = ?
    WHERE id = ?
  `).run(projectId, finishedAt, finishedAt, durationMs, id);
}

function markJobFailed(id, errorMessage) {
  const timestamp = nowIso();
  const row = db.prepare('SELECT started_at FROM import_jobs WHERE id = ?').get(id);
  const durationMs = row && row.started_at ? Date.now() - new Date(row.started_at).getTime() : null;
  db.prepare(`
    UPDATE import_jobs
    SET status = 'failed',
        message = '导入失败',
        error = ?,
        updated_at = ?,
        finished_at = ?,
        duration_ms = ?
    WHERE id = ?
  `).run(String(errorMessage || '导入失败'), timestamp, timestamp, durationMs, id);
}

function failInterruptedRunningJobs() {
  const timestamp = nowIso();
  db.prepare(`
    UPDATE import_jobs
    SET status = 'failed',
        message = '导入失败',
        error = '服务重启，导入任务中断，未写入项目',
        updated_at = ?,
        finished_at = ?
    WHERE status = 'running'
  `).run(timestamp, timestamp);
}

module.exports = {
  createImportJob,
  getImportJob,
  markJobRunning,
  updateJobMessage,
  updateJobOutput,
  markJobCompleted,
  markJobFailed,
  failInterruptedRunningJobs
};
