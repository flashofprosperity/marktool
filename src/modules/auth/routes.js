const express = require('express');
const authService = require('./service');

const router = express.Router();

router.post('/login', (req, res, next) => {
  try {
    const result = authService.login(req.body && req.body.username, req.body && req.body.password);
    authService.setSessionCookie(res, result.token);
    res.json({ user: result.user });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  authService.logout(req.sessionToken);
  authService.clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: req.user || null });
});

module.exports = router;
