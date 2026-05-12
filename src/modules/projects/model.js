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
      category: 'raw material-A',
      type: 'a料',
      primaryTagValue: '',
      primaryIdType: 'lot',
      primaryIdGeneration: 'null',
      image: '',
      x: null,
      y: null,
      width: 0.12,
      height: 0.08,
      locationLinks: []
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
    module: step && step.module !== undefined && step.module !== null ? String(step.module) : '',
    command: step && step.command !== undefined && step.command !== null ? String(step.command) : '',
    commandTemplateName: step && step.commandTemplateName !== undefined && step.commandTemplateName !== null ? String(step.commandTemplateName) : '',
    functionDescription: step && step.functionDescription !== undefined && step.functionDescription !== null ? String(step.functionDescription) : ''
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
    eventSwitchReplyRequired: normalizeReplyRequired(record && record.eventSwitchReplyRequired),
    eventSwitchFunction: record && record.eventSwitchFunction ? String(record.eventSwitchFunction) : '',
    processSteps: normalizeProcessSteps(record && record.processSteps)
  };
}

function normalizeReplyRequired(value) {
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === 'false' ? normalized : '';
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
    updatedAt: row.updated_at,
    tags: Array.isArray(row.tags) ? row.tags : []
  };
}

function normalizeProjectTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const normalized = [];
  tags.forEach(tag => {
    const value = String(tag || '').trim().slice(0, 40);
    if (!value || seen.has(value)) return;
    seen.add(value);
    normalized.push(value);
  });
  return normalized.slice(0, 20);
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
  projectSummary,
  normalizeProjectTags
};
