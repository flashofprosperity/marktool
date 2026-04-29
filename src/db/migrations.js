const { db } = require('./index');

function runMigrations() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_event_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      record_id TEXT NOT NULL,
      line_name TEXT NOT NULL DEFAULT '',
      station TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      location_category TEXT NOT NULL CHECK (location_category IN ('equipment', 'process')) DEFAULT 'process',
      process TEXT NOT NULL DEFAULT '',
      event TEXT NOT NULL DEFAULT '',
      event_switch TEXT NOT NULL DEFAULT '',
      event_switch_function TEXT NOT NULL DEFAULT '',
      process_steps_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL,
      UNIQUE (project_id, record_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_project_event_records_project_id
      ON project_event_records(project_id);
    CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
      source_file TEXT NOT NULL DEFAULT '',
      output_file TEXT NOT NULL DEFAULT '',
      source_file_size INTEGER NOT NULL DEFAULT 0,
      output_file_size INTEGER NOT NULL DEFAULT 0,
      project_id INTEGER,
      message TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      duration_ms INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS project_tags (
      project_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (project_id, tag),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_project_tags_tag
      ON project_tags(tag);
  `);
  ensureEventRecordTableShape();
}

function ensureEventRecordTableShape() {
  const columns = db.prepare('PRAGMA table_info(project_event_records)').all();
  const eventSwitchColumn = columns.find(column => column.name === 'event_switch');
  const hasProcessSteps = columns.some(column => column.name === 'process_steps_json');

  if (!hasProcessSteps) {
    db.exec("ALTER TABLE project_event_records ADD COLUMN process_steps_json TEXT NOT NULL DEFAULT '[]'");
  }

  if (eventSwitchColumn && String(eventSwitchColumn.type || '').toUpperCase() !== 'TEXT') {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      ALTER TABLE project_event_records RENAME TO project_event_records_old;
      CREATE TABLE project_event_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        record_id TEXT NOT NULL,
        line_name TEXT NOT NULL DEFAULT '',
        station TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        location_category TEXT NOT NULL CHECK (location_category IN ('equipment', 'process')) DEFAULT 'process',
        process TEXT NOT NULL DEFAULT '',
        event TEXT NOT NULL DEFAULT '',
        event_switch TEXT NOT NULL DEFAULT '',
        event_switch_function TEXT NOT NULL DEFAULT '',
        process_steps_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        UNIQUE (project_id, record_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      INSERT INTO project_event_records (
        id, project_id, record_id, line_name, station, location, location_category,
        process, event, event_switch, event_switch_function, process_steps_json, updated_at
      )
      SELECT
        id, project_id, record_id, line_name, station, location, location_category,
        process, event, CAST(event_switch AS TEXT), event_switch_function,
        COALESCE(process_steps_json, '[]'), updated_at
      FROM project_event_records_old;
      DROP TABLE project_event_records_old;
      CREATE INDEX IF NOT EXISTS idx_project_event_records_project_id
        ON project_event_records(project_id);
      PRAGMA foreign_keys = ON;
    `);
  }
}

module.exports = {
  runMigrations
};
