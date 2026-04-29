const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { rootDir } = require('../../db');

function runXmlToExcel({ jobWorkDir, xmlPath, excelPath }) {
  const pythonBin = process.env.PYTHON_BIN || 'python3';
  const scriptPath = path.isAbsolute(process.env.XML_TO_EXCEL_SCRIPT || '')
    ? process.env.XML_TO_EXCEL_SCRIPT
    : path.join(rootDir, process.env.XML_TO_EXCEL_SCRIPT || 'scripts/py/export_xls.py');
  const timeoutMs = Number(process.env.IMPORT_TASK_TIMEOUT_MS || 1800000);
  const config = [
    '[files]',
    `input = ${xmlPath}`,
    `output = ${excelPath}`,
    ''
  ].join('\n');
  fs.writeFileSync(path.join(jobWorkDir, 'config.ini'), config);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const child = spawn(pythonBin, [scriptPath], {
      cwd: jobWorkDir,
      shell: false
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Python 转换超时（${timeoutMs}ms）`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Python 转换失败，退出码 ${code}: ${stderr || stdout || '无输出'}`));
        return;
      }
      if (!fs.existsSync(excelPath)) {
        reject(new Error('Python 转换完成但未生成 Excel 文件'));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

module.exports = {
  runXmlToExcel
};
