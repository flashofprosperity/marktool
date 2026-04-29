const express = require('express');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const service = require('./service');
const { uploadXml } = require('./upload');

const router = express.Router();

router.post('/xml', requireAdmin, uploadXml.single('file'), (req, res, next) => {
  try {
    const job = service.createXmlImportJob({
      jobId: req.importJobId,
      file: req.file,
      name: req.body && req.body.name,
      user: req.user
    });
    res.status(202).json({ jobId: job.id, status: job.status });
  } catch (error) {
    next(error);
  }
});

router.get('/:jobId', requireAuth, (req, res, next) => {
  try {
    const job = service.getImportJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: '导入任务不存在' });
      return;
    }
    res.json({ job });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
