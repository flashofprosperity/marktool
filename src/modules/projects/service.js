const { enqueueDbWrite, runWriteTransaction } = require('../../db/writeQueue');
const { nowIso } = require('../../utils/time');
const repository = require('./repository');
const {
  emptyProjectData,
  validateName,
  validateProjectData,
  parseProjectRow,
  normalizeProjectTags
} = require('./model');
const importRepository = require('../imports/repository');
const { buildProjectFromRows, mergeProjectDataIncrementally } = require('./projectBuilder');

async function listProjects(filters = {}) {
  return repository.listProjects(filters);
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

async function updateProjectTags(id, tagsValue) {
  const tags = normalizeProjectTags(tagsValue);
  return enqueueDbWrite(() => runWriteTransaction(() => {
    const existing = repository.getProjectRow(id);
    if (!existing) {
      const error = new Error('项目不存在');
      error.status = 404;
      throw error;
    }
    const savedTags = repository.setProjectTags(id, tags);
    return {
      id: existing.id,
      name: existing.name,
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
      tags: savedTags
    };
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

async function completeXmlUpdateProject({ jobId, projectId, rows, startedAt }) {
  return enqueueDbWrite(() => runWriteTransaction(() => {
    const existing = repository.getProjectRow(projectId);
    if (!existing) {
      const error = new Error('项目不存在');
      error.status = 404;
      throw error;
    }
    const currentData = JSON.parse(existing.data_json);
    const xmlData = buildProjectFromRows(rows);
    const mergedData = mergeProjectDataIncrementally(currentData, xmlData);
    const timestamp = nowIso();
    const row = repository.updateProject(projectId, existing.name, mergedData, timestamp);
    const durationMs = startedAt ? Date.now() - startedAt : null;
    importRepository.markJobCompleted(jobId, projectId, timestamp, durationMs);
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
  updateProjectTags,
  completeImportAsProject,
  completeXmlUpdateProject
};
