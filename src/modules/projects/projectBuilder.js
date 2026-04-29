const crypto = require('crypto');
const { emptyProjectData } = require('./model');

function buildProjectFromRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error('XML 没有可导入的数据');
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
    const error = new Error('XML 缺少可导入的 Station 或 Location 数据');
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

function mergeProjectDataIncrementally(currentData, xmlData) {
  const merged = cloneProjectData(currentData);
  if (!Array.isArray(merged.tagTypes) || merged.tagTypes.length === 0) {
    merged.tagTypes = emptyProjectData.tagTypes.map(type => ({ ...type }));
  }
  if (!Array.isArray(merged.tags)) merged.tags = [];
  if (!Array.isArray(merged.eventRecords)) merged.eventRecords = [];
  if (!Array.isArray(merged.materials)) {
    merged.materials = emptyProjectData.materials.map(material => ({ ...material }));
  }

  const typeMap = buildTypeMap(merged.tagTypes);
  const existingStationMap = new Map();
  merged.tags.forEach(station => {
    existingStationMap.set(clean(station.text), station);
  });
  let nextId = findMaxNumericTagId(merged.tags);

  (Array.isArray(xmlData.tags) ? xmlData.tags : []).forEach(xmlStation => {
    const stationName = clean(xmlStation.text);
    if (!stationName) return;
    let targetStation = existingStationMap.get(stationName);
    if (!targetStation) {
      targetStation = cloneTagForAppend(xmlStation, typeMap, () => {
        nextId += 1;
        return nextId;
      });
      merged.tags.push(targetStation);
      existingStationMap.set(stationName, targetStation);
      appendEventRecordsForBranch(merged, xmlData, targetStation, xmlStation);
      return;
    }

    if (!Array.isArray(targetStation.children)) targetStation.children = [];
    const existingLocationMap = new Map();
    targetStation.children.forEach(location => {
      existingLocationMap.set(clean(location.text), location);
    });

    (Array.isArray(xmlStation.children) ? xmlStation.children : []).forEach(xmlLocation => {
      const locationName = clean(xmlLocation.text);
      if (!locationName) return;
      let targetLocation = existingLocationMap.get(locationName);
      if (!targetLocation) {
        targetLocation = cloneTagForAppend(xmlLocation, typeMap, () => {
          nextId += 1;
          return nextId;
        });
        targetStation.children.push(targetLocation);
        existingLocationMap.set(locationName, targetLocation);
        appendEventRecordsForBranch(merged, xmlData, targetLocation, xmlLocation);
        return;
      }

      if (!Array.isArray(targetLocation.children)) targetLocation.children = [];
      const existingEventMap = new Map();
      targetLocation.children.forEach(eventTag => {
        existingEventMap.set(eventMergeKey(merged, eventTag), eventTag);
      });

      (Array.isArray(xmlLocation.children) ? xmlLocation.children : []).forEach(xmlEvent => {
        const xmlRecord = findEventRecord(xmlData, xmlEvent.eventRecordId);
        const key = eventMergeKey(xmlData, xmlEvent, xmlRecord);
        if (existingEventMap.has(key)) return;
        const targetEvent = cloneTagForAppend(xmlEvent, typeMap, () => {
          nextId += 1;
          return nextId;
        });
        targetLocation.children.push(targetEvent);
        existingEventMap.set(key, targetEvent);
        if (xmlRecord) merged.eventRecords.push({ ...xmlRecord });
      });
    });
  });

  return merged;
}

function cloneProjectData(data) {
  return JSON.parse(JSON.stringify(data || {}));
}

function buildTypeMap(tagTypes) {
  const station = getTypeIndex(tagTypes, 'Station', 0);
  const location = getTypeIndex(tagTypes, 'Location', 1);
  const event = getTypeIndex(tagTypes, 'Event', 2);
  return new Map([[0, station], [1, location], [2, event]]);
}

function getTypeIndex(tagTypes, name, fallback) {
  const index = tagTypes.findIndex(type => type && String(type.name || '').includes(name));
  if (index !== -1) return index;
  tagTypes.push({ ...emptyProjectData.tagTypes[fallback] });
  return tagTypes.length - 1;
}

function findMaxNumericTagId(tagList) {
  let maxId = Date.now();
  flattenTags(tagList).forEach(tag => {
    const value = Number(tag.id);
    if (Number.isFinite(value)) maxId = Math.max(maxId, value);
  });
  return maxId;
}

function flattenTags(tagList, result = []) {
  (Array.isArray(tagList) ? tagList : []).forEach(tag => {
    result.push(tag);
    if (Array.isArray(tag.children)) flattenTags(tag.children, result);
  });
  return result;
}

function cloneTagForAppend(tag, typeMap, nextId) {
  const cloned = JSON.parse(JSON.stringify(tag));
  rewriteTagForAppend(cloned, typeMap, nextId);
  return cloned;
}

function rewriteTagForAppend(tag, typeMap, nextId) {
  tag.id = nextId();
  if (typeMap.has(tag.typeIndex)) tag.typeIndex = typeMap.get(tag.typeIndex);
  tag.x = null;
  tag.y = null;
  if (!Array.isArray(tag.children)) tag.children = [];
  tag.children.forEach(child => rewriteTagForAppend(child, typeMap, nextId));
}

function appendEventRecordsForBranch(merged, xmlData, mergedBranch, xmlBranch) {
  const xmlRecordIds = new Set();
  flattenTags([xmlBranch]).forEach(tag => {
    if (tag.eventRecordId) xmlRecordIds.add(tag.eventRecordId);
  });
  const mergedRecordIds = new Set();
  flattenTags([mergedBranch]).forEach(tag => {
    if (tag.eventRecordId) mergedRecordIds.add(tag.eventRecordId);
  });
  xmlRecordIds.forEach(recordId => {
    const record = findEventRecord(xmlData, recordId);
    if (record && mergedRecordIds.has(recordId)) merged.eventRecords.push({ ...record });
  });
}

function findEventRecord(data, recordId) {
  if (!recordId || !Array.isArray(data.eventRecords)) return null;
  return data.eventRecords.find(record => record.id === recordId) || null;
}

function eventMergeKey(data, eventTag, record = null) {
  const eventRecord = record || findEventRecord(data, eventTag && eventTag.eventRecordId);
  return [
    clean(eventTag && eventTag.text),
    clean(eventRecord && eventRecord.eventSwitch)
  ].join('\u001f');
}

module.exports = {
  buildProjectFromRows,
  mergeProjectDataIncrementally
};
