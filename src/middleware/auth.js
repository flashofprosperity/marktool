const authService = require('../modules/auth/service');

function attachUser(req, res, next) {
  const session = authService.readSession(req.headers.cookie || '');
  req.sessionToken = session.sessionToken;
  req.user = session.user;
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

module.exports = {
  attachUser,
  requireAuth,
  requireAdmin
};
