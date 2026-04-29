const { db } = require('../../db');

function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function insertUser(user) {
  db.prepare(`
    INSERT INTO users (username, password_hash, password_salt, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(user.username, user.passwordHash, user.passwordSalt, user.role, user.createdAt);
}

module.exports = {
  findUserByUsername,
  insertUser
};
