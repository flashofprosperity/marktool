const express = require('express');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const service = require('./service');
const importsService = require('../imports/service');
const { uploadXml } = require('../imports/upload');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    res.json({ projects: await service.listProjects({ q: req.query.q, tag: req.query.tag }) });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/tags', requireAdmin, async (req, res, next) => {
  try {
    const project = await service.updateProjectTags(req.params.id, req.body && req.body.tags);
    res.json({ project });
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

router.post('/:id/import-xml', requireAdmin, ensureProjectExists, uploadXml.single('file'), (req, res, next) => {
  try {
    const job = importsService.createXmlImportJob({
      jobId: req.importJobId,
      file: req.file,
      name: req.project.name,
      user: req.user,
      projectId: req.project.id,
      type: 'xml-update'
    });
    res.status(202).json({ jobId: job.id, status: job.status });
  } catch (error) {
    next(error);
  }
});

async function ensureProjectExists(req, res, next) {
  try {
    const project = await service.getProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }
    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
}

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
