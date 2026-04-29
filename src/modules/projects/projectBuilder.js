const crypto = require('crypto');
const { emptyProjectData } = require('./model');

function buildProjectFromRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error('Excel 没有可导入的数据');
    error.status = 400;
    throw error;
  }

  const project = {
    image: '',
    tagTypes: emptyProjectData.tagTypes.map(type => ({ ...type })),
    tags: [],
    eventRecords: [],
    materials: emptyProjectData.materials.map(material => ({ ...material }))
  };
  const stationTypeIndex = 0;
  const locationTypeIndex = 1;
  const eventTypeIndex = 2;
  const stationMap = new Map();
  let tagId = Date.now();

  function nextTagId() {
    tagId += 1;
    return tagId;
  }

  rows.forEach(row => {
    const stationName = clean(row.station);
    const locationName = clean(row.location);
    if (!stationName || !locationName) return;

    let stationTag = stationMap.get(stationName);
    if (!stationTag) {
      stationTag = {
        id: nextTagId(),
        typeIndex: stationTypeIndex,
        text: stationName,
        x: null,
        y: null,
        children: []
      };
      stationTag._locationMap = new Map();
      stationMap.set(stationName, stationTag);
      project.tags.push(stationTag);
    }

    let locationTag = stationTag._locationMap.get(locationName);
    if (!locationTag) {
      locationTag = {
        id: nextTagId(),
        typeIndex: locationTypeIndex,
        text: locationName,
        x: null,
        y: null,
        locationCategory: row.locationCategory === 'equipment' ? 'equipment' : 'process',
        children: [],
        _eventMap: new Map()
      };
      stationTag._locationMap.set(locationName, locationTag);
      stationTag.children.push(locationTag);
    }

    const eventName = clean(row.event);
    if (!eventName) return;

    const eventKey = [
      eventName,
      clean(row.eventSwitch),
      clean(row.eventSwitchResponse),
      clean(row.eventSwitchPostfix)
    ].join('\u001f');
    let eventTag = locationTag._eventMap.get(eventKey);
    if (!eventTag) {
      const recordId = `event-${crypto.randomUUID()}`;
      eventTag = {
        id: nextTagId(),
        typeIndex: eventTypeIndex,
        text: eventName,
        x: null,
        y: null,
        eventRecordId: recordId,
        children: []
      };
      locationTag._eventMap.set(eventKey, eventTag);
      locationTag.children.push(eventTag);
      project.eventRecords.push({
        id: recordId,
        lineName: clean(row.lineName),
        station: stationName,
        location: locationName,
        locationCategory: locationTag.locationCategory,
        process: clean(row.process),
        event: eventName,
        eventSwitch: clean(row.eventSwitch),
        eventSwitchFunction: buildEventSwitchFunction(row),
        processSteps: []
      });
    }

    const record = project.eventRecords.find(item => item.id === eventTag.eventRecordId);
    const step = buildProcessStep(row);
    if (step && record) record.processSteps.push(step);
  });

  project.tags.forEach(station => {
    station.children.forEach(location => {
      delete location._eventMap;
    });
    delete station._locationMap;
  });

  if (project.tags.length === 0) {
    const error = new Error('Excel 缺少可导入的 Station 或 Location 数据');
    error.status = 400;
    throw error;
  }

  return project;
}

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function buildEventSwitchFunction(row) {
  return [
    clean(row.eventSwitchResponse),
    clean(row.eventSwitchPostfix)
  ].filter(Boolean).join(' ');
}

function buildProcessStep(row) {
  const step = {
    processStep: clean(row.processStep),
    processStepName: clean(row.processApplication),
    constraint: clean(row.constraint),
    command: clean(row.command),
    commandTemplateName: clean(row.commandTemplateName)
  };
  return Object.values(step).some(Boolean) ? step : null;
}

module.exports = {
  buildProjectFromRows
};
