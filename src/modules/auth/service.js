const fs = require('fs');
const crypto = require('crypto');
const { credentialsPath } = require('../../db');
const { nowIso } = require('../../utils/time');
const repository = require('./repository');

const sessionCookieName = 'marktool_session';
const sessionSecret = process.env.SESSION_SECRET || 'marktool-local-session-secret';
const sessions = new Map();
const builtInUsers = [
  { username: 'mes', password: 'mesedit', role: 'user' },
  { username: 'admin', password: 'mesmanager', role: 'admin' }
];

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
  builtInUsers.forEach(user => {
    if (repository.findUserByUsername(user.username)) return;
    const record = createPasswordRecord(user.password);
    repository.insertUser({
      username: user.username,
      passwordHash: record.hash,
      passwordSalt: record.salt,
      role: user.role,
      createdAt: nowIso()
    });
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

function parseCookies(header) {
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

function readSession(cookieHeader) {
  const token = parseCookies(cookieHeader)[sessionCookieName];
  const sessionId = decodeSessionToken(token);
  const session = sessionId ? sessions.get(sessionId) : null;
  return {
    sessionToken: sessionId || null,
    user: session ? session.user : null
  };
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function login(usernameValue, password) {
  const username = String(usernameValue || '').trim();
  const user = username ? repository.findUserByUsername(username) : null;
  if (!user || !verifyPassword(String(password || ''), user)) {
    const error = new Error('用户名或密码错误');
    error.status = 401;
    throw error;
  }
  return {
    token: createSession(user),
    user: publicUser(user)
  };
}

function logout(sessionToken) {
  if (sessionToken) sessions.delete(sessionToken);
}

module.exports = {
  initializeUsers,
  ensureCredentialReminder,
  readSession,
  setSessionCookie,
  clearSessionCookie,
  login,
  logout
};
