const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const port = Number(process.env.PORT || 9092);
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const dbPath = path.join(dataDir, 'projects.db');
const credentialsPath = path.join(dataDir, 'user-credentials.txt');
const sessionCookieName = 'marktool_session';
const sessionSecret = process.env.SESSION_SECRET || 'marktool-local-session-secret';

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
    event_switch INTEGER NOT NULL DEFAULT 0,
    event_switch_function TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    UNIQUE (project_id, record_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_project_event_records_project_id
    ON project_event_records(project_id);
`);

let dbWriteQueue = Promise.resolve();
const sessions = new Map();
const builtInUsers = [
  { username: 'mes', password: 'mesedit', role: 'user' },
  { username: 'admin', password: 'mesmanager', role: 'admin' }
];

const emptyProjectData = {
  image: '',
  tagTypes: [
    { name: 'Station', color: '#c92a2a', icon: './static/icons/station.svg' },
    { name: 'Location', color: '#005f99', icon: './static/icons/location.svg' },
    { name: 'Process (name&number)', color: '#087f5b', icon: './static/icons/process.svg' },
    { name: 'Event', color: '#b7791f', icon: './static/icons/event.svg' }
  ],
  tags: [],
  eventRecords: [],
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
app.use('/data', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});
app.use(express.static(rootDir));

initializeUsers();
ensureCredentialReminder();
syncExistingProjectEventRecords();

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

function normalizeEventSwitch(value) {
  if (value === true) return 1;
  if (value === false || value === null || value === undefined || value === '') return 0;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeEventRecord(record) {
  return {
    id: record && record.id ? String(record.id) : crypto.randomUUID(),
    lineName: record && record.lineName ? String(record.lineName) : '',
    station: record && record.station ? String(record.station) : '',
    location: record && record.location ? String(record.location) : '',
    locationCategory: record && record.locationCategory === 'equipment' ? 'equipment' : 'process',
    process: record && record.process ? String(record.process) : '',
    event: record && record.event ? String(record.event) : '',
    eventSwitch: normalizeEventSwitch(record && record.eventSwitch),
    eventSwitchFunction: record && record.eventSwitchFunction ? String(record.eventSwitchFunction) : ''
  };
}

function normalizeProjectEventRecords(data) {
  const normalized = Array.isArray(data.eventRecords)
    ? data.eventRecords.map(normalizeEventRecord)
    : [];
  data.eventRecords = normalized;
  return normalized;
}

function syncProjectEventRecords(projectId, data, timestamp = nowIso()) {
  const records = normalizeProjectEventRecords(data);
  db.prepare('DELETE FROM project_event_records WHERE project_id = ?').run(projectId);
  const insert = db.prepare(`
    INSERT INTO project_event_records (
      project_id, record_id, line_name, station, location, location_category,
      process, event, event_switch, event_switch_function, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    salt,
    hash: hashPassword(password, salt)
  };
}

function verifyPassword(password, user) {
  const expected = Buffer.from(user.password_hash, 'hex');
  const actual = Buffer.from(hashPassword(password, user.password_salt), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function initializeUsers() {
  const existing = db.prepare('SELECT username FROM users WHERE username = ?');
  const insert = db.prepare(`
    INSERT INTO users (username, password_hash, password_salt, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  builtInUsers.forEach(user => {
    if (existing.get(user.username)) return;
    const record = createPasswordRecord(user.password);
    insert.run(user.username, record.hash, record.salt, user.role, nowIso());
  });
}

function ensureCredentialReminder() {
  if (fs.existsSync(credentialsPath)) return;
  const content = [
    'Mark Tool built-in accounts',
    '',
    'username: mes',
    'password: mesedit',
    'role: user',
    '',
    'username: admin',
    'password: mesmanager',
    'role: admin',
    ''
  ].join('\n');
  fs.writeFileSync(credentialsPath, content, { mode: 0o600 });
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index === -1) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role
  };
}

function signSessionId(sessionId) {
  return crypto.createHmac('sha256', sessionSecret).update(sessionId).digest('base64url');
}

function encodeSessionToken(sessionId) {
  return `${sessionId}.${signSessionId(sessionId)}`;
}

function decodeSessionToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const [sessionId, signature] = parts;
  const expected = signSessionId(sessionId);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer) ? sessionId : null;
}

function createSession(user) {
  const sessionId = crypto.randomBytes(32).toString('base64url');
  sessions.set(sessionId, {
    user: publicUser(user),
    createdAt: Date.now()
  });
  return encodeSessionToken(sessionId);
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function attachUser(req, res, next) {
  const token = parseCookies(req)[sessionCookieName];
  const sessionId = decodeSessionToken(token);
  const session = sessionId ? sessions.get(sessionId) : null;
  req.sessionToken = sessionId || null;
  req.user = session ? session.user : null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: '请先登录' });
    return;
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: '请先登录' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: '权限不足' });
    return;
  }
  next();
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

app.use(attachUser);

app.post('/api/login', (req, res) => {
  const username = String(req.body && req.body.username || '').trim();
  const password = String(req.body && req.body.password || '');
  const user = username ? db.prepare('SELECT * FROM users WHERE username = ?').get(username) : null;
  if (!user || !verifyPassword(password, user)) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }
  const token = createSession(user);
  setSessionCookie(res, token);
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  if (req.sessionToken) sessions.delete(req.sessionToken);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.user || null });
});

app.get('/api/projects', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, created_at, updated_at
    FROM projects
    ORDER BY updated_at DESC, id DESC
  `).all();
  res.json({ projects: rows.map(projectSummary) });
});

app.post('/api/projects', requireAdmin, async (req, res, next) => {
  try {
    const name = validateName(req.body && req.body.name);
    const row = await enqueueDbWrite(() => runWriteTransaction(() => {
      const timestamp = nowIso();
      const result = db.prepare(`
        INSERT INTO projects (name, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(name, JSON.stringify(emptyProjectData), timestamp, timestamp);
      syncProjectEventRecords(result.lastInsertRowid, emptyProjectData, timestamp);
      return db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    }));
    res.status(201).json({ project: parseProjectRow(row) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects/import', requireAdmin, async (req, res, next) => {
  try {
    const name = validateName(req.body && req.body.name);
    const data = validateProjectData(req.body && req.body.data);
    const row = await enqueueDbWrite(() => runWriteTransaction(() => {
      const timestamp = nowIso();
      normalizeProjectEventRecords(data);
      const result = db.prepare(`
        INSERT INTO projects (name, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(name, JSON.stringify(data), timestamp, timestamp);
      syncProjectEventRecords(result.lastInsertRowid, data, timestamp);
      return db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    }));
    res.status(201).json({ project: parseProjectRow(row) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/projects/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }
  res.json({ project: parseProjectRow(row) });
});

app.put('/api/projects/:id', requireAuth, async (req, res, next) => {
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
      normalizeProjectEventRecords(data);
      db.prepare(`
        UPDATE projects
        SET name = ?, data_json = ?, updated_at = ?
        WHERE id = ?
      `).run(nextName, JSON.stringify(data), timestamp, req.params.id);
      syncProjectEventRecords(req.params.id, data, timestamp);
      return db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    }));
    res.json({ project: parseProjectRow(updated) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/projects/:id', requireAdmin, async (req, res, next) => {
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
