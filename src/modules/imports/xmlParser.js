const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');

function parseXmlToRows(xmlPath) {
  const xml = decodeXmlFile(xmlPath);
  const parser = new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false
  });
  const parsed = parser.parse(xml);
  const root = parsed && (parsed.OpConData || parsed.opcondata);
  if (!root || typeof root !== 'object') {
    const error = new Error('XML 根节点无效，未找到 OpConData');
    error.status = 400;
    throw error;
  }

  const lookups = buildLookups(root);
  const rows = buildRows(lookups);
  if (rows.length === 0) {
    const error = new Error('XML 没有可导入的数据');
    error.status = 400;
    throw error;
  }
  return rows;
}

function decodeXmlFile(xmlPath) {
  const buffer = fs.readFileSync(xmlPath);
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return stripBom(buffer.toString('utf16le'));
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return stripBom(swapUtf16Bytes(buffer).toString('utf16le'));
  }
  if (looksLikeUtf16Le(buffer)) {
    return stripBom(buffer.toString('utf16le'));
  }
  return stripBom(buffer.toString('utf8'));
}

function looksLikeUtf16Le(buffer) {
  const sampleLength = Math.min(buffer.length, 200);
  let oddNulls = 0;
  for (let i = 1; i < sampleLength; i += 2) {
    if (buffer[i] === 0) oddNulls += 1;
  }
  return oddNulls > sampleLength / 4;
}

function swapUtf16Bytes(buffer) {
  const copy = Buffer.from(buffer);
  for (let i = 0; i + 1 < copy.length; i += 2) {
    const first = copy[i];
    copy[i] = copy[i + 1];
    copy[i + 1] = first;
  }
  return copy;
}

function stripBom(value) {
  return String(value || '').replace(/^\uFEFF/, '');
}

function buildLookups(root) {
  const lookups = {
    lines: new Map(),
    locations: new Map(),
    subLocations: new Map(),
    eventSwitchDefs: new Map(),
    applicationEvents: new Map(),
    eventsLogic: new Map(),
    processingSteps: new Map(),
    processingStepCommands: new Map(),
    ddlStation: new Map(),
    ddlProcess: new Map(),
    ddlCommModules: new Map(),
    children: new Map()
  };

  readElements(root, 'Line').forEach(elem => {
    const guid = ftext(elem, 'Guid');
    if (guid) lookups.lines.set(guid, { lineNumber: ftext(elem, 'LineNumber') });
  });
  readElements(root, 'Location').forEach(elem => {
    const guid = ftext(elem, 'Guid');
    if (guid) {
      lookups.locations.set(guid, {
        line: ftext(elem, 'Line'),
        station: ftext(elem, 'Station'),
        postfix: ftext(elem, 'Postfix')
      });
    }
  });
  readElements(root, 'SubLocation').forEach(elem => {
    const guid = ftext(elem, 'Guid');
    if (guid) {
      lookups.subLocations.set(guid, {
        functionUnit: ftext(elem, 'FunctionUnit'),
        stationIndex: ftext(elem, 'StationIndex'),
        workPos: ftext(elem, 'WorkPos'),
        toolPos: ftext(elem, 'ToolPos')
      });
    }
  });
  readElements(root, 'EventSwitchDefinition').forEach(elem => {
    const guid = ftext(elem, 'Guid');
    if (guid) {
      lookups.eventSwitchDefs.set(guid, {
        eventSwitch: ftext(elem, 'EventSwitch'),
        postfix: ftext(elem, 'Postfix')
      });
    }
  });
  readElements(root, 'ApplicationEvent').forEach(elem => {
    const guid = ftext(elem, 'Guid');
    if (guid) lookups.applicationEvents.set(guid, { refEventName: ftext(elem, '_Ref_EventName') });
  });
  readElements(root, 'DdlEventsLogicTable').forEach(elem => {
    const guid = ftext(elem, 'Guid');
    if (guid) lookups.eventsLogic.set(guid, ftext(elem, 'Name'));
  });
  readElements(root, 'ProcessingSteps').forEach(elem => {
    const guid = ftext(elem, 'Guid');
    if (guid) {
      lookups.processingSteps.set(guid, {
        constraint: ftext(elem, 'Constraint'),
        executionStep: ftext(elem, 'ExecutionStep'),
        refProcessModule: ftext(elem, '_Ref_ProcessModule'),
        refApplication: ftext(elem, '_Ref_Application')
      });
    }
  });
  readElements(root, 'ProcessingStepCommands').forEach(elem => {
    const guid = ftext(elem, 'Guid');
    if (guid) {
      lookups.processingStepCommands.set(guid, {
        refCommand: ftext(elem, '_Ref_Command'),
        refTemplate: ftext(elem, '_Ref_Template')
      });
    }
  });
  readElements(root, 'DataCollectorLogicTable').forEach(elem => {
    const guid = ftext(elem, 'Guid');
    if (guid) lookups.ddlCommModules.set(guid, ftext(elem, 'Name'));
  });
  readElements(root, 'DdlStationLogicTable').forEach(elem => {
    const guid = ftext(elem, 'Guid');
    if (guid) {
      const info = {
        name: ftext(elem, 'Name'),
        parentGuid: ftext(elem, 'ParentGuid'),
        classGuid: ftext(elem, 'ClassGuid')
      };
      lookups.ddlStation.set(guid, info);
      if (!lookups.children.has(info.parentGuid)) lookups.children.set(info.parentGuid, []);
      lookups.children.get(info.parentGuid).push(guid);
    }
  });
  readElements(root, 'DdlProcessLogicTable').forEach(elem => {
    const guid = ftext(elem, 'Guid');
    if (guid) lookups.ddlProcess.set(guid, ftext(elem, 'Name'));
  });
  ['DdlCommModulesLogicTable', 'ProcessingModulesAccessLogicTable'].forEach(tag => {
    readElements(root, tag).forEach(elem => {
      const guid = ftext(elem, 'Guid');
      if (guid && !lookups.ddlCommModules.has(guid)) {
        lookups.ddlCommModules.set(guid, ftext(elem, 'Name'));
      }
    });
  });

  return lookups;
}

