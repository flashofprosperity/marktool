const { enqueueDbWrite, runWriteTransaction } = require('../../db/writeQueue');
const { nowIso } = require('../../utils/time');
const repository = require('./repository');
const {
  emptyProjectData,
  validateName,
  validateProjectData,
  parseProjectRow
} = require('./model');
const importRepository = require('../imports/repository');

async function listProjects() {
  return repository.listProjects();
}

async function createProject(nameValue) {
  const name = validateName(nameValue);
  const row = await enqueueDbWrite(() => runWriteTransaction(() => {
    const data = JSON.parse(JSON.stringify(emptyProjectData));
    return repository.insertProject(name, data);
  }));
  return parseProjectRow(row);
}

async function importProject(nameValue, dataValue) {
  const name = validateName(nameValue);
  const data = validateProjectData(dataValue);
  const row = await enqueueDbWrite(() => runWriteTransaction(() => {
    return repository.insertProject(name, data);
  }));
  return parseProjectRow(row);
}

async function getProject(id) {
  return repository.getProject(id);
}

async function updateProject(id, nameValue, dataValue) {
  const data = validateProjectData(dataValue);
  const row = await enqueueDbWrite(() => runWriteTransaction(() => {
    const existing = repository.getProjectRow(id);
    if (!existing) {
      const error = new Error('项目不存在');
      error.status = 404;
      throw error;
    }
    const name = nameValue ? validateName(nameValue) : existing.name;
    return repository.updateProject(id, name, data);
  }));
  return parseProjectRow(row);
}

async function deleteProject(id) {
  await enqueueDbWrite(() => runWriteTransaction(() => {
    const result = repository.deleteProject(id);
    if (result.changes === 0) {
      const error = new Error('项目不存在');
      error.status = 404;
      throw error;
    }
  }));
}

async function completeImportAsProject({ jobId, name, projectData, startedAt }) {
  const projectName = validateName(name);
  return enqueueDbWrite(() => runWriteTransaction(() => {
    const timestamp = nowIso();
    const row = repository.insertProject(projectName, projectData, timestamp);
    const durationMs = startedAt ? Date.now() - startedAt : null;
    importRepository.markJobCompleted(jobId, row.id, timestamp, durationMs);
    return parseProjectRow(row);
  }));
}

module.exports = {
  listProjects,
  createProject,
  importProject,
  getProject,
  updateProject,
  deleteProject,
  completeImportAsProject
};
