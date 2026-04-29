const crypto = require('crypto');

const emptyProjectData = {
  image: '',
  tagTypes: [
    { name: 'Station', color: '#c92a2a', icon: './static/icons/station.svg' },
    { name: 'Location', color: '#005f99', icon: './static/icons/location.svg' },
    { name: 'Event', color: '#b7791f', icon: './static/icons/event.svg' }
  ],
  tags: [],
  eventRecords: [],
  materials: [
    {
      name: '物料A',
      abbreviation: 'MA',
      category: '原材料',
      type: 'a料'
    }
  ]
};

function validateName(name) {
  const value = String(name || '').trim();
  if (!value) {
    const error = new Error('项目名称不能为空');
    error.status = 400;
    throw error;
  }
  return value.slice(0, 120);
}

function validateProjectData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.tagTypes) || !Array.isArray(data.tags)) {
    const error = new Error('项目 JSON 格式无效');
    error.status = 400;
    throw error;
  }
  return data;
}

function normalizeEventSwitch(value) {
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizeProcessSteps(value) {
  if (!Array.isArray(value)) return [];
  return value.map(step => ({
    processStep: step && step.processStep !== undefined && step.processStep !== null ? String(step.processStep) : '',
    processStepName: step && step.processStepName !== undefined && step.processStepName !== null ? String(step.processStepName) : '',
    constraint: step && step.constraint !== undefined && step.constraint !== null ? String(step.constraint) : '',
    command: step && step.command !== undefined && step.command !== null ? String(step.command) : '',
    commandTemplateName: step && step.commandTemplateName !== undefined && step.commandTemplateName !== null ? String(step.commandTemplateName) : ''
  }));
}

function normalizeEventRecord(record) {
  return {
    id: record && record.id ? String(record.id) : crypto.randomUUID(),
    lineName: record && record.lineName ? String(record.lineName) : '',
    station: record && record.station ? String(record.station) : '',
    location: record && record.location ? String(record.location) : '',
    locationCategory: record && record.locationCategory === 'equipment' ? 'equipment' : 'process',
    process: record && record.process ? String(record.process) : '',
    event: record && record.event ? String(record.event) : '',
    eventSwitch: normalizeEventSwitch(record && record.eventSwitch),
    eventSwitchFunction: record && record.eventSwitchFunction ? String(record.eventSwitchFunction) : '',
    processSteps: normalizeProcessSteps(record && record.processSteps)
  };
}

function normalizeProjectEventRecords(data) {
  const normalized = Array.isArray(data.eventRecords)
    ? data.eventRecords.map(normalizeEventRecord)
    : [];
  data.eventRecords = normalized;
  return normalized;
}

function parseProjectRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    data: JSON.parse(row.data_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function projectSummary(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  emptyProjectData,
  validateName,
  validateProjectData,
  normalizeEventSwitch,
  normalizeProcessSteps,
  normalizeEventRecord,
  normalizeProjectEventRecords,
  parseProjectRow,
  projectSummary
};
