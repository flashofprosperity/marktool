(function() {
  const api = window.MESDesignerApi;
  if (!api) return;

  const panel = document.getElementById('locationGroupPanel');
  const canvas = api.getAnnotationCanvas && api.getAnnotationCanvas();
  if (!panel || !canvas) return;

  let groupViewEnabled = api.isLocationGroupRenderEnabled ? api.isLocationGroupRenderEnabled() : true;
  let editingGroupId = null;
  let dragState = null;
  let resizeState = null;
  let suppressAnchorClickId = null;
  let activeEventLocationId = null;
  let activeGroupId = null;
  let overlayRenderPending = false;
  let groupListScrollTop = 0;
  let groupEditorScrollTop = 0;

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

  function withPreservedPanelScroll(renderFn, selector = '.location-group-list') {
    const list = panel.querySelector(selector);
    const previousScrollTop = list ? list.scrollTop : 0;
    renderFn();
    const nextList = panel.querySelector(selector);
    if (nextList) nextList.scrollTop = previousScrollTop;
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

  function isTagInactive(tag) {
    return api.isTagInactive ? api.isTagInactive(tag) : !!(tag && tag.inactive);
  }

  function isTagInactiveSelfOrAncestor(tag) {
    return api.isTagInactiveSelfOrAncestor ? api.isTagInactiveSelfOrAncestor(tag) : isTagInactive(tag);
  }

  function isGroupInactive(group) {
    const station = api.findTagById(Number(group.stationId));
    if (group && group.inactive) return true;
    if (station && isTagInactiveSelfOrAncestor(station)) return true;
    const locations = group.locationIds
      .map(id => api.findTagById(Number(id)))
      .filter(Boolean);
    return locations.length > 0 && locations.every(location => isTagInactiveSelfOrAncestor(location));
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

  function syncRenderEnabledState() {
    if (api.isLocationGroupRenderEnabled) {
      groupViewEnabled = !!api.isLocationGroupRenderEnabled();
    }
  }

  function getLocationOwnerMap(groups = getGroups().map(normalizeGroup)) {
    const ownerMap = new Map();
    groups.forEach(group => {
      group.locationIds.forEach(locationId => {
        const normalizedLocationId = Number(locationId);
        if (!Number.isFinite(normalizedLocationId)) return;
        if (!ownerMap.has(normalizedLocationId)) ownerMap.set(normalizedLocationId, []);
        ownerMap.get(normalizedLocationId).push(group);
      });
    });
    return ownerMap;
  }

  function getConflictingOwners(group, locationId, ownerMap = getLocationOwnerMap()) {
    const owners = ownerMap.get(Number(locationId)) || [];
    return owners.filter(owner => owner.id !== group.id);
  }

  function formatOwnerGroupNames(groups) {
    return groups
      .map(owner => getGroupDisplayName(owner, api.findTagById(Number(owner.stationId))))
      .join(', ');
  }

  function getLinkedMaterialsForLocation(locationId) {
    return api.getLinkedMaterialsForLocation ? api.getLinkedMaterialsForLocation(Number(locationId)) : [];
  }

  function renderMaterialMarkers(materials, className = 'location-group-material-markers') {
    if (!Array.isArray(materials) || materials.length === 0) return '';
    const preview = materials.slice(0, 4);
    const overflow = materials.length - preview.length;
    const title = materials.map(item => item.label).join(', ');
    return `
      <div class="${className}" title="${escapeHtml(title)}">
        ${preview.map(item => `<span class="location-group-material-dot" style="--material-dot-color:${escapeHtml(item.color)}"></span>`).join('')}
        ${overflow > 0 ? `<span class="location-group-material-more">+${overflow}</span>` : ''}
      </div>
    `;
  }

  function validateGroupLocationSelection(group, locationIds, ownerMap = getLocationOwnerMap()) {
    return locationIds
      .map(locationId => {
        const location = api.findTagById(Number(locationId));
        const conflictingOwners = getConflictingOwners(group, locationId, ownerMap);
        if (!location || conflictingOwners.length === 0) return null;
        return {
          id: Number(locationId),
          name: getDisplayName(location),
          conflictingOwners
        };
      })
      .filter(Boolean);
  }

  function groupHasSearchHit(group) {
    const search = api.getTagSearchQuery ? api.getTagSearchQuery() : '';
    if (!search) return false;
    const station = api.findTagById(Number(group.stationId));
    const locations = group.locationIds
      .map(id => api.findTagById(Number(id)))
      .filter(Boolean);
    const events = locations.flatMap(location => getEventChildren(location));
    const searchableParts = [
      getGroupName(group),
      getGroupDisplayName(group, station),
      station ? getDisplayName(station) : '',
      ...locations.map(location => getDisplayName(location)),
      ...events.map(eventTag => {
        const record = api.getEventRecordForTag ? api.getEventRecordForTag(eventTag) : null;
        return [
          getDisplayName(eventTag),
          record ? record.event : '',
          record ? record.eventSwitchFunction : '',
          record ? record.eventSwitchReplyRequired : '',
          record ? record.eventSwitch : ''
        ].join(' ');
      })
    ];
    return api.matchesSearchText
      ? api.matchesSearchText(searchableParts, search)
      : searchableParts.join(' ').toLowerCase().includes(search);
  }

  function getEventChildren(location) {
    return api.getDirectEventChildren ? api.getDirectEventChildren(location) : [];
  }

  function locateTag(tagId) {
    if (api.focusTagOnCanvas && api.focusTagOnCanvas(Number(tagId), { preserveListState: true, highlightList: false })) return;
    if (api.highlightTagInList) api.highlightTagInList(Number(tagId), { preserveListState: false, revealInList: true });
  }

  function revealGroupInPanel(groupId) {
    const escapedId = escapeHtml(groupId);
    const target = panel.querySelector(`.location-group-summary-card[data-group-id="${escapedId}"], .location-group-detail[data-group-id="${escapedId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function toggleEventList(locationId) {
    const editorBody = panel.querySelector('.location-group-detail-scroll');
    if (editorBody) groupEditorScrollTop = editorBody.scrollTop;
    const id = Number(locationId);
    activeEventLocationId = activeEventLocationId === id ? null : id;
    renderPanel();
    scheduleOverlayRender();
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
        const eventId = Number(button.dataset.eventId);
        const focused = api.focusTagOnCanvas
          ? api.focusTagOnCanvas(eventId, { preserveListState: true, highlightList: false })
          : false;
        if (!focused && api.showEventEditDialog) api.showEventEditDialog(eventId);
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
    group.inactive = !!group.inactive;
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
      collapsed: true,
      inactive: false
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
    const list = panel.querySelector('.location-group-list');
    if (list) groupListScrollTop = list.scrollTop;
    editingGroupId = group.id;
    renderPanel();
    scheduleOverlayRender();
  }

  function focusGroup(group) {
    activeGroupId = group.id;
    revealGroupInPanel(group.id);
    if (!isGroupInactive(group)) {
      const target = group.collapsed ? group.anchor : group.panel;
      if (api.focusCanvasPoint) api.focusCanvasPoint(target.x, target.y);
    }
    renderPanel();
    scheduleOverlayRender();
  }

  function commit() {
    api.markProjectDirty();
    api.renderAll();
  }

  function renderPanel() {
    syncRenderEnabledState();
    const stations = getStations();
    const groups = getGroups().map(normalizeGroup);
    const ownerMap = getLocationOwnerMap(groups);
    const stationOptions = stations.map(station => `<option value="${station.id}">${escapeHtml(getDisplayName(station))}</option>`).join('');
    if (editingGroupId) {
      const editingGroup = groups.find(group => group.id === editingGroupId);
      if (!editingGroup) {
        editingGroupId = null;
        renderPanel();
        return;
      }
      const detailHtml = renderGroupEditorView(editingGroup, stationOptions, ownerMap);
      panel.innerHTML = `
        <div class="location-group-toolbar location-group-toolbar-detail">
          <button class="btn btn-sm location-group-back-btn" id="locationGroupBackBtn" type="button">${escapeHtml(t('groups.cancel'))}</button>
          <div class="location-group-toolbar-title">
            <strong>${escapeHtml(t('groups.edit'))}</strong>
            <span>${escapeHtml(getGroupDisplayName(editingGroup, api.findTagById(Number(editingGroup.stationId))))}</span>
          </div>
        </div>
        ${detailHtml}
      `;
      const backBtn = panel.querySelector('#locationGroupBackBtn');
      backBtn.addEventListener('click', () => {
        const editorBody = panel.querySelector('.location-group-detail-scroll');
        if (editorBody) groupEditorScrollTop = editorBody.scrollTop;
        editingGroupId = null;
        activeEventLocationId = null;
        renderPanel();
      });
      const detailScroll = panel.querySelector('.location-group-detail-scroll');
      if (detailScroll) detailScroll.scrollTop = groupEditorScrollTop;
      const editor = panel.querySelector('.location-group-detail');
      if (editor) bindGroupEditor(editor);
      return;
    }

    const groupedSummaries = renderGroupSummarySections(groups);
    panel.innerHTML = `
      <div class="location-group-toolbar">
        <button class="btn btn-primary btn-full" id="createLocationGroupBtn" type="button">${escapeHtml(t('groups.create'))}</button>
      </div>
      <div class="location-group-list">
        ${groups.length === 0 ? `<div class="location-group-empty">${escapeHtml(t('groups.empty'))}</div>` : ''}
        ${groupedSummaries}
      </div>
    `;

    const createBtn = panel.querySelector('#createLocationGroupBtn');
    createBtn.disabled = stations.length === 0;
    createBtn.title = stations.length === 0 ? t('groups.noStations') : '';
    createBtn.addEventListener('click', createGroup);

    const list = panel.querySelector('.location-group-list');
    if (list) list.scrollTop = groupListScrollTop;
    panel.querySelectorAll('.location-group-summary-card').forEach(card => bindGroupSummaryCard(card));
  }

  function renderGroupSummarySections(groups) {
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
          ${bucket.map(group => renderGroupSummaryCard(group)).join('')}
        </section>
      `;
    });

    return sections.join('');
  }

  function renderLocationRowsByCategory(group, locations, selectedIds, ownerMap) {
    const buckets = new Map([
      ['equipment', []],
      ['process', []]
    ]);
    locations.forEach(location => buckets.get(getLocationCategoryKey(location)).push(location));
    return Array.from(buckets.entries()).filter(([, bucket]) => bucket.length > 0).map(([category, bucket]) => `
      <div class="location-group-location-category">${escapeHtml(getLocationCategoryLabel(category))}</div>
      ${bucket.map(location => {
        const conflictingOwners = getConflictingOwners(group, location.id, ownerMap);
        const isSelected = selectedIds.has(Number(location.id));
        const isDisabled = conflictingOwners.length > 0 && !isSelected;
        const ownerNames = formatOwnerGroupNames(conflictingOwners);
        const occupancyTitle = conflictingOwners.length > 0
          ? escapeHtml(t('groups.occupiedBy', { name: ownerNames }))
          : '';
        return `
        <div class="location-group-location-row ${isDisabled ? 'occupied' : ''} ${conflictingOwners.length > 0 && isSelected ? 'conflict' : ''} ${location.usageStatus && location.usageStatus !== 'normal' ? `location-usage-${location.usageStatus}` : ''} ${isTagInactiveSelfOrAncestor(location) ? 'inactive' : ''}">
          <input type="checkbox" value="${location.id}" ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
          <div class="location-group-location-content" ${occupancyTitle ? `title="${occupancyTitle}"` : ''}>
            <span class="location-group-location-name">${escapeHtml(getDisplayName(location))}</span>
          </div>
          <button class="location-group-row-action locate-location-btn" type="button" data-location-id="${location.id}">${escapeHtml(t('groups.locate'))}</button>
        </div>
      `;
      }).join('')}
    `).join('');
  }

  function renderGroupSummaryCard(group) {
    const station = api.findTagById(Number(group.stationId));
    const inactive = isGroupInactive(group);
    return `
      <section class="location-group-summary-card ${activeGroupId === group.id ? 'active' : ''} ${groupHasSearchHit(group) ? 'search-hit' : ''} ${inactive ? 'inactive' : ''}" data-group-id="${escapeHtml(group.id)}">
        <div class="location-group-summary">
          <button class="location-group-summary-main" type="button">
            <strong>${escapeHtml(getGroupDisplayName(group, station))}</strong>
            <span>${escapeHtml(station ? getDisplayName(station) : t('groups.noStations'))} · ${escapeHtml(t('groups.count', { count: group.locationIds.length }))}${inactive ? ` · ${escapeHtml(t('groups.inactive'))}` : ''}</span>
          </button>
          <button class="btn btn-sm location-group-edit-btn" type="button">${escapeHtml(t('groups.edit'))}</button>
        </div>
      </section>
    `;
  }

  function renderGroupEditorView(group, stationOptions, ownerMap) {
    const station = api.findTagById(Number(group.stationId));
    const locations = getLocationsForStation(group.stationId);
    const selected = new Set(group.locationIds.map(Number));
    const inactive = isGroupInactive(group);
    const locationRows = locations.length === 0
      ? `<div class="location-group-empty small">${escapeHtml(t('groups.noLocations'))}</div>`
      : renderLocationRowsByCategory(group, locations, selected, ownerMap);

    return `
      <section class="location-group-detail ${activeGroupId === group.id ? 'active' : ''} ${inactive ? 'inactive' : ''}" data-group-id="${escapeHtml(group.id)}">
        <div class="location-group-detail-scroll">
          <div class="location-group-detail-summary">
            <strong>${escapeHtml(getGroupDisplayName(group, station))}</strong>
            <span>${escapeHtml(station ? getDisplayName(station) : t('groups.noStations'))} · ${escapeHtml(t('groups.count', { count: group.locationIds.length }))}${inactive ? ` · ${escapeHtml(t('groups.inactive'))}` : ''}</span>
          </div>
          <div class="location-group-fields location-group-fields-open">
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
            <button class="btn location-group-inactive-btn" type="button">${escapeHtml(group.inactive ? t('menu.setActive') : t('menu.setInactive'))}</button>
            <button class="btn btn-danger location-group-delete-btn" type="button">${escapeHtml(t('groups.delete'))}</button>
          </div>
          </div>
        </div>
      </section>
    `;
  }

  function bindGroupSummaryCard(card) {
    const group = getGroups().find(item => item.id === card.dataset.groupId);
    if (!group) return;
    card.querySelector('.location-group-summary-main').addEventListener('click', () => {
      focusGroup(group);
    });
    card.querySelector('.location-group-edit-btn').addEventListener('click', event => {
      event.stopPropagation();
      editGroup(group);
    });
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
        const editorBody = panel.querySelector('.location-group-detail-scroll');
        if (editorBody) groupEditorScrollTop = editorBody.scrollTop;
        renderPanel();
        renderOverlay();
      });
    }

    editor.querySelector('.location-group-save-btn').addEventListener('click', () => {
      const name = editor.querySelector('.location-group-name-input').value.trim();
      const nextStationId = Number(editor.querySelector('.location-group-station-select').value);
      const selectedLocationIds = Array.from(editor.querySelectorAll('.location-group-location-row input:checked')).map(input => Number(input.value));
      const ownerMap = getLocationOwnerMap();
      const conflicts = validateGroupLocationSelection(group, selectedLocationIds, ownerMap);
      if (conflicts.length > 0) {
        const conflictText = conflicts
          .map(item => `${item.name} -> ${formatOwnerGroupNames(item.conflictingOwners)}`)
          .join('; ');
        alert(t('groups.selectionConflict', { names: conflictText }));
        return;
      }
      group.name = name || 'Location Group';
      group.stationId = nextStationId;
      group.iconSize = Number(editor.querySelector('.location-group-size-input').value) || 34;
      group.locationIds = selectedLocationIds;
      const editorBody = panel.querySelector('.location-group-detail-scroll');
      if (editorBody) groupEditorScrollTop = editorBody.scrollTop;
      editingGroupId = null;
      activeEventLocationId = null;
      commit();
    });

    editor.querySelector('.location-group-inactive-btn').addEventListener('click', () => {
      group.inactive = !group.inactive;
      const editorBody = panel.querySelector('.location-group-detail-scroll');
      if (editorBody) groupEditorScrollTop = editorBody.scrollTop;
      renderPanel();
      renderOverlay();
      api.markProjectDirty();
    });

    editor.querySelector('.location-group-delete-btn').addEventListener('click', () => deleteGroup(group));
    editor.querySelectorAll('.locate-location-btn').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        locateTag(button.dataset.locationId);
      });
    });
  }

  function renderOverlay() {
    syncRenderEnabledState();
    canvas.querySelectorAll('.location-group-layer, .location-group-line-layer, .location-group-ui-layer').forEach(el => el.remove());
    document.querySelectorAll('.location-group-context-menu').forEach(el => el.remove());
    if (!groupViewEnabled || !api.hasOpenProject()) return;

    const groups = getGroups().map(normalizeGroup);
    if (groups.length === 0) return;
    const visibleGroups = groups.filter(group => !isGroupInactive(group));
    if (visibleGroups.length === 0) return;

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
    lineLayer.appendChild(createGroupLines(visibleGroups));

    visibleGroups.forEach(group => {
      if (group.collapsed) {
        uiLayer.appendChild(createAnchor(group));
      } else {
        uiLayer.appendChild(createPanel(group));
      }
    });
    if (api.refreshMaterialLinkLines) api.refreshMaterialLinkLines();
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
    const linkedMaterials = Array.from(new Map(
      group.locationIds
        .flatMap(locationId => getLinkedMaterialsForLocation(locationId))
        .map(item => [item.index, item])
    ).values());
    const anchor = document.createElement('button');
    anchor.className = 'location-group-anchor';
    anchor.dataset.groupId = String(group.id);
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
      ${renderMaterialMarkers(linkedMaterials, 'location-group-anchor-materials')}
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
    anchor.addEventListener('dblclick', event => {
      event.stopPropagation();
      focusGroup(group);
    });
    return anchor;
  }

  function createPanel(group) {
    const locations = group.locationIds
      .map(id => api.findTagById(Number(id)))
      .filter(Boolean);
    const visibleLocations = locations.filter(location => !isTagInactiveSelfOrAncestor(location));
    const search = api.getTagSearchQuery ? api.getTagSearchQuery() : '';

    const panelEl = document.createElement('div');
    panelEl.className = 'location-group-canvas-panel';
    panelEl.dataset.groupId = String(group.id);
    if (visibleLocations.length === 0) panelEl.classList.add('empty');
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
        <span>${escapeHtml(String(visibleLocations.length))}</span>
        <button class="location-group-panel-collapse" type="button">${escapeHtml(t('groups.collapse'))}</button>
      </div>
      <div class="location-group-canvas-body">
        <div class="location-group-canvas-grid">
          ${visibleLocations.map(location => {
          const hit = search && getDisplayName(location).toLowerCase().includes(search);
          const events = getEventChildren(location);
          const isActive = Number(activeEventLocationId) === Number(location.id);
          const linkedMaterials = getLinkedMaterialsForLocation(location.id);
          const usageClass = location.usageStatus && location.usageStatus !== 'normal' ? ` location-usage-${location.usageStatus}` : '';
          return `<div class="location-group-chip ${hit ? 'search-hit' : ''} ${isActive ? 'active' : ''}${usageClass}" data-location-id="${location.id}">
            <button class="location-group-chip-main" type="button" data-location-id="${location.id}">
              <span class="location-group-chip-title">${escapeHtml(getDisplayName(location))}</span>
              ${renderMaterialMarkers(linkedMaterials, 'location-group-chip-materials')}
            </button>
            ${events.length > 0 ? `<button class="location-group-chip-event" type="button" data-location-id="${location.id}">${events.length}</button>` : `<span class="location-group-chip-event empty">0</span>`}
          </div>`;
        }).join('')}
        </div>
      </div>
      ${renderPanelEventPopout(visibleLocations)}
      <button class="location-group-resize-handle" type="button" aria-label="${escapeHtml(t('groups.resize'))}" title="${escapeHtml(t('groups.resize'))}"></button>
    `;
    panelEl.querySelector('.location-group-canvas-panel-header').addEventListener('mousedown', event => {
      if (event.target.closest('.location-group-panel-collapse')) return;
      startPanelDrag(event, group);
    });
    panelEl.querySelector('.location-group-canvas-panel-header').addEventListener('dblclick', event => {
      event.stopPropagation();
      focusGroup(group);
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
    syncRenderEnabledState();
    if (reason !== 'transform' && reason !== 'overlay') renderPanel();
    renderOverlay();
  }

  function getCanvasRelativeCenter(element) {
    if (!element) return null;
    const canvasRect = canvas.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left - canvasRect.left + (rect.width / 2),
      y: rect.top - canvasRect.top + (rect.height / 2)
    };
  }

  function getLocationGroupLinkTarget(locationId) {
    syncRenderEnabledState();
    if (!groupViewEnabled) return null;
    const normalizedLocationId = Number(locationId);
    const groups = getGroups()
      .map(normalizeGroup)
      .filter(group => !isGroupInactive(group))
      .filter(group => group.locationIds.some(id => Number(id) === normalizedLocationId));
    if (groups.length === 0) return null;

    const expandedGroup = groups.find(group => !group.collapsed);
    if (expandedGroup) {
      const chip = canvas.querySelector(`.location-group-canvas-panel[data-group-id="${escapeHtml(expandedGroup.id)}"] .location-group-chip[data-location-id="${escapeHtml(normalizedLocationId)}"]`);
      const chipCenter = getCanvasRelativeCenter(chip);
      if (chipCenter) return chipCenter;
    }

    const collapsedGroup = groups.find(group => group.collapsed) || groups[0];
    const anchor = canvas.querySelector(`.location-group-anchor[data-group-id="${escapeHtml(collapsedGroup.id)}"]`);
    return getCanvasRelativeCenter(anchor);
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
      <button type="button" data-action="inactive">${escapeHtml(group.inactive ? t('menu.setActive') : t('menu.setInactive'))}</button>
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
      } else if (action === 'inactive') {
        group.inactive = !group.inactive;
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
  api.getLocationGroupLinkTarget = getLocationGroupLinkTarget;
  render();
})();
