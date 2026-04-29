const fs = require('fs');
const repository = require('./repository');
const { enqueueXmlImport } = require('./jobRunner');

function createXmlImportJob({ jobId, file, name, user, projectId = null, type = 'xml' }) {
  if (!file) {
    const error = new Error('请选择 XML 文件');
    error.status = 400;
    throw error;
  }
  const stat = fs.statSync(file.path);
  const job = repository.createImportJob({
    id: jobId,
    type,
    sourceFile: file.path,
    sourceFileSize: stat.size,
    projectId,
    message: '等待处理',
    createdBy: user && user.username ? user.username : ''
  });
  enqueueXmlImport(job.id, { name, projectId, type });
  return job;
}

function getImportJob(id) {
  return repository.getImportJob(id);
}

function failInterruptedRunningJobs() {
  repository.failInterruptedRunningJobs();
}

module.exports = {
  createXmlImportJob,
  getImportJob,
  failInterruptedRunningJobs
};
