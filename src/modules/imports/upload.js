const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { tempUploadsDir } = require('../../db');
const { ensureDir } = require('../../utils/files');

const maxFileMb = Number(process.env.IMPORT_MAX_FILE_MB || 200);
const jobsDir = path.join(tempUploadsDir, 'jobs');

function getJobId(req) {
  if (!req.importJobId) req.importJobId = crypto.randomUUID();
  return req.importJobId;
}

function getJobWorkDir(jobId) {
  return path.join(jobsDir, jobId);
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const workDir = getJobWorkDir(getJobId(req));
    ensureDir(workDir);
    cb(null, workDir);
  },
  filename(req, file, cb) {
    cb(null, 'input.xml');
  }
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext !== '.xml') {
    const error = new Error('仅支持 XML 文件');
    error.status = 400;
    cb(error);
    return;
  }
  cb(null, true);
}

const uploadXml = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileMb * 1024 * 1024
  }
});

module.exports = {
  uploadXml,
  getJobWorkDir,
  jobsDir,
  maxFileMb
};
