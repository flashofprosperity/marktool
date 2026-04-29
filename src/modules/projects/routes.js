const express = require('express');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const service = require('./service');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    res.json({ projects: await service.listProjects() });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const project = await service.createProject(req.body && req.body.name);
    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

router.post('/import', requireAdmin, async (req, res, next) => {
  try {
    const project = await service.importProject(req.body && req.body.name, req.body && req.body.data);
    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const project = await service.getProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const project = await service.updateProject(
      req.params.id,
      req.body && req.body.name,
      req.body && req.body.data
    );
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await service.deleteProject(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
