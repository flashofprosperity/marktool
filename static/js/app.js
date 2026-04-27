(function() {
      /*
       * Maintenance map
       * 1. Config and in-memory state live at the top of this file.
       * 2. DOM references are cached once, then reused by render/event functions.
       * 3. State-changing operations should call renderAll() or the narrow render
       *    functions they affect.
       * 4. Coordinates stored on tags are normalized image coordinates: 0..1.
       * 5. Export/import JSON shape is the compatibility boundary. Change it with care.
       */

      // ---------- 数据 ----------
      /*
       * tagTypes item:
       * {
       *   name: string,
       *   color: CSS color,
       *   icon: image path used in marker/type UI
       * }
       */
      const tagTypes = [
        { 
          name: 'Station', 
          color: '#E74C3C',
          icon: './static/station.png' // 在此填写Station的图标路径，例如: './icons/station.png'
        },
        { 
          name: 'Location', 
          color: '#3498DB',
          icon: './static/location.png' // 在此填写Location的图标路径
        },
        { 
          name: 'Process (name&number)', 
          color: '#2ECC71',
          icon: './static/process.png' // 在此填写Process的图标路径

        }
      ];
      
      /*
       * material item:
       * {
       *   name: string,
       *   abbreviation: short display text,
       *   category: string,
       *   type: string,
       *   processLinks: tag id[] linked from Process tags
       * }
       */
      const materials = [
        {
          name: '物料A',
          abbreviation: 'MA',
          category: '原材料',
          type: 'a料',
          processLinks: [] // 与process关联的ID数组
        },
      ];
      let currentTypeIndex = 0;

      /*
       * tag item:
       * {
       *   id: number,
       *   typeIndex: index into tagTypes,
       *   text: string,
       *   x: number, // normalized 0..1, relative to the image width
       *   y: number, // normalized 0..1, relative to the image height
       *   children: tag[],
       *   materialLinks?: material index[],
       *   _textHidden?: boolean // UI-only flag, omitted from export
       * }
       */
      let tags = [];
      
      let imageNaturalWidth = 0;
      let imageNaturalHeight = 0;
      const baseTagTypes = tagTypes.map(type => ({ ...type }));

      // ---------- DOM 元素 ----------
      // Keep DOM lookups centralized. The rest of the file should reuse these
      // references instead of calling getElementById again unless the element is
      // created dynamically.
      const currentTypeSelect = document.getElementById('currentTypeSelect');
      const projectHome = document.getElementById('projectHome');
      const appWorkspace = document.getElementById('appWorkspace');
      const projectList = document.getElementById('projectList');
      const newProjectBtn = document.getElementById('newProjectBtn');
      const backToProjectsBtn = document.getElementById('backToProjectsBtn');
      const currentProjectName = document.getElementById('currentProjectName');
      const saveStatus = document.getElementById('saveStatus');
      const fileInput = document.getElementById('fileInput');
      const uploadBtn = document.getElementById('uploadBtn');
      const imageWrapper = document.getElementById('imageWrapper');
      const annotationCanvas = document.getElementById('annotationCanvas');
      const annotateImage = document.getElementById('annotateImage');
      const zoomInBtn = document.getElementById('zoomInBtn');
      const zoomOutBtn = document.getElementById('zoomOutBtn');
      const zoomResetBtn = document.getElementById('zoomResetBtn');
      const zoomReadout = document.getElementById('zoomReadout');
      const placeholder = document.getElementById('placeholder');
      const tagListContainer = document.getElementById('tagListContainer');
      const tagSearchInput = document.getElementById('tagSearchInput');
      const tagSearchClearBtn = document.getElementById('tagSearchClearBtn');
      const canvasBranchFilterBtn = document.getElementById('canvasBranchFilterBtn');
      const canvasBranchFilterLabel = document.getElementById('canvasBranchFilterLabel');
      const canvasBranchFilterMenu = document.getElementById('canvasBranchFilterMenu');
      const tagTreeModeBtn = document.getElementById('tagTreeModeBtn');
      const tagTypeModeBtn = document.getElementById('tagTypeModeBtn');
      const exportBtn = document.getElementById('exportBtn');
      const importBtn = document.getElementById('importBtn');
      const importFileInput = document.getElementById('importFileInput');
      const clearAllBtn = document.getElementById('clearAllBtn');
      const showTextCheckbox = document.getElementById('showTextCheckbox');
      const materialListContainer = document.getElementById('materialListContainer');
      const addMaterialBtn = document.getElementById('addMaterialBtn');

      // 折叠区域元素
      const tagsCollapseHeader = document.getElementById('tagsCollapseHeader');
      const tagsCollapseContent = document.getElementById('tagsCollapseContent');
      const materialsCollapseHeader = document.getElementById('materialsCollapseHeader');
      const materialsCollapseContent = document.getElementById('materialsCollapseContent');

      const panelRight = document.getElementById('panelRight');
      const toggleRightBtn = document.getElementById('toggleRightBtn');

      // 右键菜单元素
      const contextMenu = document.getElementById('contextMenu');
      const createTagMenuItem = document.getElementById('createTagMenuItem');
      const toggleTextMenuItem = document.getElementById('toggleTextMenuItem');
      const editTextMenuItem = document.getElementById('editTextMenuItem');
      const changeTypeMenuItem = document.getElementById('changeTypeMenuItem');
      const addChildMenuItem = document.getElementById('addChildMenuItem');
      const deleteTagMenuItem = document.getElementById('deleteTagMenuItem');
      const typeSubMenu = document.getElementById('typeSubMenu');
      
      // 文本编辑对话框元素
      const textEditDialog = document.getElementById('textEditDialog');
      const textEditInput = document.getElementById('textEditInput');
      const textEditConfirm = document.getElementById('textEditConfirm');
      const textEditCancel = document.getElementById('textEditCancel');
      
      let contextMenuTagId = null;
      let contextMenuPosition = null; // 存储右键点击的位置
      let tagListMode = 'tree';
      let tagSearchQuery = '';
      let canvasBranchFilterIds = [];
      let currentProjectId = null;
      let currentProjectTitle = '';
      let saveTimer = null;
      let isSavingProject = false;
      let hasUnsavedProjectChanges = false;
      let suppressAutosave = false;
      let projectChangeVersion = 0;

      // ---------- Server-backed project persistence ----------
      async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          },
          ...options
        });
        if (!response.ok) {
          let message = '请求失败';
          try {
            const body = await response.json();
            if (body.error) message = body.error;
          } catch (error) {
            message = response.statusText || message;
          }
          throw new Error(message);
        }
        if (response.status === 204) return null;
        return response.json();
      }

      function setSaveStatus(state, text) {
        saveStatus.className = `save-status ${state}`;
        saveStatus.textContent = text;
      }

      function setWorkspaceVisible(isVisible) {
        projectHome.classList.toggle('is-hidden', isVisible);
        appWorkspace.classList.toggle('is-hidden', !isVisible);
        panelRight.classList.toggle('is-hidden', !isVisible);
      }

      function cleanTagForPersistence(tag) {
        const newTag = {
          id: tag.id,
          typeIndex: tag.typeIndex,
          text: tag.text,
          x: +tag.x.toFixed(4),
          y: +tag.y.toFixed(4)
        };
        if (tag.materialLinks && tag.materialLinks.length > 0) {
          newTag.materialLinks = tag.materialLinks;
        }
        newTag.children = tag.children && tag.children.length > 0
          ? tag.children.map(cleanTagForPersistence)
          : [];
        return newTag;
      }

      function serializeProjectData() {
        return {
          image: annotateImage.src || '',
          tagTypes: tagTypes.map(type => ({ ...type })),
          tags: tags.map(cleanTagForPersistence),
          materials: materials.map(m => ({
            name: m.name,
            abbreviation: m.abbreviation,
            category: m.category,
            type: m.type,
            processLinks: m.processLinks || []
          }))
        };
      }

      function resetProjectData() {
        tagTypes.length = 0;
        tagTypes.push(...baseTagTypes.map(type => ({ ...type })));
        materials.length = 0;
        materials.push({
          name: '物料A',
          abbreviation: 'MA',
          category: '原材料',
          type: 'a料',
          processLinks: []
        });
        tags = [];
        currentTypeIndex = 0;
        canvasBranchFilterIds = [];
        tagSearchQuery = '';
        tagSearchInput.value = '';
        annotateImage.removeAttribute('src');
        annotateImage.src = '';
        imageWrapper.style.display = 'none';
        placeholder.style.display = '';
      }

      function applyProjectData(data) {
        const importedTypes = Array.isArray(data.tagTypes) ? data.tagTypes : baseTagTypes;
        tagTypes.length = 0;
        tagTypes.push(...importedTypes.map((type, index) => ({
          ...type,
          icon: type.icon || baseTagTypes[index]?.icon
        })));
        if (tagTypes.length === 0) {
          tagTypes.push(...baseTagTypes.map(type => ({ ...type })));
        }

        tags = Array.isArray(data.tags) ? data.tags : [];
        materials.length = 0;
        if (Array.isArray(data.materials)) {
          materials.push(...data.materials);
        }
        currentTypeIndex = 0;
        canvasBranchFilterIds = [];
        tagSearchQuery = '';
        tagSearchInput.value = '';

        if (data.image) {
          annotateImage.src = data.image;
          annotateImage.onload = () => {
            imageNaturalWidth = annotateImage.naturalWidth;
            imageNaturalHeight = annotateImage.naturalHeight;
            imageWrapper.style.display = 'block';
            placeholder.style.display = 'none';
            fitCanvasToImage();
            updateTextVisibility();
            setTimeout(() => {
              resetView();
              renderAll();
            }, 50);
          };
        } else {
          annotateImage.removeAttribute('src');
          annotateImage.src = '';
          imageWrapper.style.display = 'none';
          placeholder.style.display = '';
          updateTextVisibility();
          renderAll();
        }
      }

      function renderProjectList(projects) {
        projectList.innerHTML = '';
        if (projects.length === 0) {
          projectList.innerHTML = '<div class="project-empty">暂无项目，点击“新建项目”开始。</div>';
          return;
        }
        projects.forEach(project => {
          const card = document.createElement('div');
          card.className = 'project-card';
          card.innerHTML = `
            <div class="project-card-title">${escapeHtml(project.name)}</div>
            <div class="project-card-meta">更新于 ${escapeHtml(formatDateTime(project.updatedAt))}</div>
            <div class="project-card-actions">
              <button class="btn open-project-btn" type="button" data-id="${project.id}">打开</button>
              <button class="btn btn-danger delete-project-btn" type="button" data-id="${project.id}">删除</button>
            </div>
          `;
          projectList.appendChild(card);
        });
      }

      function formatDateTime(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString();
      }

      async function loadProjectList() {
        projectList.innerHTML = '<div class="project-empty">正在加载项目...</div>';
        try {
          const body = await apiRequest('/api/projects');
          renderProjectList(body.projects || []);
        } catch (error) {
          projectList.innerHTML = `<div class="project-empty">项目加载失败：${escapeHtml(error.message)}</div>`;
        }
      }

      async function openProject(projectId) {
        try {
          const body = await apiRequest(`/api/projects/${projectId}`);
          const project = body.project;
          suppressAutosave = true;
          currentProjectId = project.id;
          currentProjectTitle = project.name;
          currentProjectName.textContent = currentProjectTitle;
          applyProjectData(project.data || {});
          hasUnsavedProjectChanges = false;
          projectChangeVersion = 0;
          setSaveStatus('saved', '已保存');
          setWorkspaceVisible(true);
          suppressAutosave = false;
        } catch (error) {
          suppressAutosave = false;
          alert('打开项目失败：' + error.message);
        }
      }

      async function createProject(name) {
        const body = await apiRequest('/api/projects', {
          method: 'POST',
          body: JSON.stringify({ name })
        });
        await loadProjectList();
        await openProject(body.project.id);
      }

      async function deleteProject(projectId) {
        await apiRequest(`/api/projects/${projectId}`, { method: 'DELETE' });
        if (currentProjectId === projectId) {
          currentProjectId = null;
          currentProjectTitle = '';
          hasUnsavedProjectChanges = false;
          projectChangeVersion = 0;
          currentProjectName.textContent = '未打开项目';
          resetProjectData();
          setSaveStatus('idle', '请选择项目');
          setWorkspaceVisible(false);
        }
        await loadProjectList();
      }

      function markProjectDirty() {
        if (suppressAutosave || !currentProjectId) return;
        hasUnsavedProjectChanges = true;
        projectChangeVersion += 1;
        setSaveStatus('dirty', '未保存');
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(saveCurrentProject, 500);
      }

      async function saveCurrentProject() {
        if (!currentProjectId || !hasUnsavedProjectChanges) return;
        if (isSavingProject) {
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = setTimeout(saveCurrentProject, 500);
          return;
        }
        const savingVersion = projectChangeVersion;
        isSavingProject = true;
        setSaveStatus('saving', '保存中');
        try {
          await apiRequest(`/api/projects/${currentProjectId}`, {
            method: 'PUT',
            body: JSON.stringify({
              name: currentProjectTitle,
              data: serializeProjectData()
            })
          });
          if (projectChangeVersion === savingVersion) {
            hasUnsavedProjectChanges = false;
            setSaveStatus('saved', '已保存');
          } else {
            setSaveStatus('dirty', '未保存');
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(saveCurrentProject, 500);
          }
          loadProjectList();
        } catch (error) {
          setSaveStatus('error', '保存失败');
        } finally {
          isSavingProject = false;
        }
      }

      async function importProjectFromJson(data, name) {
        const body = await apiRequest('/api/projects/import', {
          method: 'POST',
          body: JSON.stringify({ name, data })
        });
        await loadProjectList();
        await openProject(body.project.id);
      }

      // ---------- Top-level event bindings ----------
      newProjectBtn.addEventListener('click', async () => {
        const name = prompt('请输入项目名称');
        if (!name || !name.trim()) return;
        try {
          await createProject(name.trim());
        } catch (error) {
          alert('创建项目失败：' + error.message);
        }
      });

      backToProjectsBtn.addEventListener('click', () => {
        setWorkspaceVisible(false);
        loadProjectList();
      });

      saveStatus.addEventListener('click', () => {
        if (hasUnsavedProjectChanges) saveCurrentProject();
      });

      projectList.addEventListener('click', async (e) => {
        const openBtn = e.target.closest('.open-project-btn');
        const deleteBtn = e.target.closest('.delete-project-btn');
        if (openBtn) {
          await openProject(parseInt(openBtn.dataset.id));
          return;
        }
        if (deleteBtn) {
          const id = parseInt(deleteBtn.dataset.id);
          const card = deleteBtn.closest('.project-card');
          const title = card ? card.querySelector('.project-card-title')?.textContent : '该项目';
          if (!confirm(`确定删除“${title}”？此操作不可恢复。`)) return;
          try {
            await deleteProject(id);
          } catch (error) {
            alert('删除项目失败：' + error.message);
          }
        }
      });

      // 右侧面板隐藏/显示（浮动覆盖模式）
      toggleRightBtn.addEventListener('click', () => {
        panelRight.classList.toggle('hidden');
      });

      // 右键菜单功能
      function showContextMenu(e, tagId = null, position = null) {
        e.preventDefault();
        e.stopPropagation();
        
        contextMenuTagId = tagId;
        contextMenuPosition = position;
        
        // 根据是否有标签ID来决定显示哪些菜单项
        const toggleTextItem = document.getElementById('toggleTextMenuItem');
        const editTextItem = document.getElementById('editTextMenuItem');
        const changeTypeItem = document.getElementById('changeTypeMenuItem');
        const addChildItem = document.getElementById('addChildMenuItem');
        const deleteTagItem = document.getElementById('deleteTagMenuItem');
        const dividers = contextMenu.querySelectorAll('.context-menu-divider');
        
        if (tagId) {
          // 如果是针对现有标签的右键菜单
          const tag = findTagById(tagId);
          if (tag) {
            // 检查当前节点及其子节点是否全部隐藏文本
            const allHidden = checkAllTextHidden(tag);
            toggleTextItem.textContent = allHidden ? '显示文本' : '隐藏文本';
          }
          toggleTextItem.style.display = 'block';
          editTextItem.style.display = 'block';
          changeTypeItem.style.display = 'block';
          addChildItem.style.display = 'block';
          deleteTagItem.style.display = 'block';
          dividers.forEach(div => div.style.display = 'block');
        } else {
          // 如果是在图片空白处右键，只显示创建标签
          toggleTextItem.style.display = 'none';
          editTextItem.style.display = 'none';
          changeTypeItem.style.display = 'none';
          addChildItem.style.display = 'none';
          deleteTagItem.style.display = 'none';
          dividers.forEach(div => div.style.display = 'none');
        }
        
        contextMenu.style.left = e.pageX + 'px';
        contextMenu.style.top = e.pageY + 'px';
        contextMenu.classList.add('show');
      }

      function hideContextMenu() {
        contextMenu.classList.remove('show');
        typeSubMenu.classList.remove('show');
        contextMenuTagId = null;
        contextMenuPosition = null;
      }

      // 点击其他地方关闭菜单
      document.addEventListener('click', (e) => {
        // 如果点击的不是文本编辑对话框，则关闭菜单
        if (!e.target.closest('#textEditDialog')) {
          hideContextMenu();
        }
      });
      
      // ESC键关闭菜单和对话框
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          hideContextMenu();
          hideTextEditDialog();
        }
      });

      // 切换文本显示/隐藏菜单项
      toggleTextMenuItem.addEventListener('click', () => {
        if (contextMenuTagId) {
          const tag = findTagById(contextMenuTagId);
          if (tag) {
            const allHidden = checkAllTextHidden(tag);
            // 如果全部隐藏，则显示；否则隐藏
            toggleNodeTextVisibility(tag, allHidden);
            updateMarkerTextDisplay();
          }
          hideContextMenu();
        }
      });

      // 修改文本菜单项
      editTextMenuItem.addEventListener('click', () => {
        if (contextMenuTagId) {
          showTextEditDialog(contextMenuTagId);
          hideContextMenu();
        }
      });

      // 修改类型菜单项 - 显示子菜单
      changeTypeMenuItem.addEventListener('click', (e) => {
        if (contextMenuTagId) {
          e.stopPropagation();
          showTypeSubMenu(contextMenuTagId);
        }
      });

      // 添加子标签菜单项
      addChildMenuItem.addEventListener('click', () => {
        if (contextMenuTagId) {
          addChildToTag(contextMenuTagId);
          hideContextMenu();
        }
      });

      // 删除标签菜单项
      deleteTagMenuItem.addEventListener('click', () => {
        if (contextMenuTagId) {
          deleteTagById(contextMenuTagId);
          hideContextMenu();
        }
      });
      
      // 创建标签菜单项
      createTagMenuItem.addEventListener('click', () => {
        if (contextMenuPosition) {
          createTagAtPosition(contextMenuPosition.x, contextMenuPosition.y);
          hideContextMenu();
        }
      });

      // 文本编辑对话框功能
      function showTextEditDialog(tagId) {
        const tag = findTagById(tagId);
        if (!tag) return;
        
        textEditInput.value = tag.text || '';
        textEditDialog.style.display = 'flex';
        textEditInput.focus();
        textEditInput.select();
        
        // 保存当前编辑的标签ID
        textEditDialog.dataset.tagId = tagId;
      }

      function hideTextEditDialog() {
        textEditDialog.style.display = 'none';
        textEditInput.value = '';
        delete textEditDialog.dataset.tagId;
      }

      // 确认修改文本
      textEditConfirm.addEventListener('click', () => {
        const tagId = parseInt(textEditDialog.dataset.tagId);
        if (tagId) {
          const tag = findTagById(tagId);
          if (tag) {
            tag.text = textEditInput.value;
            renderAll();
            markProjectDirty();
          }
        }
        hideTextEditDialog();
      });

      // 取消修改文本
      textEditCancel.addEventListener('click', () => {
        hideTextEditDialog();
      });

      // 回车键确认
      textEditInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          textEditConfirm.click();
        }
      });

      // 点击对话框背景关闭
      textEditDialog.addEventListener('click', (e) => {
        if (e.target === textEditDialog) {
          hideTextEditDialog();
        }
      });

      // 文本显示全局控制
      function updateTextVisibility() {
        if (showTextCheckbox.checked) {
          imageWrapper.classList.add('show-text');
        } else {
          imageWrapper.classList.remove('show-text');
        }
      }
      showTextCheckbox.addEventListener('change', updateTextVisibility);

      // 初始化折叠功能
      function initCollapse(header, content) {
        let isCollapsed = false;
        const section = header.closest('.collapse-section');
        header.addEventListener('click', () => {
          isCollapsed = !isCollapsed;
          content.classList.toggle('collapsed');
          if (section) section.classList.toggle('section-collapsed', isCollapsed);
          header.querySelector('.collapse-icon').classList.toggle('collapsed');
        });
      }

      initCollapse(tagsCollapseHeader, tagsCollapseContent);
      initCollapse(materialsCollapseHeader, materialsCollapseContent);

      tagTreeModeBtn.addEventListener('click', () => {
        tagListMode = 'tree';
        renderTagList();
      });
      tagTypeModeBtn.addEventListener('click', () => {
        tagListMode = 'type';
        renderTagList();
      });
      tagSearchInput.addEventListener('input', (e) => {
        tagSearchQuery = e.target.value.trim().toLowerCase();
        updateCanvasBranchFilterOptions();
        renderTagList();
      });
      tagSearchClearBtn.addEventListener('click', () => {
        tagSearchQuery = '';
        tagSearchInput.value = '';
        updateCanvasBranchFilterOptions();
        renderTagList();
      });
      canvasBranchFilterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        canvasBranchFilterMenu.classList.toggle('open');
        canvasBranchFilterBtn.classList.toggle('active', canvasBranchFilterMenu.classList.contains('open'));
      });
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.canvas-filter-wrap')) {
          canvasBranchFilterMenu.classList.remove('open');
          canvasBranchFilterBtn.classList.remove('active');
        }
      });

      // ---------- 渲染函数 ----------
      /*
       * Render layer rule of thumb:
       * - These functions read current state and rebuild DOM.
       * - They should avoid changing core data except for temporary UI fields.
       * - After changing tags/materials/type/filter state, call renderAll() unless
       *   only one narrow UI area needs refreshing.
       */
      function updateCurrentTypeSelect() {
        currentTypeSelect.innerHTML = '';
        tagTypes.forEach((type, idx) => {
          const option = document.createElement('option');
          option.value = idx;
          option.textContent = type.name;
          if (idx === currentTypeIndex) option.selected = true;
          currentTypeSelect.appendChild(option);
        });
      }

      function getAllTagsFlattened(tagList = tags, parentId = null) {
        let result = [];
        tagList.forEach(tag => {
          result.push({ ...tag, _parentId: parentId, _isChild: parentId !== null, _id: tag.id });
          if (tag.children) {
            result = result.concat(getAllTagsFlattened(tag.children, tag.id));
          }
        });
        return result;
      }

      // Canvas branch filtering works with real tag objects, but the tree is
      // easier to search after flattening it into a parent-aware list.
      function getCanvasBranchOptionTags() {
        return getAllTagsFlattened()
          .map(flatTag => findTagById(flatTag._id))
          .filter(tag => tag && (!tagSearchQuery || tagHasSearchMatch(tag)));
      }

      function getTagDisplayName(tag) {
        const type = tagTypes[tag.typeIndex];
        const fallback = `${getTypeAbbreviation(type ? type.name : 'Tag')} ${tag.id}`;
        return tag.text && tag.text.trim() ? tag.text.trim() : fallback;
      }

      function updateCanvasBranchFilterOptions() {
        const selectedIds = new Set(canvasBranchFilterIds);
        const optionTags = getCanvasBranchOptionTags();
        const optionIds = new Set(optionTags.map(tag => String(tag.id)));
        const missingSelectedTags = canvasBranchFilterIds
          .filter(id => !optionIds.has(id))
          .map(id => findTagById(parseInt(id)))
          .filter(Boolean);

        canvasBranchFilterMenu.innerHTML = '';

        if (optionTags.length > 0) {
          const visibleIds = optionTags.map(tag => String(tag.id));
          const allVisibleSelected = visibleIds.every(id => selectedIds.has(id));
          const bulk = document.createElement('div');
          bulk.className = 'canvas-filter-bulk';
          bulk.innerHTML = `
            <span><input type="checkbox" ${allVisibleSelected ? 'checked' : ''}> Select all</span>
            <span>${visibleIds.length}</span>
          `;
          bulk.addEventListener('click', (e) => {
            e.preventDefault();
            if (allVisibleSelected) {
              canvasBranchFilterIds = canvasBranchFilterIds.filter(id => !visibleIds.includes(id));
            } else {
              const nextIds = new Set(canvasBranchFilterIds);
              visibleIds.forEach(id => nextIds.add(id));
              canvasBranchFilterIds = Array.from(nextIds);
            }
            updateCanvasBranchFilterOptions();
            renderMarkers();
            renderTagList();
          });
          canvasBranchFilterMenu.appendChild(bulk);
        }

        if (optionTags.length === 0 && missingSelectedTags.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'canvas-filter-empty';
          empty.textContent = tags.length === 0 ? '暂无节点' : '无匹配节点';
          canvasBranchFilterMenu.appendChild(empty);
        }

        function appendOption(tag, prefix = '') {
          const id = String(tag.id);
          const type = tagTypes[tag.typeIndex];
          const isCovered = selectedIds.has(id) && canvasBranchFilterIds.some(selectedId => {
            if (selectedId === id) return false;
            const selectedTag = findTagById(parseInt(selectedId));
            return selectedTag && containsTagId(selectedTag, tag.id);
          });
          const label = document.createElement('label');
          label.className = 'canvas-filter-option';
          if (isCovered) label.classList.add('covered');
          label.innerHTML = `
            <input type="checkbox" value="${id}" ${selectedIds.has(id) ? 'checked' : ''}>
            <span>${escapeHtml(`${prefix}${getTypeAbbreviation(type ? type.name : 'Tag')} · ${getTagDisplayName(tag)}${isCovered ? '（已由父节点显示）' : ''}`)}</span>
          `;
          const checkbox = label.querySelector('input');
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
              if (!canvasBranchFilterIds.includes(id)) canvasBranchFilterIds.push(id);
            } else {
              canvasBranchFilterIds = canvasBranchFilterIds.filter(selectedId => selectedId !== id);
            }
            updateCanvasBranchFilterOptions();
            renderMarkers();
            renderTagList();
          });
          canvasBranchFilterMenu.appendChild(label);
        }

        missingSelectedTags.forEach(tag => appendOption(tag, '当前: '));
        optionTags.forEach(tag => {
          if (!missingSelectedTags.some(selectedTag => selectedTag.id === tag.id)) {
            appendOption(tag);
          }
        });

        const selectedTags = canvasBranchFilterIds.map(id => findTagById(parseInt(id))).filter(Boolean);
        if (selectedTags.length === 0) {
          canvasBranchFilterLabel.textContent = '全部节点';
        } else if (selectedTags.length === 1) {
          canvasBranchFilterLabel.textContent = getTagDisplayName(selectedTags[0]);
        } else {
          canvasBranchFilterLabel.textContent = `已选 ${selectedTags.length} 个节点`;
        }
      }

      function getCanvasVisibleRootTags() {
        if (canvasBranchFilterIds.length === 0) return tags;
        const selectedNodes = canvasBranchFilterIds
          .map(id => findTagById(parseInt(id)))
          .filter(Boolean);

        if (selectedNodes.length === 0) {
          canvasBranchFilterIds = [];
          updateCanvasBranchFilterOptions();
          return tags;
        }
        if (selectedNodes.length !== canvasBranchFilterIds.length) {
          canvasBranchFilterIds = selectedNodes.map(tag => String(tag.id));
          updateCanvasBranchFilterOptions();
        }
        return selectedNodes.filter(node => {
          return !selectedNodes.some(otherNode => otherNode.id !== node.id && containsTagId(otherNode, node.id));
        });
      }

      function containsTagId(rootTag, targetId) {
        if (!rootTag.children || rootTag.children.length === 0) return false;
        return rootTag.children.some(child => child.id === targetId || containsTagId(child, targetId));
      }

      function findTagById(id, list = tags) {
        for (let tag of list) {
          if (tag.id === id) return tag;
          if (tag.children && tag.children.length > 0) {
            const found = findTagById(id, tag.children);
            if (found) return found;
          }
        }
        return null;
      }

      function renderMarkers() {
        // Markers and connector lines are rebuilt from tag state on each render.
        // Marker positions use normalized tag.x/tag.y values, not screen pixels.
        annotationCanvas.querySelectorAll('.tag-marker').forEach(el => el.remove());
        
        // 清除旧的SVG
        const oldSvg = annotationCanvas.querySelector('#connectionSvg');
        if (oldSvg) oldSvg.remove();
        
        // 创建新的SVG用于绘制连接线
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('id', 'connectionSvg');
        svg.setAttribute('width', annotationCanvas.offsetWidth);
        svg.setAttribute('height', annotationCanvas.offsetHeight);
        annotationCanvas.appendChild(svg);
        
        const visibleRootTags = getCanvasVisibleRootTags();
        const allTags = getAllTagsFlattened(visibleRootTags);
        const markerPositions = {}; // 存储标记点位置
        
        allTags.forEach(tag => {
          const type = tagTypes[tag.typeIndex];
          const marker = document.createElement('div');
          marker.className = 'tag-marker';
          if (tag._isChild) marker.classList.add('child-marker');

          marker.style.left = `${tag.x * 100}%`;
          marker.style.top = `${tag.y * 100}%`;
          marker.setAttribute('data-tag-id', tag._id);

          const dot = document.createElement('div');
          dot.className = 'dot';
          dot.style.setProperty('--marker-color', type ? type.color : '#999');
          
          if (type && type.icon) {
            const iconImg = document.createElement('img');
            iconImg.src = type.icon;
            iconImg.className = 'marker-icon';
            iconImg.alt = type.name;
            dot.appendChild(iconImg);
          } else {
            // 在圆点内显示类型缩写
            const typeAbbrev = type ? getTypeAbbreviation(type.name) : '?';
            dot.textContent = typeAbbrev;
          }

          const textSpan = document.createElement('span');
          textSpan.className = 'tag-text';
          textSpan.textContent = tag.text || '';

          marker.appendChild(dot);
          marker.appendChild(textSpan);
          annotationCanvas.appendChild(marker);

          // 记录标记点位置（用于后续绘制连接线）
          markerPositions[tag._id] = {
            x: tag.x * annotationCanvas.offsetWidth,
            y: tag.y * annotationCanvas.offsetHeight,
            parentId: tag._parentId
          };

          marker.addEventListener('mousedown', (e) => startDrag(tag, e));
          
          // 添加右键菜单事件
          marker.addEventListener('contextmenu', (e) => {
            showContextMenu(e, tag._id);
          });
          
          // 添加双击事件 - 在右侧列表中高亮定位
          marker.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            highlightTagInList(tag._id);
          });
        });
        
        // 更新文本显示状态
        updateMarkerTextDisplay();
        
        // 绘制父子连接线
        allTags.forEach(tag => {
          if (tag._parentId && markerPositions[tag._parentId]) {
            const parent = markerPositions[tag._parentId];
            const child = markerPositions[tag._id];
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', parent.x);
            line.setAttribute('y1', parent.y);
            line.setAttribute('x2', child.x);
            line.setAttribute('y2', child.y);
            line.setAttribute('stroke', '#999');
            line.setAttribute('stroke-width', '1.5');
            line.setAttribute('stroke-dasharray', '4,3');
            line.setAttribute('opacity', '0.6');
            svg.appendChild(line);
          }
        });

        applyPanTransform();
      }

      // 获取类型名称的缩写
      function getTypeAbbreviation(typeName) {
        if (typeName.includes('Station')) return 'ST';
        if (typeName.includes('Location')) return 'LC';
        if (typeName.includes('Process')) return 'PC';
        return typeName.substring(0, 2).toUpperCase();
      }

      function getTagSearchText(tag) {
        const type = tagTypes[tag.typeIndex];
        return [
          tag.text || '',
          type ? type.name : '',
          getTypeAbbreviation(type ? type.name : 'Tag'),
          `${(tag.x * 100).toFixed(1)}`,
          `${(tag.y * 100).toFixed(1)}`
        ].join(' ').toLowerCase();
      }

      function doesTagMatchSearch(tag) {
        return !tagSearchQuery || getTagSearchText(tag).includes(tagSearchQuery);
      }

      function tagHasSearchMatch(tag) {
        if (doesTagMatchSearch(tag)) return true;
        return !!(tag.children && tag.children.some(tagHasSearchMatch));
      }

      function renderTagList() {
        // The right panel can render either as a tree or grouped by tag type.
        tagListContainer.innerHTML = '';
        tagTreeModeBtn.classList.toggle('active', tagListMode === 'tree');
        tagTypeModeBtn.classList.toggle('active', tagListMode === 'type');
        tagSearchInput.value = tagSearchQuery;

        if (tags.length === 0) {
          tagListContainer.innerHTML = '<div class="no-tags">暂无标签，点击图片添加</div>';
          return;
        }

        if (tagListMode === 'tree') {
          let renderedCount = 0;
          tags.forEach(tag => {
            if (!tagSearchQuery || tagHasSearchMatch(tag)) {
              renderTagNode(tag, tagListContainer, { includeChildren: true, filterBySearch: !!tagSearchQuery });
              renderedCount++;
            }
          });
          if (renderedCount === 0) {
            tagListContainer.innerHTML = '<div class="no-tags">没有匹配的标签</div>';
          }
          return;
        }

        const tagsByType = {};
        tagTypes.forEach((type, index) => {
          tagsByType[index] = [];
        });
        getAllTagsFlattened().forEach(flatTag => {
          const originalTag = findTagById(flatTag._id);
          if (tagSearchQuery && originalTag && !doesTagMatchSearch(originalTag)) return;
          if (!tagsByType[flatTag.typeIndex]) tagsByType[flatTag.typeIndex] = [];
          tagsByType[flatTag.typeIndex].push(flatTag);
        });

        // 为每个类型创建折叠区域
        let renderedGroups = 0;
        tagTypes.forEach((type, typeIndex) => {
          const typeTags = tagsByType[typeIndex] || [];
          if (typeTags.length === 0) return;
          renderedGroups++;

          const collapseDiv = document.createElement('div');
          collapseDiv.className = 'tag-list-group';

          const header = document.createElement('div');
          header.className = 'tag-list-group-header';
          header.innerHTML = `
            <span>
              <span class="tag-color-dot" style="background:${type.color}"></span>
              ${escapeHtml(type.name)} (${typeTags.length})
            </span>
            <span class="collapse-icon">▼</span>
          `;

          const content = document.createElement('div');
          content.className = 'tag-list-group-body';

          typeTags.forEach(flatTag => {
            const originalTag = findTagById(flatTag._id);
            if (originalTag) {
              renderTagNode(originalTag, content, {
                includeChildren: false,
                parentId: flatTag._parentId,
                filterBySearch: !!tagSearchQuery
              });
            }
          });

          collapseDiv.appendChild(header);
          collapseDiv.appendChild(content);
          tagListContainer.appendChild(collapseDiv);

          let isCollapsed = false;
          header.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            content.classList.toggle('collapsed');
            header.querySelector('.collapse-icon').classList.toggle('collapsed');
          });
        });
        if (renderedGroups === 0) {
          tagListContainer.innerHTML = '<div class="no-tags">没有匹配的标签</div>';
        }
      }

      function renderTagNode(tag, container, options = {}) {
        // One tag row in the side panel. Event handlers here mutate tag state
        // through helper functions and then refresh the affected UI.
        const includeChildren = options.includeChildren !== false;
        const parentId = options.parentId || null;
        const filterBySearch = options.filterBySearch === true;
        const type = tagTypes[tag.typeIndex];
        const hasChildren = tag.children && tag.children.length > 0;
        const node = document.createElement('div');
        node.className = 'tag-tree-node';

        const row = document.createElement('div');
        row.className = 'tag-node-row';
        if (tagSearchQuery && doesTagMatchSearch(tag)) row.classList.add('search-hit');
        if (canvasBranchFilterIds.includes(String(tag.id))) {
          row.classList.add('canvas-filter-root');
        }
        row.setAttribute('data-tag-id', tag.id);
        row.title = '双击编辑标签文本，右键打开更多操作';

        const childCount = hasChildren ? tag.children.length : 0;
        const displayText = tag.text && tag.text.trim() ? tag.text.trim() : '未命名标签';
        const parentTag = parentId ? findTagById(parentId) : null;
        const parentMeta = parentTag ? ` · 父级: ${parentTag.text || getTypeAbbreviation(tagTypes[parentTag.typeIndex]?.name || 'Tag')}` : '';
        const materialCount = tag.materialLinks && tag.materialLinks.length ? ` · 物料 ${tag.materialLinks.length}` : '';

        row.innerHTML = `
          <button class="tag-node-toggle ${hasChildren && includeChildren ? '' : 'empty'}" type="button">${hasChildren && includeChildren ? '▼' : ''}</button>
          <div class="tag-node-main">
            <span class="tag-node-dot" style="background:${type ? type.color : '#999'}"></span>
            <span class="tag-node-text">${escapeHtml(displayText)}</span>
            <span class="tag-node-meta">${escapeHtml(`${getTypeAbbreviation(type ? type.name : 'Tag')}${childCount ? ` · ${childCount} 子` : ''}${materialCount}${parentMeta}`)}</span>
          </div>
          <div class="tag-node-actions">
            <button class="tag-node-action edit-tag-btn" type="button" title="编辑文本">✎</button>
            <button class="tag-node-action add-child-node-btn" type="button" title="添加子标签">+</button>
            <button class="tag-node-action danger delete-tag-btn" type="button" title="删除">×</button>
          </div>
        `;

        node.appendChild(row);
        container.appendChild(node);

        row.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          showTextEditDialog(tag.id);
        });
        row.addEventListener('contextmenu', (e) => {
          showContextMenu(e, tag.id);
        });

        row.querySelector('.edit-tag-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          showTextEditDialog(tag.id);
        });

        row.querySelector('.delete-tag-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          deleteTagById(tag.id);
        });

        row.querySelector('.add-child-node-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          addChildToTag(tag.id);
        });

        if (type && type.name.includes('Process')) {
          if (!tag.materialLinks) tag.materialLinks = [];
          const materialsDiv = document.createElement('div');
          materialsDiv.className = 'tag-node-materials';
          materialsDiv.innerHTML = `
            <select class="material-select" multiple size="${Math.min(4, Math.max(2, materials.length || 2))}" title="关联物料，按住 Ctrl/Cmd 可多选">
              ${materials.map((m, i) => `<option value="${i}" ${tag.materialLinks.includes(i) ? 'selected' : ''}>${escapeHtml(m.name)} (${escapeHtml(m.abbreviation)})</option>`).join('')}
            </select>
          `;
          node.appendChild(materialsDiv);
          const materialSelect = materialsDiv.querySelector('.material-select');
          materialSelect.addEventListener('change', (e) => {
            const selectedOptions = Array.from(e.target.selectedOptions).map(opt => parseInt(opt.value));
            updateTagMaterialLinks(tag, selectedOptions);
          });
        }

        if (hasChildren && includeChildren) {
          const childrenContent = document.createElement('div');
          childrenContent.className = 'tag-tree-children';
          tag.children.forEach(child => {
            if (!filterBySearch || tagHasSearchMatch(child)) {
              renderTagNode(child, childrenContent, { includeChildren: true, filterBySearch });
            }
          });
          node.appendChild(childrenContent);

          const toggleBtn = row.querySelector('.tag-node-toggle');
          let isCollapsed = false;
          toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            isCollapsed = !isCollapsed;
            childrenContent.style.display = isCollapsed ? 'none' : '';
            toggleBtn.textContent = isCollapsed ? '▶' : '▼';
          });
        }
      }

      // ---------- State mutations and business operations ----------
      // Keep relationship cleanup here so render functions can stay mostly
      // focused on drawing UI from state.
      function updateTagMaterialLinks(tag, selectedOptions) {
        const oldLinks = tag.materialLinks || [];
        tag.materialLinks = selectedOptions;

        oldLinks.forEach(materialIndex => {
          if (!selectedOptions.includes(materialIndex) && materials[materialIndex]) {
            materials[materialIndex].processLinks = materials[materialIndex].processLinks.filter(pid => pid !== tag.id);
          }
        });

        selectedOptions.forEach(materialIndex => {
          if (!oldLinks.includes(materialIndex) && materials[materialIndex] && !materials[materialIndex].processLinks.includes(tag.id)) {
            materials[materialIndex].processLinks.push(tag.id);
          }
        });

        renderMaterialList();
        renderTagList();
        markProjectDirty();
      }

      function deleteTagById(tagId) {
        // 辅助函数：清理单个标签对物料的反向关联
        function cleanTagMaterialLinks(tag) {
          if (tag.materialLinks && tag.materialLinks.length > 0) {
            tag.materialLinks.forEach(materialIndex => {
              if (materials[materialIndex]) {
                materials[materialIndex].processLinks = materials[materialIndex].processLinks.filter(pid => pid !== tag.id);
              }
            });
          }
          // 递归清理子标签
          if (tag.children && tag.children.length > 0) {
            tag.children.forEach(cleanTagMaterialLinks);
          }
        }

        function removeFromArray(arr) {
          for (let i = 0; i < arr.length; i++) {
            if (arr[i].id === tagId) {
              // 在删除前，清理该标签及其所有子标签对物料的反向关联
              cleanTagMaterialLinks(arr[i]);
              
              arr.splice(i, 1);
              return true;
            }
            if (arr[i].children && arr[i].children.length > 0) {
              if (removeFromArray(arr[i].children)) return true;
            }
          }
          return false;
        }
        
        if (removeFromArray(tags)) {
          renderAll();
          markProjectDirty();
        }
      }

      function addChildToTag(parentId) {
        const parentTag = findTagById(parentId);
        if (!parentTag) return;

        if (!parentTag.children) parentTag.children = [];

        let newY = parentTag.y + 0.05;
        let newX = parentTag.x + 0.05;

        if (parentTag.children.length > 0) {
          newY = parentTag.children[0].y;
          const lastChild = parentTag.children[parentTag.children.length - 1];
          newX = lastChild.x + 0.05;
        }

        if (newX > 0.95) newX = 0.95;
        if (newY > 0.95) newY = 0.95;

        const childTypeIndex = currentTypeIndex === parentTag.typeIndex
          ? tagTypes.findIndex((_, idx) => idx !== parentTag.typeIndex)
          : currentTypeIndex;

        if (childTypeIndex === -1) {
          alert('无法创建子标签：没有可用的不同类型。');
          return;
        }

        const newChild = {
          id: Date.now(),
          typeIndex: childTypeIndex,
          text: '',
          x: newX,
          y: newY,
          children: []
        };
        
        parentTag.children.push(newChild);
        renderAll();
        markProjectDirty();
      }

      // ★ 核心修复：renderAll 现在包含类型面板的刷新
      function renderAll() {
        // Central refresh after broad state changes.
        updateCurrentTypeSelect();
        updateCanvasBranchFilterOptions();
        renderMarkers();
        renderTagList();
        renderMaterialList();
      }

      function removeMaterialAtIndex(index) {
        materials.splice(index, 1);
        function fixLinks(tagList) {
          tagList.forEach(tag => {
            if (tag.materialLinks && tag.materialLinks.length > 0) {
              tag.materialLinks = tag.materialLinks
                .filter(materialIndex => materialIndex !== index)
                .map(materialIndex => materialIndex > index ? materialIndex - 1 : materialIndex);
              if (tag.materialLinks.length === 0) delete tag.materialLinks;
            }
            if (tag.children && tag.children.length > 0) fixLinks(tag.children);
          });
        }
        fixLinks(tags);
        materials.forEach(material => {
          material.processLinks = (material.processLinks || []).filter(pid => findTagById(pid));
        });
      }

      function renderMaterialList() {
        materialListContainer.innerHTML = '';
        if (materials.length === 0) {
          materialListContainer.innerHTML = '<div class="no-materials">暂无物料</div>';
          return;
        }

        materials.forEach((material, index) => {
          const materialDiv = document.createElement('div');
          materialDiv.className = 'material-item';
          materialDiv.innerHTML = `
            <div class="material-header">
              <div style="flex:1;">
                <input type="text" class="material-name-input" data-index="${index}" value="${escapeHtml(material.name)}" placeholder="物料名称" style="width:100%; font-weight:600;">
              </div>
              <button class="btn btn-danger btn-sm delete-material-btn" data-index="${index}">删除</button>
            </div>
            
            <div class="material-edit-row">
              <div class="material-field-group">
                <label>缩写</label>
                <input type="text" class="material-abbrev-input" data-index="${index}" value="${escapeHtml(material.abbreviation)}" placeholder="缩写" maxlength="10">
              </div>
              <div class="material-field-group">
                <label>分类</label>
                <input type="text" class="material-category-input" data-index="${index}" value="${escapeHtml(material.category)}" placeholder="分类">
              </div>
            </div>
            
            <div class="material-edit-row full">
              <div class="material-field-group">
                <label>类型</label>
                <input type="text" class="material-type-input" data-index="${index}" value="${escapeHtml(material.type)}" placeholder="类型">
              </div>
            </div>
            
            <div class="material-details">
              <div style="margin-bottom:4px;">
                <strong>关联工序:</strong> ${material.processLinks.length} 个
              </div>
              ${material.processLinks.length > 0 ? `
                <div class="linked-processes" style="max-height:60px; overflow-y:auto; font-size:11px; color:#666;">
                  ${material.processLinks.map(pid => {
                    const processTag = findTagById(pid);
                    if (processTag) {
                      return `<div class="process-link-item" data-tag-id="${pid}" style="cursor:pointer; padding:2px 4px; border-radius:3px; transition:background 0.2s;" onmouseover="this.style.background='#f0f2f5'" onmouseout="this.style.background='transparent'">• ${escapeHtml(processTag.text || '未命名工序')}</div>`;
                    }
                    return '';
                  }).join('')}
                </div>
              ` : '<div style="color:#999; font-style:italic;">暂无关联</div>'}
            </div>
          `;
          materialListContainer.appendChild(materialDiv);
        });

        // 绑定名称编辑事件
        document.querySelectorAll('.material-name-input').forEach(input => {
          input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            materials[index].name = e.target.value;
            markProjectDirty();
          });
        });

        // 绑定缩写编辑事件
        document.querySelectorAll('.material-abbrev-input').forEach(input => {
          input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            materials[index].abbreviation = e.target.value;
            markProjectDirty();
          });
        });

        // 绑定分类编辑事件
        document.querySelectorAll('.material-category-input').forEach(input => {
          input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            materials[index].category = e.target.value;
            markProjectDirty();
          });
        });

        // 绑定类型编辑事件
        document.querySelectorAll('.material-type-input').forEach(input => {
          input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            materials[index].type = e.target.value;
            markProjectDirty();
          });
        });

        // 绑定删除事件
        document.querySelectorAll('.delete-material-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            removeMaterialAtIndex(index);
            renderAll();
            markProjectDirty();
          });
        });
        
        // 绑定工序链接点击事件 - 跳转到对应的标签编辑器
        document.querySelectorAll('.process-link-item').forEach(item => {
          item.addEventListener('click', (e) => {
            const tagId = parseInt(e.currentTarget.dataset.tagId);
            highlightTagInList(tagId);
          });
        });
      }

      function escapeHtml(text) {
        return String(text).replace(/[&<>"]/g, function(m) {
          if (m === '&') return '&amp;';
          if (m === '<') return '&lt;';
          if (m === '>') return '&gt;';
          if (m === '"') return '&quot;';
          return m;
        });
      }

      // ---------- Image loading and tag editing helpers ----------
      // ---------- 图片上传 ----------
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          annotateImage.src = ev.target.result;
          annotateImage.onload = () => {
            imageNaturalWidth = annotateImage.naturalWidth;
            imageNaturalHeight = annotateImage.naturalHeight;
            imageWrapper.style.display = 'block';
            placeholder.style.display = 'none';
            fitCanvasToImage();
            
            // 应用当前的文本显示设置
            updateTextVisibility();
            
            // 等待图片容器尺寸稳定后再渲染
            setTimeout(() => {
              tags = [];
              resetView();
              renderAll();
              markProjectDirty();
            }, 50);
          };
        };
        reader.readAsDataURL(file);
      });

      // 在指定位置创建标签
      function createTagAtPosition(x, y) {
        // x/y are normalized image coordinates, not pixels.
        const newTag = {
          id: Date.now(),
          typeIndex: currentTypeIndex,
          text: '',
          x: x,
          y: y,
          children: []
        };
        tags.push(newTag);
        renderAll();
        markProjectDirty();
      }

      // 检查节点及其所有子节点的文本是否全部隐藏
      function checkAllTextHidden(tag) {
        // 如果当前节点明确被标记为隐藏
        if (tag._textHidden === true) {
          // 检查所有子节点是否也都被隐藏
          if (tag.children && tag.children.length > 0) {
            for (let child of tag.children) {
              if (!checkAllTextHidden(child)) {
                return false;
              }
            }
          }
          return true;
        }
        // 如果当前节点没有被标记为隐藏（包括undefined和false），返回false
        return false;
      }

      // 切换节点及其所有子节点的文本显示/隐藏
      function toggleNodeTextVisibility(tag, show) {
        // 设置或清除隐藏标记
        tag._textHidden = !show;
        
        // 递归处理所有子节点
        if (tag.children && tag.children.length > 0) {
          tag.children.forEach(child => toggleNodeTextVisibility(child, show));
        }
      }

      // 强制更新标记点文本显示状态
      function updateMarkerTextDisplay() {
        const markers = document.querySelectorAll('.tag-marker');
        const isGlobalShow = imageWrapper.classList.contains('show-text');
        
        markers.forEach(marker => {
          const tagId = parseInt(marker.getAttribute('data-tag-id'));
          const tag = findTagById(tagId);
          if (tag) {
            const textSpan = marker.querySelector('.tag-text');
            if (textSpan) {
              // 只有当全局显示开启 且 节点没有被手动隐藏 且 有文本内容时才显示
              const shouldShow = isGlobalShow && tag._textHidden !== true && tag.text && tag.text.trim() !== '';
              
              if (shouldShow) {
                textSpan.classList.remove('force-hidden');
              } else {
                textSpan.classList.add('force-hidden');
              }
            }
          }
        });
      }

      // 显示类型选择子菜单
      function showTypeSubMenu(tagId) {
        const tag = findTagById(tagId);
        if (!tag) return;

        // 清空并重建子菜单
        typeSubMenu.innerHTML = '';
        
        tagTypes.forEach((type, index) => {
          const option = document.createElement('div');
          option.className = 'context-menu-item type-option';
          if (index === tag.typeIndex) {
            option.classList.add('current');
          }
          
          option.innerHTML = `
            ${type.icon ? `<img src="${escapeHtml(type.icon)}" class="type-icon-preview" alt="${escapeHtml(type.name)}">` : `<span class="type-option-dot" style="background: ${type.color}"></span>`}
            <span>${escapeHtml(type.name)}</span>
          `;
          
          option.addEventListener('click', (e) => {
            e.stopPropagation();
            changeTagType(tagId, index);
            hideContextMenu();
          });
          
          typeSubMenu.appendChild(option);
        });
        
        // 定位子菜单（在主菜单右侧）
        const menuRect = contextMenu.getBoundingClientRect();
        typeSubMenu.style.left = (menuRect.right + 5) + 'px';
        typeSubMenu.style.top = menuRect.top + 'px';
        typeSubMenu.classList.add('show');
      }

      // 修改标签类型
      function changeTagType(tagId, newTypeIndex) {
        const tag = findTagById(tagId);
        if (tag) {
          tag.typeIndex = newTypeIndex;
          renderAll();
          markProjectDirty();
        }
      }

      // 在右侧列表中高亮定位标签
      function highlightTagInList(tagId) {
        // 清除之前的高亮
        document.querySelectorAll('.tag-node-row.highlighted').forEach(el => {
          el.classList.remove('highlighted');
        });

        // 通过data-tag-id属性找到对应的节点行
        const targetEditor = tagListContainer.querySelector(`.tag-node-row[data-tag-id="${tagId}"]`);
        
        if (targetEditor) {
          // 展开所有父级折叠区域
          let parent = targetEditor.parentElement;
          while (parent && parent !== document.body) {
            if (parent.classList.contains('tag-tree-children') && parent.style.display === 'none') {
              parent.style.display = '';
              const row = parent.previousElementSibling;
              const toggle = row ? row.querySelector('.tag-node-toggle') : null;
              if (toggle) toggle.textContent = '▼';
            }
            if (parent.classList.contains('tag-list-group-body') && parent.classList.contains('collapsed')) {
              parent.classList.remove('collapsed');
              const header = parent.previousElementSibling;
              if (header && header.classList.contains('tag-list-group-header')) {
                const icon = header.querySelector('.collapse-icon');
                if (icon) icon.classList.remove('collapsed');
              }
            }
            parent = parent.parentElement;
          }
          
          // 高亮显示
          targetEditor.classList.add('highlighted');
          
          // 滚动到可视区域
          setTimeout(() => {
            targetEditor.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }, 100);
          
          // 3秒后移除高亮
          setTimeout(() => {
            targetEditor.classList.remove('highlighted');
          }, 3000);
        }
      }

      // 文本显示全局控制
      function updateTextVisibility() {
        if (showTextCheckbox.checked) {
          imageWrapper.classList.add('show-text');
        } else {
          imageWrapper.classList.remove('show-text');
        }
      }
      showTextCheckbox.addEventListener('change', updateTextVisibility);

      // ---------- Canvas interaction ----------
      // Right-click empty image space to create a new root tag.
      // ---------- 图片右键菜单 (用于创建新标签) ----------
      imageWrapper.addEventListener('contextmenu', (e) => {
        if (!annotateImage.src) return;
        // 如果点击的是标记点，让标记点的事件处理
        if (e.target.closest('.tag-marker')) return;

        e.preventDefault(); // 阻止默认浏览器右键菜单

        const point = getCanvasPointFromEvent(e);
        const rx = point.x / annotationCanvas.offsetWidth;
        const ry = point.y / annotationCanvas.offsetHeight;

        if (rx < 0 || rx > 1 || ry < 0 || ry > 1) return;

        showContextMenu(e, null, { x: rx, y: ry });
      });

      // ---------- 拖拽移动标签 ----------
      let dragTag = null;
      let dragStartMouse = { x: 0, y: 0 };
      let dragStartPos = { x: 0, y: 0 };

      function startDrag(flatTag, e) {
        // The list/canvas may pass flattened tags; always mutate the original
        // nested tag object so export/import and child relationships stay intact.
        e.preventDefault();
        e.stopPropagation();
        
        const originalTag = findTagById(flatTag._id);
        if (!originalTag) return;

        dragTag = originalTag;
        dragStartMouse.x = e.clientX;
        dragStartMouse.y = e.clientY;
        dragStartPos.x = originalTag.x;
        dragStartPos.y = originalTag.y;

        window.addEventListener('mousemove', onDrag);
        window.addEventListener('mouseup', stopDrag);
      }

      function onDrag(e) {
        if (!dragTag) return;
        // Convert screen-pixel mouse movement back into normalized image space.
        const dx = (e.clientX - dragStartMouse.x) / (annotationCanvas.offsetWidth * zoomLevel);
        const dy = (e.clientY - dragStartMouse.y) / (annotationCanvas.offsetHeight * zoomLevel);

        dragTag.x = Math.min(1, Math.max(0, dragStartPos.x + dx));
        dragTag.y = Math.min(1, Math.max(0, dragStartPos.y + dy));

        renderMarkers();
        renderTagList();
      }

      function stopDrag() {
        if (dragTag) {
          markProjectDirty();
        }
        dragTag = null;
        window.removeEventListener('mousemove', onDrag);
        window.removeEventListener('mouseup', stopDrag);
      }

      // ---------- 图片拖拽平移功能 ----------
      let isPanning = false;
      let panStartMouse = { x: 0, y: 0 };
      let panOffset = { x: 0, y: 0 };
      let zoomLevel = 1;

      function fitCanvasToImage() {
        // The image is rendered at a fitted display size, while tag coordinates
        // remain normalized and independent from this current display size.
        const naturalWidth = annotateImage.naturalWidth || 1;
        const naturalHeight = annotateImage.naturalHeight || 1;
        const maxWidth = Math.max(1, imageWrapper.clientWidth);
        const maxHeight = Math.max(1, imageWrapper.clientHeight);
        const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
        const width = Math.max(1, Math.round(naturalWidth * scale));
        const height = Math.max(1, Math.round(naturalHeight * scale));
        annotateImage.style.width = `${width}px`;
        annotateImage.style.height = `${height}px`;
        annotationCanvas.style.width = `${width}px`;
        annotationCanvas.style.height = `${height}px`;
      }

      function applyPanTransform() {
        imageWrapper.style.setProperty('--pan-x', `${panOffset.x}px`);
        imageWrapper.style.setProperty('--pan-y', `${panOffset.y}px`);
        imageWrapper.style.setProperty('--zoom', zoomLevel.toFixed(4));
        zoomReadout.textContent = `${Math.round(zoomLevel * 100)}%`;
      }

      function resetView() {
        zoomLevel = 1;
        panOffset = {
          x: Math.round((imageWrapper.clientWidth - annotationCanvas.offsetWidth) / 2),
          y: Math.round((imageWrapper.clientHeight - annotationCanvas.offsetHeight) / 2)
        };
        applyPanTransform();
      }

      function getCanvasPointFromEvent(e) {
        // Convert a browser mouse event into current canvas display coordinates,
        // accounting for pan and zoom.
        const wrapperRect = imageWrapper.getBoundingClientRect();
        return {
          x: (e.clientX - wrapperRect.left - panOffset.x) / zoomLevel,
          y: (e.clientY - wrapperRect.top - panOffset.y) / zoomLevel
        };
      }

      function clampPan() {
        const scaledWidth = annotationCanvas.offsetWidth * zoomLevel;
        const scaledHeight = annotationCanvas.offsetHeight * zoomLevel;
        const wrapperWidth = imageWrapper.clientWidth;
        const wrapperHeight = imageWrapper.clientHeight;
        const horizontalPeek = Math.min(180, Math.max(64, wrapperWidth * 0.18));
        const verticalPeek = Math.min(140, Math.max(48, wrapperHeight * 0.18));
        const centerX = (wrapperWidth - scaledWidth) / 2;
        const centerY = (wrapperHeight - scaledHeight) / 2;

        let minX;
        let maxX;
        let minY;
        let maxY;

        if (scaledWidth <= wrapperWidth) {
          minX = centerX - horizontalPeek;
          maxX = centerX + horizontalPeek;
        } else {
          minX = wrapperWidth - scaledWidth - horizontalPeek;
          maxX = horizontalPeek;
        }

        if (scaledHeight <= wrapperHeight) {
          minY = centerY - verticalPeek;
          maxY = centerY + verticalPeek;
        } else {
          minY = wrapperHeight - scaledHeight - verticalPeek;
          maxY = verticalPeek;
        }

        panOffset.x = Math.max(minX, Math.min(maxX, panOffset.x));
        panOffset.y = Math.max(minY, Math.min(maxY, panOffset.y));
      }

      function zoomAt(pointX, pointY, nextZoom) {
        // Zoom around the pointer/center by adjusting pan so the target point
        // remains visually anchored.
        const canvasX = (pointX - panOffset.x) / zoomLevel;
        const canvasY = (pointY - panOffset.y) / zoomLevel;
        zoomLevel = Math.max(0.25, Math.min(4, nextZoom));
        panOffset.x = pointX - canvasX * zoomLevel;
        panOffset.y = pointY - canvasY * zoomLevel;
        clampPan();
        applyPanTransform();
      }

      function zoomAtCenter(multiplier) {
        zoomAt(imageWrapper.clientWidth / 2, imageWrapper.clientHeight / 2, zoomLevel * multiplier);
      }

      imageWrapper.addEventListener('mousedown', (e) => {
        // 如果点击的是标记点，则不进行平移
        if (e.target.closest('.tag-marker')) return;
        if (e.target.closest('.canvas-controls')) return;
        
        isPanning = true;
        imageWrapper.classList.add('panning');
        panStartMouse.x = e.clientX;
        panStartMouse.y = e.clientY;
        e.preventDefault();

        window.addEventListener('mousemove', onPan);
        window.addEventListener('mouseup', stopPan);
      });

      function onPan(e) {
        if (!isPanning) return;

        const dx = e.clientX - panStartMouse.x;
        const dy = e.clientY - panStartMouse.y;

        panOffset.x += dx;
        panOffset.y += dy;

        clampPan();

        applyPanTransform();

        panStartMouse.x = e.clientX;
        panStartMouse.y = e.clientY;
      }

      function stopPan() {
        if (isPanning) {
          isPanning = false;
          imageWrapper.classList.remove('panning');
          window.removeEventListener('mousemove', onPan);
          window.removeEventListener('mouseup', stopPan);
        }
      }

      imageWrapper.addEventListener('wheel', (e) => {
        if (!annotateImage.src) return;
        e.preventDefault();

        const wrapperRect = imageWrapper.getBoundingClientRect();
        const pointerX = e.clientX - wrapperRect.left;
        const pointerY = e.clientY - wrapperRect.top;
        const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        zoomAt(pointerX, pointerY, zoomLevel * zoomFactor);
      }, { passive: false });

      zoomInBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        zoomAtCenter(1.2);
      });
      zoomOutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        zoomAtCenter(1 / 1.2);
      });
      zoomResetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetView();
      });

      window.addEventListener('resize', () => {
        if (!annotateImage.src || imageWrapper.style.display === 'none') return;
        fitCanvasToImage();
        resetView();
        renderMarkers();
      });

      // ---------- 当前类型选择 ----------
      currentTypeSelect.addEventListener('change', (e) => {
        currentTypeIndex = parseInt(e.target.value);
      });

      // ---------- 添加物料 ----------
      addMaterialBtn.addEventListener('click', () => {
        const newMaterial = {
          name: '新物料',
          abbreviation: 'NM',
          category: '原材料',
          type: 'a料',
          processLinks: []
        };
        materials.push(newMaterial);
        renderMaterialList();
        markProjectDirty();
      });

      // ---------- 清空所有标签 ----------
      clearAllBtn.addEventListener('click', () => {
        tags = [];
        materials.forEach(m => m.processLinks = []); // 清空物料的工序关联
        renderAll();
        markProjectDirty();
      });

      // ---------- 导出 JSON ----------
      exportBtn.addEventListener('click', () => {
        const data = serializeProjectData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentProjectTitle || 'image-annotation-advanced'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });

      // ---------- 导入 JSON ----------
      importBtn.addEventListener('click', () => {
        importFileInput.click();
      });

      importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (!data.tagTypes || !data.tags) {
              alert('无效的JSON文件格式！');
              return;
            }
            const defaultName = file.name.replace(/\.json$/i, '') || '导入项目';
            const name = prompt('请输入导入后创建的项目名称', defaultName);
            if (!name || !name.trim()) return;
            importProjectFromJson(data, name.trim())
              .then(() => alert('导入成功，已创建新项目！'))
              .catch(error => alert('导入失败：' + error.message));
          } catch (error) {
            alert('JSON文件解析失败：' + error.message);
          }
        };
        reader.readAsText(file);
        
        // 清空文件输入框，允许重复导入同一文件
        importFileInput.value = '';
      });

      // ---------- 初始化 ----------
      // Initial render assumes there is no loaded image yet. Upload/import flows
      // call resetView() and renderAll() again after image dimensions are known.
      resetProjectData();
      renderAll();
      updateTextVisibility();
      setWorkspaceVisible(false);
      loadProjectList();
    })();
