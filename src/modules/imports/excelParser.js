const xlsx = require('xlsx');

const columnMap = {
  lineName: ['Line Name'],
  station: ['Station No.', 'Station', '工位'],
  stationNamePostfix: ['Station Name (Postfix)'],
  location: ['LocationID', 'Location', '位置'],
  event: ['Event Name', 'Event', '事件'],
  eventSwitch: ['EventSwitch', 'Event switch'],
  eventSwitchResponse: ['EventSwitch Response'],
  eventSwitchPostfix: ['Event Switch Postfix'],
  constraint: ['Processing Step Constraint'],
  process: ['Processing Step (Process Module)', 'Process'],
  processApplication: ['Processing Step (Application)'],
  processStep: ['Processing Step (Execution Step)', 'Process Step'],
  command: ['Processing Step Command', 'Command'],
  commandTemplateName: ['Command Template Name']
};

function parseExcelToRows(excelPath) {
  const workbook = xlsx.readFile(excelPath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    const error = new Error('Excel 文件没有工作表');
    error.status = 400;
    throw error;
  }
  const sheet = workbook.Sheets[sheetName];
  const records = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  if (records.length === 0) {
    const error = new Error('Excel 没有可导入的数据');
    error.status = 400;
    throw error;
  }

  const headers = Object.keys(records[0] || {});
  const resolved = resolveColumns(headers);
  if (!resolved.station || !resolved.location) {
    const error = new Error('Excel 缺少必要列：Station No. 或 LocationID');
    error.status = 400;
    throw error;
  }

  const rows = records.map(record => {
    const row = {};
    Object.keys(columnMap).forEach(key => {
      row[key] = resolved[key] ? clean(record[resolved[key]]) : '';
    });
    return row;
  }).filter(row => row.station && row.location);

  if (rows.length === 0) {
    const error = new Error('Excel 没有包含 Station 和 Location 的可导入行');
    error.status = 400;
    throw error;
  }

  return rows;
}

function resolveColumns(headers) {
  return Object.entries(columnMap).reduce((result, [key, aliases]) => {
    result[key] = aliases.find(alias => headers.includes(alias)) || '';
    return result;
  }, {});
}

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

module.exports = {
  parseExcelToRows,
  columnMap
};
