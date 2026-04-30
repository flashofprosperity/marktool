(function() {
  const api = window.MESDesignerApi;
  if (!api) return;

  const csvInput = document.getElementById('csvImportFileInput');
  if (!csvInput) return;

  let pendingStationId = null;
  let pendingTextHandler = null;
  let idCounter = Date.now();

  function nextTagId() {
    idCounter += 1;
    return idCounter;
  }

  function t(key, params = {}) {
    return api.t ? api.t(key, params) : key;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(field);
        field = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1;
        row.push(field);
        if (row.some(value => value.trim() !== '')) rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }

    row.push(field);
    if (row.some(value => value.trim() !== '')) rows.push(row);
    return rows;
  }

  function flattenTags(tagList, result = []) {
    tagList.forEach(tag => {
      result.push(tag);
      if (Array.isArray(tag.children)) flattenTags(tag.children, result);
    });
    return result;
  }

  function getTypeIndex(namePart) {
    const index = api.getTypeIndexByName(namePart);
    return index === -1 ? 0 : index;
  }

  function getTypeName(tag) {
    const type = api.getTagTypes()[tag.typeIndex];
    return type && type.name ? type.name : '';
  }

  function importCsvText(text) {
    if (!api.hasOpenProject()) {
      throw new Error(t('csv.noProject'));
    }

    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error(t('csv.empty'));

    const headers = rows[0].map(value => value.trim());
    const stationColumn = headers.findIndex(header => header === 'Station No.');
    const locationColumn = headers.findIndex(header => header === 'LocationID');
    if (stationColumn === -1 || locationColumn === -1) {
      throw new Error(t('csv.missingColumns'));
    }

    const tags = api.getTags();
    const existingStationNames = new Set(
      tags
        .filter(tag => getTypeName(tag).includes('Station'))
        .map(tag => String(tag.text || '').trim())
        .filter(Boolean)
    );
    const stationGroups = new Map();
    let skipped = 0;

    rows.slice(1).forEach(row => {
      const stationName = String(row[stationColumn] || '').trim();
      const locationName = String(row[locationColumn] || '').trim();
      if (!stationName || !locationName || existingStationNames.has(stationName)) {
        skipped += 1;
        return;
      }
      if (!stationGroups.has(stationName)) stationGroups.set(stationName, new Set());
      stationGroups.get(stationName).add(locationName);
    });

    if (stationGroups.size === 0) throw new Error(t('csv.empty'));

    const stationTypeIndex = getTypeIndex('Station');
    const locationTypeIndex = getTypeIndex('Location');
    let locationCount = 0;

    stationGroups.forEach((locationNames, stationName) => {
      const stationTag = {
        id: nextTagId(),
        typeIndex: stationTypeIndex,
        text: stationName,
        x: null,
        y: null,
        children: []
      };

      Array.from(locationNames).forEach(locationName => {
        stationTag.children.push({
          id: nextTagId(),
          typeIndex: locationTypeIndex,
          text: locationName,
          x: null,
          y: null,
          locationCategory: 'process',
          children: []
        });
        locationCount += 1;
      });

      tags.push(stationTag);
    });

    api.renderAll();
    api.markProjectDirty();
    return { stations: stationGroups.size, locations: locationCount, skipped };
  }

  function clamp(value, min = 0.02, max = 0.98) {
    return Math.max(min, Math.min(max, value));
  }

  function assignChildCoordinates(stationTag) {
    const children = Array.isArray(stationTag.children) ? stationTag.children : [];
    if (children.length === 0) return;

    const radius = 0.045;
    children.forEach((child, index) => {
      const angle = (Math.PI * 2 * index) / children.length;
      child.x = clamp(stationTag.x + Math.cos(angle) * radius);
      child.y = clamp(stationTag.y + Math.sin(angle) * radius);
    });
  }

  function startCoordinateAssignment(stationId) {
    const stationTag = api.findTagById(stationId);
    if (!stationTag) return;
    if (!api.hasImage()) {
      alert(t('csv.noImage'));
      return;
    }
    pendingStationId = stationId;
    alert(t('csv.assignHint', { name: stationTag.text || 'Station' }));
  }

  function assignPendingStationAtEvent(event) {
    if (!pendingStationId) return false;
    const stationTag = api.findTagById(pendingStationId);
    if (!stationTag) {
      pendingStationId = null;
      return false;
    }

    const canvas = api.getAnnotationCanvas();
    const point = api.getCanvasPointFromEvent(event);
    const x = point.x / canvas.offsetWidth;
    const y = point.y / canvas.offsetHeight;
    if (x < 0 || x > 1 || y < 0 || y > 1) return true;

    stationTag.x = clamp(x, 0, 1);
    stationTag.y = clamp(y, 0, 1);
    assignChildCoordinates(stationTag);
    pendingStationId = null;
    api.renderAll();
    api.markProjectDirty();
    return true;
  }

  csvInput.addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      if (pendingTextHandler) {
        const handler = pendingTextHandler;
        pendingTextHandler = null;
        Promise.resolve(handler(ev.target.result, file))
          .catch(error => alert(t('csv.importFailed', { message: error.message })));
        return;
      }
      try {
        const result = importCsvText(ev.target.result);
        alert(t('csv.importSuccess', result));
      } catch (error) {
        alert(t('csv.importFailed', { message: error.message }));
      }
    };
    reader.readAsText(file);
    csvInput.value = '';
  });

  const imageWrapper = api.getImageWrapper();
  imageWrapper.addEventListener('mousedown', event => {
    if (pendingStationId && event.button === 0) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  imageWrapper.addEventListener('click', event => {
    if (!pendingStationId) return;
    if (event.target.closest('.canvas-controls')) return;
    event.preventDefault();
    event.stopPropagation();
    assignPendingStationAtEvent(event);
  }, true);

  window.MESCsvImport = {
    openFilePicker(options = {}) {
      pendingTextHandler = typeof options.onText === 'function' ? options.onText : null;
      csvInput.click();
    },
    startCoordinateAssignment,
    importCsvText
  };
})();
