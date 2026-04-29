const { db } = require('../../db');
const { nowIso } = require('../../utils/time');
const {
  normalizeProjectEventRecords,
  parseProjectRow,
  projectSummary,
  normalizeProjectTags
} = require('./model');

function listProjects(filters = {}) {
  const q = String(filters.q || '').trim().toLowerCase();
  const tag = String(filters.tag || '').trim();
  const rows = db.prepare(`
    SELECT id, name, created_at, updated_at
    FROM projects
    ORDER BY updated_at DESC, id DESC
  `).all();
  return rows.map(row => ({
    ...row,
    tags: getProjectTags(row.id)
  }))
    .filter(row => {
      if (tag && !row.tags.includes(tag)) return false;
      if (!q) return true;
      return row.name.toLowerCase().includes(q)
        || row.tags.some(projectTag => projectTag.toLowerCase().includes(q));
    })
    .map(projectSummary);
}

function getProjectRow(id) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

function getProject(id) {
  return parseProjectRow(getProjectRow(id));
}

function insertProject(name, data, timestamp = nowIso()) {
  normalizeProjectEventRecords(data);
  const result = db.prepare(`
    INSERT INTO projects (name, data_json, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(name, JSON.stringify(data), timestamp, timestamp);
  syncProjectEventRecords(result.lastInsertRowid, data, timestamp);
  return getProjectRow(result.lastInsertRowid);
}

function updateProject(id, name, data, timestamp = nowIso()) {
  normalizeProjectEventRecords(data);
  db.prepare(`
    UPDATE projects
    SET name = ?, data_json = ?, updated_at = ?
    WHERE id = ?
  `).run(name, JSON.stringify(data), timestamp, id);
  syncProjectEventRecords(id, data, timestamp);
  return getProjectRow(id);
}

function deleteProject(id) {
  return db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

function getProjectTags(projectId) {
  return db.prepare(`
    SELECT tag
    FROM project_tags
    WHERE project_id = ?
    ORDER BY tag COLLATE NOCASE ASC
  `).all(projectId).map(row => row.tag);
}

function setProjectTags(projectId, tags, timestamp = nowIso()) {
  const normalized = normalizeProjectTags(tags);
  db.prepare('DELETE FROM project_tags WHERE project_id = ?').run(projectId);
  const insert = db.prepare(`
    INSERT INTO project_tags (project_id, tag, created_at)
    VALUES (?, ?, ?)
  `);
  normalized.forEach(tag => insert.run(projectId, tag, timestamp));
  return normalized;
}

function syncProjectEventRecords(projectId, data, timestamp = nowIso()) {
  const records = normalizeProjectEventRecords(data);
  db.prepare('DELETE FROM project_event_records WHERE project_id = ?').run(projectId);
  const insert = db.prepare(`
    INSERT INTO project_event_records (
      project_id, record_id, line_name, station, location, location_category,
      process, event, event_switch, event_switch_function, process_steps_json, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  records.forEach(record => {
    insert.run(
      projectId,
      record.id,
      record.lineName,
      record.station,
      record.location,
      record.locationCategory,
      record.process,
      record.event,
      record.eventSwitch,
      record.eventSwitchFunction,
      JSON.stringify(record.processSteps),
      timestamp
    );
  });
}

function syncExistingProjectEventRecords() {
  const rows = db.prepare('SELECT id, data_json FROM projects').all();
  rows.forEach(row => {
    try {
      const data = JSON.parse(row.data_json);
      syncProjectEventRecords(row.id, data);
    } catch (error) {
      // Keep startup resilient; invalid project JSON will still fail when opened.
    }
  });
}

module.exports = {
  listProjects,
  getProjectRow,
  getProject,
  insertProject,
  updateProject,
  deleteProject,
  getProjectTags,
  setProjectTags,
  syncProjectEventRecords,
  syncExistingProjectEventRecords
};
