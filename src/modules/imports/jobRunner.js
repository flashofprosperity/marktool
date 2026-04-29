const fs = require('fs');
const path = require('path');
const repository = require('./repository');
const { runXmlToExcel } = require('./xmlConverter');
const { parseExcelToRows } = require('./excelParser');
const { buildProjectFromRows } = require('../projects/projectBuilder');
const projectsService = require('../projects/service');
const { getJobWorkDir } = require('./upload');
const { validateName } = require('../projects/model');

const queue = [];
let activeCount = 0;
const concurrency = Math.max(1, Number(process.env.IMPORT_CONCURRENCY || 1));

function enqueueXmlImport(jobId, options = {}) {
  queue.push({ jobId, options });
  drainQueue();
}

function drainQueue() {
  while (activeCount < concurrency && queue.length > 0) {
    const next = queue.shift();
    activeCount += 1;
    processXmlImport(next.jobId, next.options)
      .catch(error => {
        console.error(`Import job ${next.jobId} failed unexpectedly:`, error);
      })
      .finally(() => {
        activeCount -= 1;
        drainQueue();
      });
  }
}

async function processXmlImport(jobId, options) {
  const startedAt = Date.now();
  try {
    const job = repository.getImportJob(jobId);
    if (!job) throw new Error(`导入任务不存在：${jobId}`);

    const workDir = getJobWorkDir(jobId);
    const xmlPath = job.sourceFile || path.join(workDir, 'input.xml');
    const excelPath = path.join(workDir, 'output.xlsx');

    repository.markJobRunning(jobId, '正在调用 Python 转换 XML');
    await runXmlToExcel({ jobWorkDir: workDir, xmlPath, excelPath });

    const outputStat = fs.statSync(excelPath);
    repository.updateJobOutput(jobId, excelPath, outputStat.size);

    repository.updateJobMessage(jobId, '正在解析 Excel');
    const rows = parseExcelToRows(excelPath);

    repository.updateJobMessage(jobId, '正在构建项目');
    const projectData = buildProjectFromRows(rows);
    const name = resolveProjectName(options.name, job.sourceFile);

    repository.updateJobMessage(jobId, '正在写入数据库');
    await projectsService.completeImportAsProject({
      jobId,
      name,
      projectData,
      startedAt
    });
  } catch (error) {
    try {
      repository.markJobFailed(jobId, error.message || error);
    } catch (markError) {
      console.error(`Failed to mark import job ${jobId} failed:`, markError);
    }
  }
}

function resolveProjectName(name, sourceFile) {
  if (name && String(name).trim()) return validateName(name);
  const base = sourceFile ? path.basename(sourceFile).replace(/\.xml$/i, '') : '';
  return validateName(base || `XML 导入项目 ${new Date().toLocaleString()}`);
}

module.exports = {
  enqueueXmlImport
};
