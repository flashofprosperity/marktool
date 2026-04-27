const fs = require('fs');
const path = require('path');
const express = require('express');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const port = Number(process.env.PORT || 9092);
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const dbPath = path.join(dataDir, 'projects.db');

fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);
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
`);

let dbWriteQueue = Promise.resolve();

const emptyProjectData = {
  image: '',
  tagTypes: [
    { name: 'Station', color: '#E74C3C', icon: './static/station.png' },
    { name: 'Location', color: '#3498DB', icon: './static/location.png' },
    { name: 'Process (name&number)', color: '#2ECC71', icon: './static/process.png' }
  ],
  tags: [],
  materials: [
    {
      name: '物料A',
      abbreviation: 'MA',
      category: '原材料',
      type: 'a料',
      processLinks: []
    }
  ]
};

app.use(express.json({ limit: '100mb' }));
app.use(express.static(rootDir));

function nowIso() {
  return new Date().toISOString();
}

function parseProjectRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    data: JSON.parse(row.data_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function projectSummary(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validateName(name) {
  const value = String(name || '').trim();
  if (!value) {
    const error = new Error('项目名称不能为空');
    error.status = 400;
    throw error;
  }
  return value.slice(0, 120);
}

function validateProjectData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.tagTypes) || !Array.isArray(data.tags)) {
    const error = new Error('项目 JSON 格式无效');
    error.status = 400;
    throw error;
  }
  return data;
}

function enqueueDbWrite(operation) {
  const run = dbWriteQueue.then(operation, operation);
  dbWriteQueue = run.catch(() => {});
  return run;
}

function runWriteTransaction(operation) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  }
}

app.get('/api/projects', (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, created_at, updated_at
    FROM projects
    ORDER BY updated_at DESC, id DESC
  `).all();
  res.json({ projects: rows.map(projectSummary) });
});

app.post('/api/projects', async (req, res, next) => {
  try {
    const name = validateName(req.body && req.body.name);
    const row = await enqueueDbWrite(() => runWriteTransaction(() => {
      const timestamp = nowIso();
      const result = db.prepare(`
        INSERT INTO projects (name, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(name, JSON.stringify(emptyProjectData), timestamp, timestamp);
      return db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    }));
    res.status(201).json({ project: parseProjectRow(row) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects/import', async (req, res, next) => {
  try {
    const name = validateName(req.body && req.body.name);
    const data = validateProjectData(req.body && req.body.data);
    const row = await enqueueDbWrite(() => runWriteTransaction(() => {
      const timestamp = nowIso();
      const result = db.prepare(`
        INSERT INTO projects (name, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(name, JSON.stringify(data), timestamp, timestamp);
      return db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    }));
    res.status(201).json({ project: parseProjectRow(row) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/projects/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }
  res.json({ project: parseProjectRow(row) });
});

app.put('/api/projects/:id', async (req, res, next) => {
  try {
    const data = validateProjectData(req.body && req.body.data);
    const name = req.body && req.body.name ? validateName(req.body.name) : null;
    const updated = await enqueueDbWrite(() => runWriteTransaction(() => {
      const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
      if (!row) {
        const error = new Error('项目不存在');
        error.status = 404;
        throw error;
      }
      const timestamp = nowIso();
      const nextName = name || row.name;
      db.prepare(`
        UPDATE projects
        SET name = ?, data_json = ?, updated_at = ?
        WHERE id = ?
      `).run(nextName, JSON.stringify(data), timestamp, req.params.id);
      return db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    }));
    res.json({ project: parseProjectRow(updated) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/projects/:id', async (req, res, next) => {
  try {
    await enqueueDbWrite(() => runWriteTransaction(() => {
      const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
      if (result.changes === 0) {
        const error = new Error('项目不存在');
        error.status = 404;
        throw error;
      }
    }));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'default.html'));
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error.code === 'SQLITE_BUSY' || error.code === 'SQLITE_LOCKED') {
    res.status(503).json({ error: '数据库繁忙，请稍后重试' });
    return;
  }
  res.status(error.status || 500).json({ error: error.message || '服务器错误' });
});

app.listen(port, () => {
  console.log(`Image annotation server running at http://localhost:${port}`);
});

function shutdown() {
  Promise.resolve(dbWriteQueue)
    .finally(() => {
      try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
        db.close();
      } finally {
        process.exit(0);
      }
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