function buildRows(lookups) {
  const rows = [];
  lookups.lines.forEach((lineData, lineGuid) => {
    const lineNo = lineData.lineNumber;
    const lineName = getName(lookups, lineGuid);

    childGuids(lookups, lineGuid).forEach(locationGuid => {
      const location = lookups.locations.get(locationGuid);
      if (!location) return;
      const stationNo = location.station;
      const stationPostfix = location.postfix;

      childGuids(lookups, locationGuid).forEach(subGuid => {
        const subLocation = lookups.subLocations.get(subGuid);
        if (!subLocation) return;
        const locationId = [
          lineNo,
          stationNo,
          subLocation.stationIndex,
          subLocation.functionUnit,
          subLocation.workPos,
          subLocation.toolPos
        ].join('.');

        const eventsCollectionGuid = childGuids(lookups, subGuid)
          .find(childGuid => getName(lookups, childGuid) === 'Events');
        if (!eventsCollectionGuid) return;

        childGuids(lookups, eventsCollectionGuid).forEach(applicationEventGuid => {
          const applicationEvent = lookups.applicationEvents.get(applicationEventGuid);
          if (!applicationEvent) return;
          const eventName = lookups.eventsLogic.get(applicationEvent.refEventName) || applicationEvent.refEventName;

          childGuids(lookups, applicationEventGuid).forEach(esdGuid => {
            const eventSwitchDef = lookups.eventSwitchDefs.get(esdGuid);
            if (!eventSwitchDef) return;
            const parsedSwitch = parseEventSwitchName(getName(lookups, esdGuid));

            childGuids(lookups, esdGuid).forEach(processingStepGuid => {
              const processingStep = lookups.processingSteps.get(processingStepGuid);
              if (!processingStep) return;
              const commandChildren = childGuids(lookups, processingStepGuid)
                .filter(childGuid => lookups.processingStepCommands.has(childGuid));

              if (commandChildren.length === 0) {
                rows.push(buildRow({
                  lookups,
                  lineName,
                  stationNo,
                  stationPostfix,
                  locationId,
                  eventName,
                  parsedSwitch,
                  eventSwitchPostfix: eventSwitchDef.postfix,
                  processingStep
                }));
                return;
              }

              commandChildren.forEach(commandGuid => {
                const command = lookups.processingStepCommands.get(commandGuid);
                rows.push(buildRow({
                  lookups,
                  lineName,
                  stationNo,
                  stationPostfix,
                  locationId,
                  eventName,
                  parsedSwitch,
                  eventSwitchPostfix: eventSwitchDef.postfix,
                  processingStep,
                  commandName: getName(lookups, commandGuid),
                  commandTemplateName: lookups.ddlCommModules.get(command.refTemplate) || ''
                }));
              });
            });
          });
        });
      });
    });
  });
  return rows;
}

function buildRow(values) {
  const processApplication = values.lookups.ddlStation.get(values.processingStep.refApplication);
  return {
    lineName: values.lineName,
    station: values.stationNo,
    stationNamePostfix: values.stationPostfix,
    location: values.locationId,
    event: values.eventName,
    eventSwitch: values.parsedSwitch.eventSwitch,
    eventSwitchResponse: values.parsedSwitch.eventSwitchResponse,
    eventSwitchPostfix: values.eventSwitchPostfix,
    constraint: values.processingStep.constraint,
    process: values.lookups.ddlProcess.get(values.processingStep.refProcessModule) || '',
    processApplication: processApplication ? processApplication.name : '',
    processStep: values.processingStep.executionStep,
    command: values.commandName || '',
    commandTemplateName: values.commandTemplateName || ''
  };
}

function readElements(root, tag) {
  return asArray(root[tag]).filter(value => value && typeof value === 'object');
}

function ftext(elem, tag) {
  const value = firstValue(elem ? elem[tag] : '');
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    return firstValue(value['#text'] || value.text || '');
  }
  return String(value);
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function asArray(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function getName(lookups, guid) {
  const entry = lookups.ddlStation.get(guid);
  return entry ? entry.name : '';
}

function childGuids(lookups, guid) {
  return lookups.children.get(guid) || [];
}

function parseEventSwitchName(name) {
  let parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts[0] && parts[0].toLowerCase() === 'eventswitch') {
    parts = parts.slice(1);
  }
  return {
    eventSwitch: parts[0] || '',
    eventSwitchResponse: parts[1] || ''
  };
}

module.exports = {
  parseXmlToRows
};
