(function() {
  const api = window.MESDesignerApi;
  if (!api) return;

  const panel = document.getElementById('locationGroupPanel');
  const canvas = api.getAnnotationCanvas && api.getAnnotationCanvas();
  if (!panel || !canvas) return;

  let groupViewEnabled = true;
  let editingGroupId = null;
  let dragState = null;
  let resizeState = null;
  let suppressAnchorClickId = null;
  let activeEventLocationId = null;
  let activeGroupId = null;
  let overlayRenderPending = false;

  function t(key, params = {}) {
    return api.t ? api.t(key, params) : key;
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"]/g, char => {
      if (char === '&') return '&amp;';
      if (char === '<') return '&lt;';
      if (char === '>') return '&gt;';
      if (char === '"') return '&quot;';
      return char;
    });
  }

  function clamp(value, min = 0.02, max = 0.98) {
    return Math.max(min, Math.min(max, value));
  }

  function getTypeName(tag) {
    const type = api.getTagTypes()[tag.typeIndex];
    return type && type.name ? type.name : '';
  }

  function isStation(tag) {
    return getTypeName(tag).includes('Station');
  }

  function isLocation(tag) {
    return getTypeName(tag).includes('Location');
  }

  function getDisplayName(tag) {
    return tag && tag.text && tag.text.trim() ? tag.text.trim() : t('groups.unassigned');
  }

  function getGroupName(group) {
    const rawName = group && group.name && group.name.trim() ? group.name.trim() : '';
    if (!rawName || rawName === 'Location Group' || rawName === 'Location 集合') return t('groups.defaultName');
    return rawName;
  }

  function getGroupDisplayName(group, station) {
    const stationName = station ? getDisplayName(station) : t('groups.noStations');
    return `${stationName} - ${getGroupName(group)}`;
  }

  function getLocationCategoryKey(location) {
    return location && location.locationCategory === 'equipment' ? 'equipment' : 'process';
  }

  function getLocationCategoryLabel(category) {
    if (category === 'equipment') return t('tags.locationEquipment');
    return t('tags.locationProcess');
  }

  function getStations() {
    return api.getAllTagsFlattened()
      .map(flatTag => api.findTagById(flatTag._id))
      .filter(tag => tag && isStation(tag));
  }

  function getLocationsForStation(stationId) {
    const station = api.findTagById(Number(stationId));
    if (!station || !Array.isArray(station.children)) return [];
    const result = [];
    function visit(list) {
      list.forEach(tag => {
        if (isLocation(tag)) result.push(tag);
        if (Array.isArray(tag.children)) visit(tag.children);
      });
    }
    visit(station.children);
    return result;
  }

  function getGroups() {
    return api.getLocationGroups();
  }

  function groupHasSearchHit(group) {
    const search = api.getTagSearchQuery ? api.getTagSearchQuery() : '';
    if (!search) return false;
    return group.locationIds
      .map(id => api.findTagById(Number(id)))
      .filter(Boolean)
      .some(location => getDisplayName(location).toLowerCase().includes(search));
  }

  function getEventChildren(location) {
    return api.getDirectEventChildren ? api.getDirectEventChildren(location) : [];
  }

  function locateTag(tagId) {
    if (api.highlightTagInList) api.highlightTagInList(Number(tagId));
  }

  function toggleEventList(locationId) {
    const id = Number(locationId);
    activeEventLocationId = activeEventLocationId === id ? null : id;
    renderPanel();
    scheduleOverlayRender();
  }

  function renderEventList(location) {
    const events = getEventChildren(location);
    if (events.length === 0 || activeEventLocationId !== Number(location.id)) return '';
    return `
      <div class="location-group-event-list">
        ${events.map(eventTag => {
          const record = api.getEventRecordForTag ? api.getEventRecordForTag(eventTag) : null;
          const label = record && record.event ? record.event : getDisplayName(eventTag);
          const meta = record ? `es: ${record.eventSwitch || ''}` : '';
          return `<button class="location-group-event-item" type="button" data-event-id="${eventTag.id}">
            <span>${escapeHtml(label)}</span>
            <small>${escapeHtml(meta)}</small>
          </button>`;
        }).join('')}
      </div>
    `;
  }

  function renderPanelEventPopout(locations) {
    const location = locations.find(item => Number(item.id) === Number(activeEventLocationId));
    const events = location ? getEventChildren(location) : [];
    if (!location || events.length === 0) return '';
    return `
      <div class="location-group-event-popout">
        <div class="location-group-event-popout-header">
          <strong title="${escapeHtml(getDisplayName(location))}">${escapeHtml(getDisplayName(location))}</strong>
          <span>${escapeHtml(t('groups.events'))} ${events.length}</span>
          <button class="location-group-event-popout-close" type="button" aria-label="${escapeHtml(t('groups.cancel'))}">×</button>
        </div>
        <div class="location-group-event-popout-list">
          ${events.map(eventTag => {
            const record = api.getEventRecordForTag ? api.getEventRecordForTag(eventTag) : null;
            const label = record && record.event ? record.event : getDisplayName(eventTag);
            const meta = record ? `es: ${record.eventSwitch || ''}` : '';
            return `<button class="location-group-event-item location-group-event-popout-item" type="button" data-event-id="${eventTag.id}">
              <span>${escapeHtml(label)}</span>
              <small>${escapeHtml(meta)}</small>
            </button>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  function bindEventItems(root) {
    root.querySelectorAll('.location-group-event-item').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        if (api.highlightTagInList) api.highlightTagInList(Number(button.dataset.eventId));
      });
      button.addEventListener('dblclick', event => {
        event.stopPropagation();
        if (api.showEventEditDialog) api.showEventEditDialog(Number(button.dataset.eventId));
      });
    });
  }

  function scheduleOverlayRender() {
    if (overlayRenderPending) return;
    overlayRenderPending = true;
    requestAnimationFrame(() => {
      overlayRenderPending = false;
      renderOverlay();
    });
  }

  function normalizeGroup(group) {
    const station = api.findTagById(Number(group.stationId));
    const anchorX = group.anchor && Number.isFinite(Number(group.anchor.x)) ? Number(group.anchor.x) : (station && api.hasAssignedCoordinates(station) ? Number(station.x) : 0.5);
    const anchorY = group.anchor && Number.isFinite(Number(group.anchor.y)) ? Number(group.anchor.y) : (station && api.hasAssignedCoordinates(station) ? Number(station.y) : 0.5);
    if (!group.id) group.id = api.createLocationGroupId();
    if (!group.name) group.name = 'Location Group';
    group.stationId = station ? Number(station.id) : Number(group.stationId) || null;
    group.locationIds = Array.isArray(group.locationIds)
      ? group.locationIds.map(id => Number(id)).filter(id => Number.isFinite(id))
      : [];
    group.anchor = {
      x: clamp(anchorX, 0, 1),
      y: clamp(anchorY, 0, 1)
    };
    group.panel = {
      x: clamp(group.panel && Number.isFinite(Number(group.panel.x)) ? Number(group.panel.x) : group.anchor.x + 0.12, 0.04, 0.96),
      y: clamp(group.panel && Number.isFinite(Number(group.panel.y)) ? Number(group.panel.y) : group.anchor.y, 0.04, 0.96),
      width: clamp(group.panel && Number.isFinite(Number(group.panel.width)) ? Number(group.panel.width) : 0.24, 0.1, 0.95),
      height: clamp(group.panel && Number.isFinite(Number(group.panel.height)) ? Number(group.panel.height) : 0.22, 0.08, 0.9)
    };
    group.iconSize = Math.max(26, Math.min(64, Number(group.iconSize) || 34));
    group.collapsed = !!group.collapsed;
    return group;
  }

  function createGroup() {
    const station = getStations()[0];
    if (!station) {
      alert(t('groups.noStations'));
      return;
    }
    const group = normalizeGroup({
      id: api.createLocationGroupId(),
      name: 'Location Group',
      stationId: station.id,
      locationIds: [],
      iconSize: 34,
      collapsed: true
    });
    getGroups().push(group);
    editingGroupId = group.id;
    activeGroupId = group.id;
    commit();
  }

  function deleteGroup(group) {
    if (!confirm(t('groups.confirmDelete', { name: getGroupName(group) }))) return;
    const groups = getGroups();
    const index = groups.findIndex(item => item.id === group.id);
    if (index !== -1) groups.splice(index, 1);
    if (editingGroupId === group.id) editingGroupId = null;
    if (activeGroupId === group.id) activeGroupId = null;
    commit();
  }

  function editGroup(group) {
    activeGroupId = group.id;
    editingGroupId = group.id;
    renderPanel();
    scheduleOverlayRender();
  }

  function focusGroup(group) {
    activeGroupId = group.id;
    if (api.highlightTagInList && group.stationId) api.highlightTagInList(Number(group.stationId));
    renderPanel();
    scheduleOverlayRender();
  }

  function commit() {
    api.markProjectDirty();
    api.renderAll();
  }

  function renderPanel() {
    const stations = getStations();
    const groups = getGroups().map(normalizeGroup);
    const stationOptions = stations.map(station => `<option value="${station.id}">${escapeHtml(getDisplayName(station))}</option>`).join('');
    const groupedEditors = renderGroupEditorSections(groups, stationOptions);

    panel.innerHTML = `
      <div class="location-group-toolbar">
        <label class="location-group-toggle">
          <input type="checkbox" id="locationGroupViewToggle" ${groupViewEnabled ? 'checked' : ''}>
          <span>${escapeHtml(t('groups.toggle'))}</span>
        </label>
        <button class="btn btn-primary btn-full" id="createLocationGroupBtn" type="button">${escapeHtml(t('groups.create'))}</button>
      </div>
      <div class="location-group-list">
        ${groups.length === 0 ? `<div class="location-group-empty">${escapeHtml(t('groups.empty'))}</div>` : ''}
        ${groupedEditors}
      </div>
    `;

    const toggle = panel.querySelector('#locationGroupViewToggle');
    toggle.addEventListener('change', () => {
      groupViewEnabled = toggle.checked;
      if (api.setLocationGroupRenderEnabled) api.setLocationGroupRenderEnabled(groupViewEnabled);
      renderOverlay();
    });

    const createBtn = panel.querySelector('#createLocationGroupBtn');
    createBtn.disabled = stations.length === 0;
    createBtn.title = stations.length === 0 ? t('groups.noStations') : '';
    createBtn.addEventListener('click', createGroup);

    panel.querySelectorAll('.location-group-editor').forEach(editor => bindGroupEditor(editor));
  }

  function renderGroupEditorSections(groups, stationOptions) {
    const buckets = new Map();
    groups.forEach(group => {
      const key = Number.isFinite(Number(group.stationId)) ? String(Number(group.stationId)) : 'unassigned';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(group);
    });

    const sections = Array.from(buckets.entries()).map(([stationId, bucket]) => {
      const station = stationId === 'unassigned' ? null : api.findTagById(Number(stationId));
      const stationLabel = station ? getDisplayName(station) : t('groups.noStations');
      return `
        <section class="location-group-category-section">
          <h4 class="location-group-category-title">${escapeHtml(t('groups.byStation'))}: ${escapeHtml(stationLabel)}</h4>
          ${bucket.map(group => renderGroupEditor(group, stationOptions)).join('')}
        </section>
      `;
    });

    return sections.join('');
  }

  function renderGroupEditor(group, stationOptions) {
    const isEditing = editingGroupId === group.id;
    const station = api.findTagById(Number(group.stationId));
    const locations = getLocationsForStation(group.stationId);
    const selected = new Set(group.locationIds.map(Number));
    const locationRows = locations.length === 0
      ? `<div class="location-group-empty small">${escapeHtml(t('groups.noLocations'))}</div>`
      : renderLocationRowsByCategory(locations, selected);

    function renderLocationRowsByCategory(items, selectedIds) {
      const buckets = new Map([
        ['equipment', []],
        ['process', []]
      ]);
      items.forEach(location => buckets.get(getLocationCategoryKey(location)).push(location));
      return Array.from(buckets.entries()).filter(([, bucket]) => bucket.length > 0).map(([category, bucket]) => `
        <div class="location-group-location-category">${escapeHtml(getLocationCategoryLabel(category))}</div>
        ${bucket.map(location => {
          const events = getEventChildren(location);
          return `
          <div class="location-group-location-row">
            <input type="checkbox" value="${location.id}" ${selectedIds.has(Number(location.id)) ? 'checked' : ''}>
            <span>${escapeHtml(getDisplayName(location))}</span>
            <button class="location-group-row-action locate-location-btn" type="button" data-location-id="${location.id}">${escapeHtml(t('groups.locate'))}</button>
            ${events.length > 0 ? `<button class="location-group-row-action event-location-btn" type="button" data-location-id="${location.id}">${escapeHtml(t('groups.events'))} ${events.length}</button>` : ''}
            ${renderEventList(location)}
          </div>
        `;
        }).join('')}
      `).join('');
    }

    return `
      <section class="location-group-editor ${isEditing ? 'editing' : ''} ${activeGroupId === group.id ? 'active' : ''}" data-group-id="${escapeHtml(group.id)}">
        <div class="location-group-summary">
          <button class="location-group-summary-main" type="button">
            <strong>${escapeHtml(getGroupDisplayName(group, station))}</strong>
            <span>${escapeHtml(station ? getDisplayName(station) : t('groups.noStations'))} · ${escapeHtml(t('groups.count', { count: group.locationIds.length }))}</span>
          </button>
          <button class="btn btn-sm location-group-edit-btn" type="button">${escapeHtml(isEditing ? t('groups.cancel') : t('groups.edit'))}</button>
        </div>
        <div class="location-group-fields">
          <label>
            <span>${escapeHtml(t('groups.name'))}</span>
            <input class="location-group-name-input" type="text" value="${escapeHtml(group.name || '')}">
          </label>
          <label>
            <span>${escapeHtml(t('groups.station'))}</span>
            <select class="location-group-station-select">${stationOptions}</select>
          </label>
          <label>
            <span>${escapeHtml(t('groups.iconSize'))}</span>
            <input class="location-group-size-input" type="range" min="26" max="64" step="2" value="${group.iconSize}">
          </label>
          <div class="location-group-locations-title">${escapeHtml(t('groups.locations'))}</div>
          <div class="location-group-location-list">${locationRows}</div>
          <div class="location-group-actions">
            <button class="btn btn-primary location-group-save-btn" type="button">${escapeHtml(t('groups.save'))}</button>
            <button class="btn btn-danger location-group-delete-btn" type="button">${escapeHtml(t('groups.delete'))}</button>
          </div>
        </div>
      </section>
    `;
  }

  function bindGroupEditor(editor) {
    const group = getGroups().find(item => item.id === editor.dataset.groupId);
    if (!group) return;

    const stationSelect = editor.querySelector('.location-group-station-select');
    if (stationSelect) stationSelect.value = String(group.stationId || '');
    if (stationSelect) {
      stationSelect.addEventListener('change', () => {
        const nextStationId = Number(stationSelect.value);
        const station = api.findTagById(nextStationId);
        group.stationId = nextStationId;
        group.locationIds = [];
        if (station && api.hasAssignedCoordinates(station)) {
          group.anchor = { x: Number(station.x), y: Number(station.y) };
          group.panel = {
            x: clamp(Number(station.x) + 0.12, 0.04, 0.96),
            y: clamp(Number(station.y), 0.04, 0.96),
            width: group.panel.width,
            height: group.panel.height
          };
        }
        editingGroupId = group.id;
        api.markProjectDirty();
        renderPanel();
        renderOverlay();
      });
    }

    editor.querySelector('.location-group-summary-main').addEventListener('click', () => {
      focusGroup(group);
    });

    editor.querySelector('.location-group-edit-btn').addEventListener('click', () => {
      editingGroupId = editingGroupId === group.id ? null : group.id;
      renderPanel();
    });

    editor.querySelector('.location-group-save-btn').addEventListener('click', () => {
      const name = editor.querySelector('.location-group-name-input').value.trim();
      const nextStationId = Number(editor.querySelector('.location-group-station-select').value);
      group.name = name || 'Location Group';
      group.stationId = nextStationId;
      group.iconSize = Number(editor.querySelector('.location-group-size-input').value) || 34;
      group.locationIds = Array.from(editor.querySelectorAll('.location-group-location-row input:checked')).map(input => Number(input.value));
      editingGroupId = null;
      commit();
    });

    editor.querySelector('.location-group-delete-btn').addEventListener('click', () => deleteGroup(group));
    editor.querySelectorAll('.locate-location-btn').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        locateTag(button.dataset.locationId);
      });
    });
    editor.querySelectorAll('.event-location-btn').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        toggleEventList(button.dataset.locationId);
      });
    });
    bindEventItems(editor);
  }

  function renderOverlay() {
    canvas.querySelectorAll('.location-group-layer, .location-group-line-layer, .location-group-ui-layer').forEach(el => el.remove());
    document.querySelectorAll('.location-group-context-menu').forEach(el => el.remove());
    if (!groupViewEnabled || !api.hasOpenProject()) return;

    const groups = getGroups().map(normalizeGroup);
    if (groups.length === 0) return;

    const lineLayer = document.createElement('div');
    lineLayer.className = 'location-group-line-layer';
    const uiLayer = document.createElement('div');
    uiLayer.className = 'location-group-ui-layer';
    const inverseZoom = 1 / Math.max(0.1, Number(api.getZoomLevel ? api.getZoomLevel() : 1));
    lineLayer.style.setProperty('--location-group-inverse-zoom', inverseZoom.toFixed(4));
    uiLayer.style.setProperty('--location-group-inverse-zoom', inverseZoom.toFixed(4));
    uiLayer.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
    });
    canvas.appendChild(lineLayer);
    canvas.appendChild(uiLayer);
    lineLayer.appendChild(createGroupLines(groups));

    groups.forEach(group => {
      if (group.collapsed) {
        uiLayer.appendChild(createAnchor(group));
      } else {
        uiLayer.appendChild(createPanel(group));
      }
    });
  }

  function createGroupLines(groups) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'location-group-lines');
    svg.setAttribute('width', canvas.offsetWidth);
    svg.setAttribute('height', canvas.offsetHeight);
    groups.forEach(group => {
      const station = api.findTagById(Number(group.stationId));
      if (!station || !api.hasAssignedCoordinates(station)) return;
      const target = group.collapsed ? group.anchor : group.panel;
      ['location-group-line-halo', 'location-group-line'].forEach(className => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', Number(station.x) * canvas.offsetWidth);
        line.setAttribute('y1', Number(station.y) * canvas.offsetHeight);
        line.setAttribute('x2', Number(target.x) * canvas.offsetWidth);
        line.setAttribute('y2', Number(target.y) * canvas.offsetHeight);
        line.setAttribute('class', className);
        svg.appendChild(line);
      });
    });
    return svg;
  }

  function createAnchor(group) {
    const anchor = document.createElement('button');
    anchor.className = 'location-group-anchor';
    if (groupHasSearchHit(group)) anchor.classList.add('search-hit');
    if (activeGroupId === group.id) anchor.classList.add('active');
    anchor.type = 'button';
    anchor.style.left = `${group.anchor.x * 100}%`;
    anchor.style.top = `${group.anchor.y * 100}%`;
    anchor.style.width = `${group.iconSize}px`;
    anchor.style.height = `${group.iconSize}px`;
    anchor.title = t('groups.clickToExpand');
    anchor.innerHTML = `
      <span class="location-group-anchor-count">${escapeHtml(String(group.locationIds.length))}</span>
      <span class="location-group-anchor-name">${escapeHtml(getGroupName(group))}</span>
    `;
    anchor.addEventListener('click', event => {
      event.stopPropagation();
      if (suppressAnchorClickId === group.id) {
        suppressAnchorClickId = null;
        return;
      }
      group.collapsed = !group.collapsed;
      activeGroupId = group.id;
      commit();
    });
    anchor.addEventListener('mousedown', event => startAnchorDrag(event, group));
    anchor.addEventListener('contextmenu', event => showGroupContextMenu(event, group));
    return anchor;
  }

  function createPanel(group) {
    const locations = group.locationIds
      .map(id => api.findTagById(Number(id)))
      .filter(Boolean);
    const search = api.getTagSearchQuery ? api.getTagSearchQuery() : '';

    const panelEl = document.createElement('div');
    panelEl.className = 'location-group-canvas-panel';
    if (locations.length === 0) panelEl.classList.add('empty');
    if (groupHasSearchHit(group)) panelEl.classList.add('search-hit');
    if (activeGroupId === group.id) panelEl.classList.add('active');
    panelEl.style.left = `${group.panel.x * 100}%`;
    panelEl.style.top = `${group.panel.y * 100}%`;
    panelEl.style.width = `${group.panel.width * 100}%`;
    panelEl.style.height = `${group.panel.height * 100}%`;
    const groupDisplayName = getGroupDisplayName(group, api.findTagById(Number(group.stationId)));
    panelEl.innerHTML = `
      <div class="location-group-canvas-panel-header">
        <strong title="${escapeHtml(groupDisplayName)}">${escapeHtml(groupDisplayName)}</strong>
        <span>${escapeHtml(String(locations.length))}</span>
        <button class="location-group-panel-collapse" type="button">${escapeHtml(t('groups.collapse'))}</button>
      </div>
      <div class="location-group-canvas-body">
        <div class="location-group-canvas-grid">
          ${locations.map(location => {
          const hit = search && getDisplayName(location).toLowerCase().includes(search);
          const events = getEventChildren(location);
          const isActive = Number(activeEventLocationId) === Number(location.id);
          return `<div class="location-group-chip ${hit ? 'search-hit' : ''} ${isActive ? 'active' : ''}" data-location-id="${location.id}">
            <button class="location-group-chip-main" type="button" data-location-id="${location.id}">${escapeHtml(getDisplayName(location))}</button>
            ${events.length > 0 ? `<button class="location-group-chip-event" type="button" data-location-id="${location.id}">${events.length}</button>` : `<span class="location-group-chip-event empty">0</span>`}
          </div>`;
        }).join('')}
        </div>
      </div>
      ${renderPanelEventPopout(locations)}
      <button class="location-group-resize-handle" type="button" aria-label="${escapeHtml(t('groups.resize'))}" title="${escapeHtml(t('groups.resize'))}"></button>
    `;
    panelEl.querySelector('.location-group-canvas-panel-header').addEventListener('mousedown', event => {
      if (event.target.closest('.location-group-panel-collapse')) return;
      startPanelDrag(event, group);
    });
    panelEl.querySelector('.location-group-panel-collapse').addEventListener('click', event => {
      event.stopPropagation();
      group.collapsed = true;
      commit();
    });
    panelEl.addEventListener('mousedown', event => {
      activeGroupId = group.id;
      if (event.button === 1) startPanelResize(event, group);
    });
    panelEl.addEventListener('contextmenu', event => showGroupContextMenu(event, group));
    panelEl.querySelector('.location-group-resize-handle').addEventListener('mousedown', event => startPanelResize(event, group));
    panelEl.querySelectorAll('.location-group-chip-main').forEach(button => {
      button.addEventListener('click', () => locateTag(button.dataset.locationId));
    });
    panelEl.querySelectorAll('.location-group-chip-event').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        toggleEventList(button.dataset.locationId);
      });
    });
    const closeEventPopoutBtn = panelEl.querySelector('.location-group-event-popout-close');
    if (closeEventPopoutBtn) {
      closeEventPopoutBtn.addEventListener('click', event => {
        event.stopPropagation();
        activeEventLocationId = null;
        scheduleOverlayRender();
      });
    }
    bindEventItems(panelEl);
    return panelEl;
  }

  function canvasDelta(event, origin) {
    const width = Math.max(1, canvas.offsetWidth);
    const height = Math.max(1, canvas.offsetHeight);
    const zoom = Math.max(0.1, Number(api.getZoomLevel ? api.getZoomLevel() : 1));
    return {
      dx: (event.clientX - origin.x) / (width * zoom),
      dy: (event.clientY - origin.y) / (height * zoom)
    };
  }

  function startAnchorDrag(event, group) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragState = {
      type: 'anchor',
      group,
      mouse: { x: event.clientX, y: event.clientY },
      start: { x: group.anchor.x, y: group.anchor.y },
      moved: false
    };
    activeGroupId = group.id;
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
  }

  function startPanelDrag(event, group) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragState = {
      type: 'panel',
      group,
      mouse: { x: event.clientX, y: event.clientY },
      start: { x: group.panel.x, y: group.panel.y },
      moved: false
    };
    activeGroupId = group.id;
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
  }

  function onDrag(event) {
    if (!dragState) return;
    const delta = canvasDelta(event, dragState.mouse);
    if (Math.abs(event.clientX - dragState.mouse.x) > 3 || Math.abs(event.clientY - dragState.mouse.y) > 3) {
      dragState.moved = true;
    }
    if (dragState.type === 'anchor') {
      dragState.group.anchor.x = clamp(dragState.start.x + delta.dx, 0, 1);
      dragState.group.anchor.y = clamp(dragState.start.y + delta.dy, 0, 1);
    } else {
      dragState.group.panel.x = clamp(dragState.start.x + delta.dx, 0.02, 0.98);
      dragState.group.panel.y = clamp(dragState.start.y + delta.dy, 0.02, 0.98);
    }
    scheduleOverlayRender();
  }

  function stopDrag() {
    if (dragState) {
      if (dragState.type === 'anchor' && dragState.moved) suppressAnchorClickId = dragState.group.id;
      dragState = null;
      api.markProjectDirty();
      renderOverlay();
      renderPanel();
    }
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
  }

  function startPanelResize(event, group) {
    if (event.button !== 0 && event.button !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    resizeState = {
      group,
      mouse: { x: event.clientX, y: event.clientY },
      start: { width: group.panel.width, height: group.panel.height }
    };
    window.addEventListener('mousemove', onResize);
    window.addEventListener('mouseup', stopResize);
  }

  function onResize(event) {
    if (!resizeState) return;
    const delta = canvasDelta(event, resizeState.mouse);
    resizeState.group.panel.width = clamp(resizeState.start.width + delta.dx, 0.12, 0.95);
    resizeState.group.panel.height = clamp(resizeState.start.height + delta.dy, 0.08, 0.9);
    scheduleOverlayRender();
  }

  function stopResize() {
    if (resizeState) {
      resizeState = null;
      api.markProjectDirty();
      renderOverlay();
      renderPanel();
    }
    window.removeEventListener('mousemove', onResize);
    window.removeEventListener('mouseup', stopResize);
  }

  function render(reason = 'all') {
    if (reason !== 'transform' && reason !== 'overlay') renderPanel();
    renderOverlay();
  }

  function showGroupContextMenu(event, group) {
    event.preventDefault();
    event.stopPropagation();
    activeGroupId = group.id;
    document.querySelectorAll('.location-group-context-menu').forEach(el => el.remove());
    const menu = document.createElement('div');
    menu.className = 'location-group-context-menu';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.innerHTML = `
      <button type="button" data-action="edit">${escapeHtml(t('groups.edit'))}</button>
      <button type="button" data-action="toggle">${escapeHtml(group.collapsed ? t('groups.expand') : t('groups.collapse'))}</button>
      <button type="button" data-action="delete" class="danger">${escapeHtml(t('groups.delete'))}</button>
    `;
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    const left = Math.min(event.clientX, window.innerWidth - rect.width - 8);
    const top = Math.min(event.clientY, window.innerHeight - rect.height - 8);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;

    const close = () => {
      menu.remove();
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
    const closeOnOutside = outsideEvent => {
      if (menu.contains(outsideEvent.target)) return;
      close();
    };
    const closeOnEscape = keyEvent => {
      if (keyEvent.key === 'Escape') close();
    };
    menu.addEventListener('click', clickEvent => {
      const button = clickEvent.target.closest('button[data-action]');
      if (!button) return;
      clickEvent.stopPropagation();
      const action = button.dataset.action;
      close();
      if (action === 'edit') {
        editGroup(group);
      } else if (action === 'toggle') {
        group.collapsed = !group.collapsed;
        activeGroupId = group.id;
        commit();
      } else if (action === 'delete') {
        deleteGroup(group);
      }
    });
    setTimeout(() => {
      document.addEventListener('mousedown', closeOnOutside);
      document.addEventListener('keydown', closeOnEscape);
    });
  }

  api.registerRenderHook(render);
  if (api.setLocationGroupRenderEnabled) api.setLocationGroupRenderEnabled(groupViewEnabled);
  render();
})();
