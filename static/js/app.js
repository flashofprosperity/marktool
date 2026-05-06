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

      const APP_TITLE = 'MES Core Data Designer';
      const LANGUAGE_STORAGE_KEY = 'mes-core-data-designer-language';
      const I18N = {
        'zh-CN': {
          'app.title': 'MES Core Data Designer',
          'nav.projects': '项目列表',
          'toolbar.currentType': '当前标记类型',
          'toolbar.showText': '显示标记文本',
          'toolbar.export': '导出 JSON',
          'toolbar.import': '导入',
          'toolbar.importType': '导入类型',
          'toolbar.importJson': 'JSON',
          'toolbar.importCsv': 'CSV',
          'toolbar.importXml': 'XML',
          'toolbar.clearAll': '清空所有标签',
          'toolbar.language': '语言',
          'auth.logout': '退出',
          'auth.loginTitle': '登录',
          'auth.loginHelp': '请输入账号后继续使用标注工具。',
          'auth.username': '用户名',
          'auth.password': '密码',
          'auth.loginButton': '登录',
          'auth.notLoggedIn': '未登录',
          'auth.loginRequired': '请登录',
          'auth.admin': '管理员',
          'auth.user': '普通用户',
          'projects.title': '项目',
          'projects.help': '选择一个服务端项目继续标注，或创建新的持久化项目。',
          'projects.new': '新建项目',
          'projects.newBlank': '新建空白',
          'projects.newJson': 'JSON 新建',
          'projects.newCsv': 'CSV 新建',
          'projects.newXml': 'XML 新建',
          'projects.noneAdmin': '暂无项目，点击“新建项目”开始。',
          'projects.noneUser': '暂无项目，请联系管理员创建。',
          'projects.noMatch': '没有匹配的项目。',
          'projects.loading': '正在加载项目...',
          'projects.loadFailed': '项目加载失败：{message}',
          'projects.updatedAt': '更新于 {time}',
          'projects.open': '打开',
          'projects.delete': '删除',
          'projects.editTags': '编辑标签',
          'projects.editName': '编辑名称',
          'projects.editMenu': '编辑',
          'projects.copy': '复制',
          'projects.xmlUpdate': 'XML 更新',
          'projects.searchPlaceholder': '搜索项目或标签',
          'projects.allTags': '全部标签',
          'projects.groupList': '默认列表',
          'projects.groupByTag': '按标签分组',
          'projects.sortByUpdated': '按时间排序',
          'projects.sortByName': '按首字母排序',
          'projects.uncategorized': '未分类',
          'projects.promptTags': '请输入项目标签，用逗号分隔',
          'projects.tagsUpdateFailed': '项目标签更新失败：{message}',
          'projects.xmlUpdateSuccess': 'XML 更新完成。',
          'projects.xmlUpdateFailed': 'XML 更新失败：{message}',
          'projects.untitled': '该项目',
          'projects.unopened': '未打开项目',
          'projects.choose': '请选择项目',
          'projects.promptName': '请输入项目名称',
          'projects.renameFailed': '项目名称更新失败：{message}',
          'projects.copyName': '{name} 副本',
          'projects.promptCopyName': '请输入复制后的项目名称',
          'projects.copyFailed': '复制项目失败：{message}',
          'projects.summary': '共 {total} 个项目，当前显示 {visible} 个',
          'projects.promptImportName': '请输入导入后创建的项目名称',
          'projects.confirmDelete': '确定删除“{title}”？此操作不可恢复。',
          'projects.openFailed': '打开项目失败：{message}',
          'projects.createFailed': '创建项目失败：{message}',
          'projects.deleteFailed': '删除项目失败：{message}',
          'projects.adminCreateOnly': '只有管理员可以新建项目',
          'projects.adminDeleteOnly': '只有管理员可以删除项目',
          'save.saved': '已保存',
          'save.saving': '保存中',
          'save.dirty': '未保存',
          'save.failed': '保存失败',
          'api.requestFailed': '请求失败',
          'menu.createTag': '在此创建标签',
          'menu.showText': '显示文本',
          'menu.hideText': '隐藏文本',
          'menu.editText': '修改文本',
          'menu.editEvent': '查看/编辑事件信息',
          'menu.showEvents': '显示事件',
          'menu.hideEvents': '隐藏事件',
          'menu.addChild': '添加子标签',
          'menu.deleteTag': '删除标签',
          'dialog.editTitle': '修改标签文本',
          'dialog.editPlaceholder': '输入标签文本',
          'dialog.eventTitle': '事件信息',
          'dialog.locationCategoryTitle': '选择 Location 分类',
          'common.cancel': '取消',
          'common.confirm': '确认',
          'workspace.upload': '上传图片',
          'workspace.imageAlt': '标注图片',
          'workspace.placeholder': '请上传一张图片开始标注',
          'canvas.zoomOut': '缩小',
          'canvas.zoomIn': '放大',
          'canvas.reset': '重置',
          'canvas.resetTitle': '重置视图',
          'canvas.renderMode': '渲染模式',
          'canvas.renderImageMode': '图片比例',
          'canvas.renderScreenMode': '清晰总览',
          'panel.toggle': '折叠/展开',
          'panel.view': '视图',
          'panel.tags': '标签列表',
          'groups.title': 'Location 集合',
          'groups.toggle': '显示集合视图',
          'groups.create': '新建集合',
          'groups.empty': '暂无 Location 集合。',
          'groups.noStations': '请先创建 Station。',
          'groups.noLocations': '该 Station 下暂无 Location。',
          'groups.name': '名称',
          'groups.station': '所属 Station',
          'groups.locations': '包含 Location',
          'groups.iconSize': '图标大小',
          'groups.locate': '定位',
          'groups.events': '事件',
          'groups.edit': '编辑',
          'groups.rename': '重命名',
          'groups.delete': '删除',
          'groups.collapse': '折叠',
          'groups.expand': '展开',
          'groups.save': '保存',
          'groups.cancel': '取消',
          'groups.defaultName': 'Location 集合',
          'groups.count': '{count} 个 Location',
          'groups.unassigned': '未命名 Location',
          'groups.confirmDelete': '删除 Location 集合“{name}”？不会删除原 Location。',
          'groups.clickToExpand': '点击展开集合',
          'groups.searchHit': '搜索命中',
          'groups.byStation': '按 Station 分类',
          'groups.resize': '调整大小',
          'panel.searchPlaceholder': '搜索标签、类型、坐标',
          'panel.clearSearch': '清空搜索',
          'panel.canvasDisplay': '画布显示',
          'panel.treeMode': '树状结构',
          'panel.typeMode': '按类型',
          'panel.collapseAll': '全部折叠',
          'panel.allNodes': '全部节点',
          'panel.selectedNodes': '已选 {count} 个节点',
          'panel.noNodes': '暂无节点',
          'panel.noMatchingNodes': '无匹配节点',
          'panel.selectAll': '全选',
          'panel.covered': '（已由父节点隐藏）',
          'panel.currentPrefix': '当前: ',
          'tags.empty': '暂无标签，点击图片添加',
          'tags.noMatch': '没有匹配的标签',
          'tags.unnamed': '未命名标签',
          'tags.children': '{count} 子',
          'tags.parent': '父级: {name}',
          'tags.rowTitle': '双击编辑标签文本，右键打开更多操作',
          'tags.editTitle': '编辑文本',
          'tags.addChildTitle': '添加子标签',
          'tags.deleteTitle': '删除',
          'tags.assignCoordinateTitle': '定位',
          'tags.unassignedCoordinate': '未定位',
          'tags.noChildType': '无法创建子标签：当前层级仅支持 Station > Location > Event。',
          'tags.locationCategory': 'Location 分类',
          'tags.locationEquipment': '设备',
          'tags.locationProcess': '工序',
          'tags.chooseLocationCategory': '请选择 Location 分类',
          'event.name': 'Event',
          'event.switch': 'Event switch',
          'event.switchShort': 'es',
          'event.switchFunction': 'Event switch function',
          'event.unnamed': '未命名事件',
          'event.listTitle': '关联事件',
          'event.processSteps': '加工步骤',
          'event.addStep': '+ 添加步骤',
          'event.processStep': 'Process step',
          'event.processStepName': 'Process step name',
          'event.constraint': 'Constraint',
          'event.command': 'Command',
          'event.commandTemplateName': 'Command template name',
          'event.deleteStep': '删除步骤',
          'materials.title': '物料管理',
          'materials.empty': '暂无物料',
          'materials.add': '+ 添加物料',
          'materials.defaultName': '物料A',
          'materials.defaultCategory': '原材料',
          'materials.defaultType': 'a料',
          'materials.newName': '新物料',
          'materials.newAbbrev': 'NM',
          'materials.namePlaceholder': '物料名称',
          'materials.abbrev': '缩写',
          'materials.category': '分类',
          'materials.type': '类型',
          'materials.delete': '删除',
          'export.adminOnly': '只有管理员可以导出 JSON',
          'export.defaultName': 'mes-core-data-designer',
          'import.adminOnly': '只有管理员可以导入项目',
          'import.invalidJson': '无效的JSON文件格式！',
          'import.defaultProject': '导入项目',
          'import.success': '导入成功，已创建新项目！',
          'import.failed': '导入失败：{message}',
          'import.parseFailed': 'JSON文件解析失败：{message}',
          'xml.uploading': '正在上传 XML 文件...',
          'xml.submitted': 'XML 已上传，正在后台处理...',
          'xml.success': 'XML 导入完成，已创建新项目。',
          'xml.failed': 'XML 导入失败：{message}',
          'xml.pollFailed': '查询 XML 导入任务失败：{message}',
          'csv.importFailed': 'CSV导入失败：{message}',
          'csv.importSuccess': 'CSV导入完成：新增 {stations} 个 Station，新增 {locations} 个 Location，跳过 {skipped} 行。',
          'csv.missingColumns': 'CSV缺少必要列：Station No. 或 LocationID。',
          'csv.empty': 'CSV没有可导入的数据。',
          'csv.noProject': '请先打开项目再导入 CSV。',
          'csv.noImage': '请先上传图片再分配坐标。',
          'csv.assignHint': '请在图片上点击，为 {name} 分配坐标。',
          'csv.assignButtonTitle': '点击后在图片上定位该 Station'
        },
        'en-US': {
          'app.title': 'MES Core Data Designer',
          'nav.projects': 'Projects',
          'toolbar.currentType': 'Current label type',
          'toolbar.showText': 'Show label text',
          'toolbar.export': 'Export JSON',
          'toolbar.import': 'Import',
          'toolbar.importType': 'Import type',
          'toolbar.importJson': 'JSON',
          'toolbar.importCsv': 'CSV',
          'toolbar.importXml': 'XML',
          'toolbar.clearAll': 'Clear all labels',
          'toolbar.language': 'Language',
          'auth.logout': 'Log out',
          'auth.loginTitle': 'Sign in',
          'auth.loginHelp': 'Enter your account to continue designing core data.',
          'auth.username': 'Username',
          'auth.password': 'Password',
          'auth.loginButton': 'Sign in',
          'auth.notLoggedIn': 'Not signed in',
          'auth.loginRequired': 'Please sign in',
          'auth.admin': 'Admin',
          'auth.user': 'User',
          'projects.title': 'Projects',
          'projects.help': 'Choose a server project to continue, or create a new persistent project.',
          'projects.new': 'New project',
          'projects.newBlank': 'Blank',
          'projects.newJson': 'From JSON',
          'projects.newCsv': 'From CSV',
          'projects.newXml': 'From XML',
          'projects.noneAdmin': 'No projects yet. Click "New project" to start.',
          'projects.noneUser': 'No projects yet. Contact an admin to create one.',
          'projects.noMatch': 'No matching projects.',
          'projects.loading': 'Loading projects...',
          'projects.loadFailed': 'Project load failed: {message}',
          'projects.updatedAt': 'Updated {time}',
          'projects.open': 'Open',
          'projects.delete': 'Delete',
          'projects.editTags': 'Edit tags',
          'projects.editName': 'Edit name',
          'projects.editMenu': 'Edit',
          'projects.copy': 'Copy',
          'projects.xmlUpdate': 'XML update',
          'projects.searchPlaceholder': 'Search projects or tags',
          'projects.allTags': 'All tags',
          'projects.groupList': 'List',
          'projects.groupByTag': 'Group by tag',
          'projects.sortByUpdated': 'By updated time',
          'projects.sortByName': 'By first letter',
          'projects.uncategorized': 'Uncategorized',
          'projects.promptTags': 'Enter project tags, separated by commas',
          'projects.tagsUpdateFailed': 'Project tag update failed: {message}',
          'projects.xmlUpdateSuccess': 'XML update complete.',
          'projects.xmlUpdateFailed': 'XML update failed: {message}',
          'projects.untitled': 'this project',
          'projects.unopened': 'No project open',
          'projects.choose': 'Choose a project',
          'projects.promptName': 'Enter a project name',
          'projects.renameFailed': 'Project rename failed: {message}',
          'projects.copyName': '{name} copy',
          'projects.promptCopyName': 'Enter the copied project name',
          'projects.copyFailed': 'Copy project failed: {message}',
          'projects.summary': '{total} projects, {visible} shown',
          'projects.promptImportName': 'Enter the new project name for this import',
          'projects.confirmDelete': 'Delete "{title}"? This cannot be undone.',
          'projects.openFailed': 'Open project failed: {message}',
          'projects.createFailed': 'Create project failed: {message}',
          'projects.deleteFailed': 'Delete project failed: {message}',
          'projects.adminCreateOnly': 'Only admins can create projects',
          'projects.adminDeleteOnly': 'Only admins can delete projects',
          'save.saved': 'Saved',
          'save.saving': 'Saving',
          'save.dirty': 'Unsaved',
          'save.failed': 'Save failed',
          'api.requestFailed': 'Request failed',
          'menu.createTag': 'Create label here',
          'menu.showText': 'Show text',
          'menu.hideText': 'Hide text',
          'menu.editText': 'Edit text',
          'menu.editEvent': 'View/edit event info',
          'menu.showEvents': 'Show events',
          'menu.hideEvents': 'Hide events',
          'menu.addChild': 'Add child label',
          'menu.deleteTag': 'Delete label',
          'dialog.editTitle': 'Edit label text',
          'dialog.editPlaceholder': 'Enter label text',
          'dialog.eventTitle': 'Event information',
          'dialog.locationCategoryTitle': 'Choose Location category',
          'common.cancel': 'Cancel',
          'common.confirm': 'Confirm',
          'workspace.upload': 'Upload image',
          'workspace.imageAlt': 'Annotated image',
          'workspace.placeholder': 'Upload an image to start labeling',
          'canvas.zoomOut': 'Zoom out',
          'canvas.zoomIn': 'Zoom in',
          'canvas.reset': 'Reset',
          'canvas.resetTitle': 'Reset view',
          'canvas.renderMode': 'Render mode',
          'canvas.renderImageMode': 'Image scale',
          'canvas.renderScreenMode': 'Screen clear',
          'panel.toggle': 'Collapse/expand',
          'panel.view': 'View',
          'panel.tags': 'Label list',
          'groups.title': 'Location Group',
          'groups.toggle': 'Show group view',
          'groups.create': 'New group',
          'groups.empty': 'No Location Groups yet.',
          'groups.noStations': 'Create a Station first.',
          'groups.noLocations': 'This Station has no Locations.',
          'groups.name': 'Name',
          'groups.station': 'Station',
          'groups.locations': 'Locations',
          'groups.iconSize': 'Icon size',
          'groups.locate': 'Locate',
          'groups.events': 'Events',
          'groups.edit': 'Edit',
          'groups.rename': 'Rename',
          'groups.delete': 'Delete',
          'groups.collapse': 'Collapse',
          'groups.expand': 'Expand',
          'groups.save': 'Save',
          'groups.cancel': 'Cancel',
          'groups.defaultName': 'Location Group',
          'groups.count': '{count} Location(s)',
          'groups.unassigned': 'Unnamed Location',
          'groups.confirmDelete': 'Delete Location Group "{name}"? Original Locations will remain.',
          'groups.clickToExpand': 'Click to expand group',
          'groups.searchHit': 'Search match',
          'groups.byStation': 'Group by Station',
          'groups.resize': 'Resize',
          'panel.searchPlaceholder': 'Search labels, types, coordinates',
          'panel.clearSearch': 'Clear search',
          'panel.canvasDisplay': 'Canvas',
          'panel.treeMode': 'Tree',
          'panel.typeMode': 'By type',
          'panel.collapseAll': 'Collapse all',
          'panel.allNodes': 'All nodes',
          'panel.selectedNodes': '{count} nodes selected',
          'panel.noNodes': 'No nodes',
          'panel.noMatchingNodes': 'No matching nodes',
          'panel.selectAll': 'Select all',
          'panel.covered': ' (hidden by parent)',
          'panel.currentPrefix': 'Current: ',
          'tags.empty': 'No labels. Click the image to add one.',
          'tags.noMatch': 'No matching labels',
          'tags.unnamed': 'Unnamed label',
          'tags.children': '{count} child',
          'tags.parent': 'Parent: {name}',
          'tags.rowTitle': 'Double-click to edit text, right-click for more actions',
          'tags.editTitle': 'Edit text',
          'tags.addChildTitle': 'Add child label',
          'tags.deleteTitle': 'Delete',
          'tags.assignCoordinateTitle': 'Locate',
          'tags.unassignedCoordinate': 'Unlocated',
          'tags.noChildType': 'Cannot create child label: the current hierarchy supports Station > Location > Event.',
          'tags.locationCategory': 'Location category',
          'tags.locationEquipment': 'Equipment',
          'tags.locationProcess': 'Process',
          'tags.chooseLocationCategory': 'Choose Location category',
          'event.name': 'Event',
          'event.switch': 'Event switch',
          'event.switchShort': 'es',
          'event.switchFunction': 'Event switch function',
          'event.unnamed': 'Unnamed event',
          'event.listTitle': 'Events',
          'event.processSteps': 'Process steps',
          'event.addStep': '+ Add step',
          'event.processStep': 'Process step',
          'event.processStepName': 'Process step name',
          'event.constraint': 'Constraint',
          'event.command': 'Command',
          'event.commandTemplateName': 'Command template name',
          'event.deleteStep': 'Delete step',
          'materials.title': 'Materials',
          'materials.empty': 'No materials',
          'materials.add': '+ Add material',
          'materials.defaultName': 'Material A',
          'materials.defaultCategory': 'Raw material',
          'materials.defaultType': 'Type A',
          'materials.newName': 'New material',
          'materials.newAbbrev': 'NM',
          'materials.namePlaceholder': 'Material name',
          'materials.abbrev': 'Abbrev.',
          'materials.category': 'Category',
          'materials.type': 'Type',
          'materials.delete': 'Delete',
          'export.adminOnly': 'Only admins can export JSON',
          'export.defaultName': 'mes-core-data-designer',
          'import.adminOnly': 'Only admins can import projects',
          'import.invalidJson': 'Invalid JSON file format.',
          'import.defaultProject': 'Imported project',
          'import.success': 'Import complete. A new project was created.',
          'import.failed': 'Import failed: {message}',
          'import.parseFailed': 'JSON parse failed: {message}',
          'xml.uploading': 'Uploading XML file...',
          'xml.submitted': 'XML uploaded. Processing in the background...',
          'xml.success': 'XML import complete. A new project was created.',
          'xml.failed': 'XML import failed: {message}',
          'xml.pollFailed': 'XML import status check failed: {message}',
          'csv.importFailed': 'CSV import failed: {message}',
          'csv.importSuccess': 'CSV import complete: {stations} Station(s), {locations} Location(s), {skipped} row(s) skipped.',
          'csv.missingColumns': 'CSV is missing required columns: Station No. or LocationID.',
          'csv.empty': 'CSV has no importable rows.',
          'csv.noProject': 'Open a project before importing CSV.',
          'csv.noImage': 'Upload an image before assigning coordinates.',
          'csv.assignHint': 'Click the image to locate {name}.',
          'csv.assignButtonTitle': 'Click, then locate this Station on the image'
        }
      };
      let currentLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'zh-CN';
      if (!I18N[currentLanguage]) currentLanguage = 'zh-CN';

      function t(key, params = {}) {
        const dictionary = I18N[currentLanguage] || I18N['zh-CN'];
        const template = dictionary[key] || I18N['zh-CN'][key] || key;
        return template.replace(/\{(\w+)\}/g, (_, name) => {
          return Object.prototype.hasOwnProperty.call(params, name) ? params[name] : `{${name}}`;
        });
      }

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
          color: '#c92a2a',
          icon: './static/icons/station.svg'
        },
        { 
          name: 'Location', 
          color: '#005f99',
          icon: './static/icons/location.svg'
        },
        {
          name: 'Event',
          color: '#b7791f',
          icon: './static/icons/event.svg'
        }
      ];
      
      /*
       * material item:
       * {
       *   name: string,
       *   abbreviation: short display text,
       *   category: string,
       *   type: string,
       *   processLinks: legacy linked tag id[]
       * }
       */
      const materials = [
        {
          name: t('materials.defaultName'),
          abbreviation: 'MA',
          category: t('materials.defaultCategory'),
          type: t('materials.defaultType')
        },
      ];
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
      let eventRecords = [];
      
      let imageNaturalWidth = 0;
      let imageNaturalHeight = 0;
      const baseTagTypes = tagTypes.map(type => ({ ...type }));

      // ---------- DOM 元素 ----------
      // Keep DOM lookups centralized. The rest of the file should reuse these
      // references instead of calling getElementById again unless the element is
      // created dynamically.
      const loginHome = document.getElementById('loginHome');
      const toolbar = document.querySelector('.toolbar');
      const loginForm = document.getElementById('loginForm');
      const loginUsername = document.getElementById('loginUsername');
      const loginPassword = document.getElementById('loginPassword');
      const loginError = document.getElementById('loginError');
      const currentUserLabel = document.getElementById('currentUserLabel');
      const logoutBtn = document.getElementById('logoutBtn');
      const languageSelect = document.getElementById('languageSelect');
      const projectHome = document.getElementById('projectHome');
      const appWorkspace = document.getElementById('appWorkspace');
      const projectList = document.getElementById('projectList');
      const projectSummary = document.getElementById('projectSummary');
      const projectSearchInput = document.getElementById('projectSearchInput');
      const projectTagFilterSelect = document.getElementById('projectTagFilterSelect');
      const projectGroupSelect = document.getElementById('projectGroupSelect');
      const projectSortSelect = document.getElementById('projectSortSelect');
      const newProjectBtn = document.getElementById('newProjectBtn');
      const newProjectJsonBtn = document.getElementById('newProjectJsonBtn');
      const newProjectCsvBtn = document.getElementById('newProjectCsvBtn');
      const newProjectXmlBtn = document.getElementById('newProjectXmlBtn');
      const backToProjectsBtn = document.getElementById('backToProjectsBtn');
      const currentProjectName = document.getElementById('currentProjectName');
      const saveStatus = document.getElementById('saveStatus');
      const fileInput = document.getElementById('fileInput');
      const uploadBtn = document.getElementById('uploadBtn');
      const imageWrapper = document.getElementById('imageWrapper');
      const annotationCanvas = document.getElementById('annotationCanvas');
      const annotateImage = document.getElementById('annotateImage');
      const markerRenderModeSelect = document.getElementById('markerRenderModeSelect');
      const zoomInBtn = document.getElementById('zoomInBtn');
      const zoomOutBtn = document.getElementById('zoomOutBtn');
      const zoomResetBtn = document.getElementById('zoomResetBtn');
      const zoomReadout = document.getElementById('zoomReadout');
      const placeholder = document.getElementById('placeholder');
      const tagListContainer = document.getElementById('tagListContainer');
      const sidePanelSelect = document.getElementById('sidePanelSelect');
      const tagsPanelView = document.getElementById('tagsPanelView');
      const materialsPanelView = document.getElementById('materialsPanelView');
      const locationGroupPanel = document.getElementById('locationGroupPanel');
      const tagSearchInput = document.getElementById('tagSearchInput');
      const tagSearchClearBtn = document.getElementById('tagSearchClearBtn');
      const canvasBranchFilterBtn = document.getElementById('canvasBranchFilterBtn');
      const canvasBranchFilterLabel = document.getElementById('canvasBranchFilterLabel');
      const canvasBranchFilterMenu = document.getElementById('canvasBranchFilterMenu');
      const tagTreeModeBtn = document.getElementById('tagTreeModeBtn');
      const tagTypeModeBtn = document.getElementById('tagTypeModeBtn');
      const tagGroupModeBtn = document.getElementById('tagGroupModeBtn');
      const collapseAllTagsBtn = document.getElementById('collapseAllTagsBtn');
      const exportBtn = document.getElementById('exportBtn');
      const importTypeSelect = document.getElementById('importTypeSelect');
      const importBtn = document.getElementById('importBtn');
      const importFileInput = document.getElementById('importFileInput');
      const xmlImportFileInput = document.getElementById('xmlImportFileInput');
      const clearAllBtn = document.getElementById('clearAllBtn');
      const showTextCheckbox = document.getElementById('showTextCheckbox');
      const materialListContainer = document.getElementById('materialListContainer');
      const addMaterialBtn = document.getElementById('addMaterialBtn');

      const panelRight = document.getElementById('panelRight');
      const toggleRightBtn = document.getElementById('toggleRightBtn');
      const panelCenter = document.querySelector('.panel-center');

      // 右键菜单元素
      const contextMenu = document.getElementById('contextMenu');
      const createTagMenuItem = document.getElementById('createTagMenuItem');
      const toggleTextMenuItem = document.getElementById('toggleTextMenuItem');
      const editTextMenuItem = document.getElementById('editTextMenuItem');
      const editEventMenuItem = document.getElementById('editEventMenuItem');
      const showEventsMenuItem = document.getElementById('showEventsMenuItem');
      const addChildMenuItem = document.getElementById('addChildMenuItem');
      const deleteTagMenuItem = document.getElementById('deleteTagMenuItem');
      
      // 文本编辑对话框元素
      const textEditDialog = document.getElementById('textEditDialog');
      const textEditInput = document.getElementById('textEditInput');
      const locationEditCategoryField = document.getElementById('locationEditCategoryField');
      const locationEditCategorySelect = document.getElementById('locationEditCategorySelect');
      const textEditConfirm = document.getElementById('textEditConfirm');
      const textEditCancel = document.getElementById('textEditCancel');
      const eventEditDialog = document.getElementById('eventEditDialog');
      const eventNameInput = document.getElementById('eventNameInput');
      const eventSwitchInput = document.getElementById('eventSwitchInput');
      const eventSwitchFunctionInput = document.getElementById('eventSwitchFunctionInput');
      const addEventStepBtn = document.getElementById('addEventStepBtn');
      const eventStepsBody = document.getElementById('eventStepsBody');
      const eventPathPreview = document.getElementById('eventPathPreview');
      const eventEditConfirm = document.getElementById('eventEditConfirm');
      const eventEditCancel = document.getElementById('eventEditCancel');
      const locationCategoryDialog = document.getElementById('locationCategoryDialog');
      const locationCategoryCancel = document.getElementById('locationCategoryCancel');
      
      let contextMenuTagId = null;
      let contextMenuPosition = null; // 存储右键点击的位置
      let sidePanelView = 'tags';
      let tagListMode = 'tree';
      let tagSearchQuery = '';
      let locationGroups = [];
      let locationGroupRenderEnabled = true;
      let markerRenderMode = 'image';
      let canvasHiddenBranchIds = [];
      let collapsedTagIds = new Set();
      let collapsedTypeGroupIds = new Set();
      let currentProjectId = null;
      let currentProjectTitle = '';
      let saveTimer = null;
      let isSavingProject = false;
      let hasUnsavedProjectChanges = false;
      let suppressAutosave = false;
      let projectChangeVersion = 0;
      let currentUser = null;
      let allProjects = [];
      let projectSearchQuery = '';
      let projectTagFilter = '';
      let projectGroupMode = 'list';
      let projectSortMode = 'updated';
      let pendingJsonImportMode = 'update-current';
      let pendingXmlImportMode = 'update-current';
      let pendingXmlUpdateProjectId = null;
      let currentSaveStatusKey = 'projects.choose';
      let displayedEventParentIds = new Set();
      let hoveredTagId = null;
      let isDraggingTag = false;
      let pendingLocationCategoryResolve = null;
      let lastContextMenuOpenedAt = 0;
      const renderHooks = [];

      function applyStaticI18n() {
        document.documentElement.lang = currentLanguage;
        document.title = APP_TITLE;
        document.querySelectorAll('[data-i18n]').forEach(el => {
          el.textContent = t(el.dataset.i18n);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
          el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
          el.setAttribute('title', t(el.dataset.i18nTitle));
        });
        document.querySelectorAll('[data-i18n-alt]').forEach(el => {
          el.setAttribute('alt', t(el.dataset.i18nAlt));
        });
        if (languageSelect) languageSelect.value = currentLanguage;
        if (markerRenderModeSelect) markerRenderModeSelect.value = markerRenderMode;
        setSaveStatus(saveStatus.className.replace('save-status ', '') || 'idle', t(currentSaveStatusKey));
      }

      function setProjectNameToFallback() {
        currentProjectName.textContent = t('projects.unopened');
      }

      function refreshLanguage() {
        applyStaticI18n();
        if (!currentProjectId) setProjectNameToFallback();
        updateAuthUi();
        updateCanvasBranchFilterOptions();
        renderProjectList(allProjects);
        renderTagList();
        renderMaterialList();
        runRenderHooks();
      }

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
          let message = t('api.requestFailed');
          try {
            const body = await response.json();
            if (body.error) message = body.error;
          } catch (error) {
            message = response.statusText || message;
          }
          if (response.status === 401) {
            showLoginView();
          }
          if (response.status === 403) {
            alert(message);
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

      function setSaveStatusKey(state, key) {
        currentSaveStatusKey = key;
        setSaveStatus(state, t(key));
      }

      function registerRenderHook(callback) {
        if (typeof callback === 'function' && !renderHooks.includes(callback)) {
          renderHooks.push(callback);
        }
      }

      function runRenderHooks(reason = 'all') {
        renderHooks.forEach(callback => callback(reason));
      }

      function updateWorkspaceLayoutMode() {
        if (!panelCenter) return;
        const isWorkspaceVisible = !appWorkspace.classList.contains('is-hidden');
        const panelVisible = isWorkspaceVisible && !panelRight.classList.contains('is-hidden') && !panelRight.classList.contains('hidden');
        panelCenter.classList.toggle('with-side-panel', panelVisible);
        panelCenter.classList.toggle('without-side-panel', !panelVisible);
      }

      function setWorkspaceVisible(isVisible) {
        loginHome.classList.add('is-hidden');
        projectHome.classList.toggle('is-hidden', isVisible);
        appWorkspace.classList.toggle('is-hidden', !isVisible);
        panelRight.classList.toggle('is-hidden', !isVisible);
        document.body.classList.remove('login-view', 'project-home-view', 'workspace-view');
        document.body.classList.add(isVisible ? 'workspace-view' : 'project-home-view');
        if (toolbar) toolbar.classList.remove('is-hidden');
        updateWorkspaceLayoutMode();
      }

      function isAdmin() {
        return currentUser && currentUser.role === 'admin';
      }

      function updateAuthUi() {
        currentUserLabel.textContent = currentUser
          ? `${currentUser.username} · ${currentUser.role === 'admin' ? t('auth.admin') : t('auth.user')}`
          : t('auth.notLoggedIn');
        logoutBtn.classList.toggle('is-hidden', !currentUser);
        newProjectBtn.classList.toggle('is-hidden', !isAdmin());
        newProjectJsonBtn.classList.toggle('is-hidden', !isAdmin());
        newProjectCsvBtn.classList.toggle('is-hidden', !isAdmin());
        newProjectXmlBtn.classList.toggle('is-hidden', !isAdmin());
        exportBtn.classList.toggle('is-hidden', !isAdmin());
        document.body.classList.toggle('is-admin', !!isAdmin());
        updateImportUi();
      }

      function updateImportUi() {
        if (!importTypeSelect || !importBtn) return;
        const requiresAdmin = importTypeSelect.value !== 'csv';
        importBtn.disabled = requiresAdmin && !isAdmin();
        importBtn.title = importBtn.disabled ? t('import.adminOnly') : '';
      }

      function showLoginView() {
        currentUser = null;
        currentProjectId = null;
        currentProjectTitle = '';
        setProjectNameToFallback();
        setSaveStatusKey('idle', 'auth.loginRequired');
        resetProjectData();
        loginHome.classList.remove('is-hidden');
        projectHome.classList.add('is-hidden');
        appWorkspace.classList.add('is-hidden');
        panelRight.classList.add('is-hidden');
        document.body.classList.remove('project-home-view', 'workspace-view');
        document.body.classList.add('login-view');
        if (toolbar) toolbar.classList.add('is-hidden');
        updateAuthUi();
      }

      function showProjectHome() {
        loginHome.classList.add('is-hidden');
        projectHome.classList.remove('is-hidden');
        appWorkspace.classList.add('is-hidden');
        panelRight.classList.add('is-hidden');
        document.body.classList.remove('login-view', 'workspace-view');
        document.body.classList.add('project-home-view');
        if (toolbar) toolbar.classList.remove('is-hidden');
        updateAuthUi();
      }

      function cleanTagForPersistence(tag) {
        const hasCoordinates = hasAssignedCoordinates(tag);
        const newTag = {
          id: tag.id,
          typeIndex: tag.typeIndex,
          text: tag.text,
          x: hasCoordinates ? +Number(tag.x).toFixed(4) : null,
          y: hasCoordinates ? +Number(tag.y).toFixed(4) : null
        };
        if (tag.locationCategory) newTag.locationCategory = tag.locationCategory;
        if (tag.eventRecordId) newTag.eventRecordId = tag.eventRecordId;
        if (tag.materialLinks && tag.materialLinks.length > 0) {
          newTag.materialLinks = tag.materialLinks;
        }
        newTag.children = tag.children && tag.children.length > 0
          ? tag.children.map(cleanTagForPersistence)
          : [];
        return newTag;
      }

      function hasAssignedCoordinates(tag) {
        return tag
          && tag.x !== null
          && tag.x !== undefined
          && tag.x !== ''
          && tag.y !== null
          && tag.y !== undefined
          && tag.y !== ''
          && Number.isFinite(Number(tag.x))
          && Number.isFinite(Number(tag.y));
      }

      function cleanLocationGroupForPersistence(group) {
        const anchor = group && group.anchor ? group.anchor : {};
        const panel = group && group.panel ? group.panel : {};
        return {
          id: group && group.id ? String(group.id) : createLocationGroupId(),
          name: group && group.name ? String(group.name) : 'Location Group',
          stationId: group && group.stationId !== undefined && group.stationId !== null ? Number(group.stationId) : null,
          locationIds: Array.isArray(group && group.locationIds)
            ? group.locationIds.map(id => Number(id)).filter(id => Number.isFinite(id))
            : [],
          anchor: {
            x: Number.isFinite(Number(anchor.x)) ? +Number(anchor.x).toFixed(4) : 0.5,
            y: Number.isFinite(Number(anchor.y)) ? +Number(anchor.y).toFixed(4) : 0.5
          },
          panel: {
            x: Number.isFinite(Number(panel.x)) ? +Number(panel.x).toFixed(4) : 0.58,
            y: Number.isFinite(Number(panel.y)) ? +Number(panel.y).toFixed(4) : 0.5,
            width: Number.isFinite(Number(panel.width)) ? +Number(panel.width).toFixed(4) : 0.24,
            height: Number.isFinite(Number(panel.height)) ? +Number(panel.height).toFixed(4) : 0.22
          },
          iconSize: Number.isFinite(Number(group && group.iconSize)) ? Number(group.iconSize) : 48,
          collapsed: group && group.collapsed !== undefined ? !!group.collapsed : true
        };
      }

      function serializeProjectData() {
        const cleanMaterials = materials.map(m => {
          const material = {
            name: m.name,
            abbreviation: m.abbreviation,
            category: m.category,
            type: m.type
          };
          if (Array.isArray(m.processLinks) && m.processLinks.length > 0) {
            material.processLinks = m.processLinks;
          }
          return material;
        });
        return {
          image: annotateImage.src || '',
          tagTypes: tagTypes.map(type => ({ ...type })),
          tags: tags.map(cleanTagForPersistence),
          eventRecords: eventRecords.map(cleanEventRecordForPersistence),
          materials: cleanMaterials,
          locationGroups: locationGroups.map(cleanLocationGroupForPersistence)
        };
      }

      function resetProjectData() {
        tagTypes.length = 0;
        tagTypes.push(...baseTagTypes.map(type => ({ ...type })));
        materials.length = 0;
        materials.push({
          name: t('materials.defaultName'),
          abbreviation: 'MA',
          category: t('materials.defaultCategory'),
          type: t('materials.defaultType')
        });
        tags = [];
        locationGroups = [];
        eventRecords = [];
        displayedEventParentIds.clear();
        hoveredTagId = null;
        canvasHiddenBranchIds = [];
        collapsedTagIds.clear();
        collapsedTypeGroupIds.clear();
        tagSearchQuery = '';
        tagSearchInput.value = '';
        annotateImage.removeAttribute('src');
        annotateImage.src = '';
        imageWrapper.style.display = 'none';
        placeholder.style.display = '';
      }

      function getPreferredTypeIcon(type, index) {
        const name = type && type.name ? type.name : '';
        if (name.includes('Station')) return './static/icons/station.svg';
        if (name.includes('Location')) return './static/icons/location.svg';
        if (name.includes('Process')) return '';
        if (name.includes('Event')) return './static/icons/event.svg';
        return type.icon || baseTagTypes[index]?.icon || '';
      }

      function ensureEventType() {
        if (getTypeIndexByName('Event') !== -1) return;
        tagTypes.push({ name: 'Event', color: '#b7791f', icon: './static/icons/event.svg' });
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

      function cleanEventRecordForPersistence(record) {
        return {
          id: record && record.id ? String(record.id) : createEventRecordId(),
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

      function createEventRecordId() {
        return `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }

      function createLocationGroupId() {
        return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }

      function getGroupedLocationIdSet() {
        const groupedIds = new Set();
        locationGroups.forEach(group => {
          if (!Array.isArray(group.locationIds)) return;
          group.locationIds.forEach(id => groupedIds.add(Number(id)));
        });
        return groupedIds;
      }

      function isLocationGrouped(tagId) {
        return getGroupedLocationIdSet().has(Number(tagId));
      }

      function setLocationGroupRenderEnabled(isEnabled) {
        locationGroupRenderEnabled = !!isEnabled;
        renderMarkers();
        runRenderHooks('overlay');
      }

      function getEventRecordById(recordId) {
        return eventRecords.find(record => record.id === recordId) || null;
      }

      function isEventTag(tag) {
        const type = tagTypes[tag.typeIndex];
        return !!(type && type.name.includes('Event'));
      }

      function isLocationTag(tag) {
        const type = tagTypes[tag.typeIndex];
        return !!(type && type.name.includes('Location'));
      }

      function getDirectEventChildren(tag) {
        if (!tag || !Array.isArray(tag.children)) return [];
        return tag.children.filter(child => isEventTag(child));
      }

      function normalizeImportedTags(tagList) {
        tagList.forEach(tag => {
          if (!Array.isArray(tag.children)) tag.children = [];
          tag.x = hasAssignedCoordinates(tag) ? Number(tag.x) : null;
          tag.y = hasAssignedCoordinates(tag) ? Number(tag.y) : null;
          const type = tagTypes[tag.typeIndex];
          if (type && type.name.includes('Location') && !tag.locationCategory) {
            tag.locationCategory = 'process';
          }
          normalizeImportedTags(tag.children);
        });
      }

      function getEventRecordForTag(tag) {
        if (!tag) return null;
        let record = tag.eventRecordId ? getEventRecordById(tag.eventRecordId) : null;
        if (!record) {
          record = createEventRecordFromTag(tag);
          tag.eventRecordId = record.id;
          eventRecords.push(record);
        }
        return record;
      }

      function ensureEventRecordsForTags() {
        getAllTagsFlattened(tags).forEach(flatTag => {
          const tag = findTagById(flatTag._id);
          if (tag && isEventTag(tag)) getEventRecordForTag(tag);
        });
      }

      function createEventRecordFromTag(tag) {
        const path = getTagBusinessPath(tag);
        return cleanEventRecordForPersistence({
          id: createEventRecordId(),
          lineName: path.lineName,
          station: path.station,
          location: path.location,
          locationCategory: path.locationCategory,
          process: path.process,
          event: tag.text || '',
          eventSwitch: '',
          eventSwitchFunction: '',
          processSteps: []
        });
      }

      function syncEventRecordPath(tag) {
        if (!tag || !isEventTag(tag)) return;
        const record = getEventRecordForTag(tag);
        const path = getTagBusinessPath(tag);
        record.lineName = path.lineName;
        record.station = path.station;
        record.location = path.location;
        record.locationCategory = path.locationCategory;
        record.process = path.process;
        if (!record.event && tag.text) record.event = tag.text;
      }

      function getTagTypeIcon(tag, type) {
        if (type && type.name.includes('Location')) {
          return tag.locationCategory === 'equipment'
            ? './static/icons/location-equipment.svg'
            : './static/icons/location-process.svg';
        }
        return type && type.icon ? type.icon : '';
      }

      function normalizeProjectData(data) {
        const normalized = data && typeof data === 'object' ? data : {};
        return {
          ...normalized,
          image: normalized.image || '',
          tagTypes: Array.isArray(normalized.tagTypes) ? normalized.tagTypes : baseTagTypes.map(type => ({ ...type })),
          tags: Array.isArray(normalized.tags) ? normalized.tags : [],
          eventRecords: Array.isArray(normalized.eventRecords) ? normalized.eventRecords : [],
          materials: Array.isArray(normalized.materials) ? normalized.materials : [],
          locationGroups: Array.isArray(normalized.locationGroups) ? normalized.locationGroups : []
        };
      }

      function applyProjectData(data) {
        data = normalizeProjectData(data);
        const importedTypes = Array.isArray(data.tagTypes) ? data.tagTypes : baseTagTypes;
        tagTypes.length = 0;
        tagTypes.push(...importedTypes.map((type, index) => ({
          ...type,
          icon: getPreferredTypeIcon(type, index)
        })));
        if (tagTypes.length === 0) {
          tagTypes.push(...baseTagTypes.map(type => ({ ...type })));
        }
        ensureEventType();

        tags = Array.isArray(data.tags) ? data.tags : [];
        normalizeImportedTags(tags);
        locationGroups = data.locationGroups.map(cleanLocationGroupForPersistence);
        eventRecords = Array.isArray(data.eventRecords)
          ? data.eventRecords.map(cleanEventRecordForPersistence)
          : [];
        ensureEventRecordsForTags();
        materials.length = 0;
        if (Array.isArray(data.materials)) {
          materials.push(...data.materials);
        }
        canvasHiddenBranchIds = [];
        collapsedTagIds.clear();
        collapsedTypeGroupIds.clear();
        displayedEventParentIds.clear();
        hoveredTagId = null;
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
        allProjects = Array.isArray(projects) ? projects : [];
        updateProjectTagFilterOptions();
        const visibleProjects = sortProjects(getVisibleProjects());
        updateProjectSummary(visibleProjects.length);
        if (visibleProjects.length === 0) {
          const emptyKey = allProjects.length > 0 ? 'projects.noMatch' : (isAdmin() ? 'projects.noneAdmin' : 'projects.noneUser');
          projectList.innerHTML = `<div class="project-empty">${escapeHtml(t(emptyKey))}</div>`;
          return;
        }
        if (projectGroupMode === 'tag') {
          renderProjectGroups(visibleProjects);
          return;
        }
        visibleProjects.forEach(project => {
          projectList.appendChild(createProjectCard(project));
        });
      }

      function sortProjects(projects) {
        const sorted = [...projects];
        if (projectSortMode === 'name') {
          sorted.sort((a, b) => {
            const nameCompare = String(a.name || '').localeCompare(String(b.name || ''), currentLanguage, {
              sensitivity: 'base',
              numeric: true
            });
            if (nameCompare !== 0) return nameCompare;
            return getProjectUpdatedTime(b) - getProjectUpdatedTime(a);
          });
          return sorted;
        }
        sorted.sort((a, b) => {
          const timeCompare = getProjectUpdatedTime(b) - getProjectUpdatedTime(a);
          if (timeCompare !== 0) return timeCompare;
          return String(a.name || '').localeCompare(String(b.name || ''), currentLanguage, {
            sensitivity: 'base',
            numeric: true
          });
        });
        return sorted;
      }

      function getProjectUpdatedTime(project) {
        const value = project && (project.updatedAt || project.createdAt);
        const time = Date.parse(value || '');
        return Number.isFinite(time) ? time : 0;
      }

      function updateProjectSummary(visibleCount) {
        if (!projectSummary) return;
        projectSummary.textContent = t('projects.summary', {
          total: allProjects.length,
          visible: visibleCount
        });
      }

      function renderProjectGroups(projects) {
        const groups = new Map();
        projects.forEach(project => {
          const tags = Array.isArray(project.tags) && project.tags.length > 0
            ? project.tags
            : [t('projects.uncategorized')];
          tags.forEach(tag => {
            if (!groups.has(tag)) groups.set(tag, []);
            groups.get(tag).push(project);
          });
        });
        Array.from(groups.keys()).sort((a, b) => a.localeCompare(b)).forEach(tag => {
          const group = document.createElement('section');
          group.className = 'project-group';
          group.innerHTML = `<h3 class="project-group-title">${escapeHtml(tag)}</h3>`;
          groups.get(tag).forEach(project => group.appendChild(createProjectCard(project)));
          projectList.appendChild(group);
        });
      }

      function createProjectCard(project) {
          const card = document.createElement('div');
          card.className = 'project-card';
          const tags = Array.isArray(project.tags) ? project.tags : [];
          const tagHtml = tags.length > 0
            ? tags.map(tag => `<span class="project-tag-chip">${escapeHtml(tag)}</span>`).join('')
            : `<span class="project-tag-empty">${escapeHtml(t('projects.uncategorized'))}</span>`;
          card.innerHTML = `
            <div class="project-card-main">
              <div class="project-card-title" title="${escapeHtml(project.name)}">${escapeHtml(project.name)}</div>
              <div class="project-card-meta">${escapeHtml(t('projects.updatedAt', { time: formatDateTime(project.updatedAt) }))}</div>
              <div class="project-card-tags">${tagHtml}</div>
            </div>
            <div class="project-card-actions">
              <button class="btn btn-primary open-project-btn" type="button" data-id="${project.id}">${escapeHtml(t('projects.open'))}</button>
              ${isAdmin() ? `
                <details class="project-edit-menu">
                  <summary class="btn">${escapeHtml(t('projects.editMenu'))}</summary>
                  <div class="project-edit-menu-list">
                    <button class="project-menu-item edit-project-name-btn" type="button" data-id="${project.id}">${escapeHtml(t('projects.editName'))}</button>
                    <button class="project-menu-item edit-project-tags-btn" type="button" data-id="${project.id}">${escapeHtml(t('projects.editTags'))}</button>
                    <button class="project-menu-item copy-project-btn" type="button" data-id="${project.id}">${escapeHtml(t('projects.copy'))}</button>
                    <button class="project-menu-item xml-update-project-btn" type="button" data-id="${project.id}">${escapeHtml(t('projects.xmlUpdate'))}</button>
                    <button class="project-menu-item project-menu-danger delete-project-btn" type="button" data-id="${project.id}">${escapeHtml(t('projects.delete'))}</button>
                  </div>
                </details>
              ` : ''}
            </div>
          `;
          return card;
      }

      function getVisibleProjects() {
        const query = projectSearchQuery.trim().toLowerCase();
        return allProjects.filter(project => {
          const tags = Array.isArray(project.tags) ? project.tags : [];
          if (projectTagFilter && !tags.includes(projectTagFilter)) return false;
          if (!query) return true;
          return String(project.name || '').toLowerCase().includes(query)
            || tags.some(tag => String(tag).toLowerCase().includes(query));
        });
      }

      function updateProjectTagFilterOptions() {
        if (!projectTagFilterSelect) return;
        const tags = Array.from(new Set(
          allProjects.flatMap(project => Array.isArray(project.tags) ? project.tags : [])
        )).sort((a, b) => a.localeCompare(b));
        const currentValue = projectTagFilter;
        projectTagFilterSelect.innerHTML = `<option value="">${escapeHtml(t('projects.allTags'))}</option>`;
        tags.forEach(tag => {
          const option = document.createElement('option');
          option.value = tag;
          option.textContent = tag;
          projectTagFilterSelect.appendChild(option);
        });
        projectTagFilter = tags.includes(currentValue) ? currentValue : '';
        projectTagFilterSelect.value = projectTagFilter;
      }

      function formatDateTime(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString();
      }

      async function loadProjectList() {
        projectList.innerHTML = `<div class="project-empty">${escapeHtml(t('projects.loading'))}</div>`;
        try {
          const body = await apiRequest('/api/projects');
          renderProjectList(body.projects || []);
        } catch (error) {
          projectList.innerHTML = `<div class="project-empty">${escapeHtml(t('projects.loadFailed', { message: error.message }))}</div>`;
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
          setSaveStatusKey('saved', 'save.saved');
          setWorkspaceVisible(true);
          suppressAutosave = false;
        } catch (error) {
          suppressAutosave = false;
          alert(t('projects.openFailed', { message: error.message }));
        }
      }

      async function createProject(name) {
        if (!isAdmin()) {
          alert(t('projects.adminCreateOnly'));
          return;
        }
        const body = await apiRequest('/api/projects', {
          method: 'POST',
          body: JSON.stringify({ name })
        });
        await loadProjectList();
        await openProject(body.project.id);
      }

      async function deleteProject(projectId) {
        if (!isAdmin()) {
          alert(t('projects.adminDeleteOnly'));
          return;
        }
        await apiRequest(`/api/projects/${projectId}`, { method: 'DELETE' });
        if (currentProjectId === projectId) {
          currentProjectId = null;
          currentProjectTitle = '';
          hasUnsavedProjectChanges = false;
          projectChangeVersion = 0;
          setProjectNameToFallback();
          resetProjectData();
          setSaveStatusKey('idle', 'projects.choose');
          setWorkspaceVisible(false);
        }
        await loadProjectList();
      }

      async function updateProjectTags(projectId, tags) {
        await apiRequest(`/api/projects/${projectId}/tags`, {
          method: 'PATCH',
          body: JSON.stringify({ tags })
        });
        await loadProjectList();
      }

      async function renameProject(projectId, name) {
        const id = Number(projectId);
        const trimmedName = String(name || '').trim();
        if (!trimmedName) return;
        const data = currentProjectId === id
          ? serializeProjectData()
          : normalizeProjectData((await apiRequest(`/api/projects/${id}`)).project.data);
        const body = await apiRequest(`/api/projects/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: trimmedName,
            data
          })
        });
        if (currentProjectId === id) {
          currentProjectTitle = body.project.name;
          currentProjectName.textContent = currentProjectTitle;
          hasUnsavedProjectChanges = false;
          setSaveStatusKey('saved', 'save.saved');
        }
        await loadProjectList();
      }

      async function copyProject(projectId, name, sourceTags = []) {
        const id = Number(projectId);
        const trimmedName = String(name || '').trim();
        if (!trimmedName) return;
        const source = (await apiRequest(`/api/projects/${id}`)).project;
        const body = await apiRequest('/api/projects/import', {
          method: 'POST',
          body: JSON.stringify({
            name: trimmedName,
            data: normalizeProjectData(source.data)
          })
        });
        if (Array.isArray(sourceTags) && sourceTags.length > 0) {
          await updateProjectTags(body.project.id, sourceTags);
        } else {
          await loadProjectList();
        }
        await openProject(body.project.id);
      }

      function closeProjectEditMenus(exceptMenu = null) {
        document.querySelectorAll('.project-edit-menu[open]').forEach(menu => {
          if (menu !== exceptMenu) menu.removeAttribute('open');
        });
      }

      function markProjectDirty() {
        if (suppressAutosave || !currentProjectId) return;
        hasUnsavedProjectChanges = true;
        projectChangeVersion += 1;
        setSaveStatusKey('dirty', 'save.dirty');
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
        setSaveStatusKey('saving', 'save.saving');
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
            setSaveStatusKey('saved', 'save.saved');
          } else {
            setSaveStatusKey('dirty', 'save.dirty');
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(saveCurrentProject, 500);
          }
          loadProjectList();
        } catch (error) {
          setSaveStatusKey('error', 'save.failed');
        } finally {
          isSavingProject = false;
        }
      }

      async function importProjectFromJson(data, name) {
        if (!isAdmin()) {
          alert(t('import.adminOnly'));
          return;
        }
        const body = await apiRequest('/api/projects/import', {
          method: 'POST',
          body: JSON.stringify({ name, data })
        });
        await loadProjectList();
        await openProject(body.project.id);
      }

      async function replaceCurrentProjectFromJson(data) {
        if (!currentProjectId) {
          alert(t('projects.choose'));
          return;
        }
        if (!isAdmin()) {
          alert(t('import.adminOnly'));
          return;
        }
        applyProjectData(normalizeProjectData(data));
        markProjectDirty();
        await saveCurrentProject();
      }

      async function createProjectFromCsvText(text, name) {
        if (!isAdmin()) {
          alert(t('import.adminOnly'));
          return null;
        }
        await createProject(name);
        if (!window.MESCsvImport || typeof window.MESCsvImport.importCsvText !== 'function') return null;
        const result = window.MESCsvImport.importCsvText(text);
        await saveCurrentProject();
        return result;
      }

      async function uploadXmlImport(file, name) {
        if (!isAdmin()) {
          alert(t('import.adminOnly'));
          return;
        }
        setSaveStatusKey('saving', 'xml.uploading');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
        const response = await fetch('/api/imports/xml', {
          method: 'POST',
          body: formData
        });
        if (!response.ok) {
          let message = t('api.requestFailed');
          try {
            const body = await response.json();
            if (body.error) message = body.error;
          } catch (error) {
            message = response.statusText || message;
          }
          throw new Error(message);
        }
        const body = await response.json();
        setSaveStatusKey('saving', 'xml.submitted');
        return pollXmlImportJob(body.jobId);
      }

      async function uploadXmlUpdate(file, projectId) {
        if (!isAdmin()) {
          alert(t('import.adminOnly'));
          return;
        }
        setSaveStatusKey('saving', 'xml.uploading');
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`/api/projects/${projectId}/import-xml`, {
          method: 'POST',
          body: formData
        });
        if (!response.ok) {
          let message = t('api.requestFailed');
          try {
            const body = await response.json();
            if (body.error) message = body.error;
          } catch (error) {
            message = response.statusText || message;
          }
          throw new Error(message);
        }
        const body = await response.json();
        setSaveStatusKey('saving', 'xml.submitted');
        return pollXmlImportJob(body.jobId);
      }

      async function pollXmlImportJob(jobId) {
        const maxAttempts = 1800;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          await delay(1500);
          const body = await apiRequest(`/api/imports/${jobId}`);
          const job = body.job || {};
          if (job.status === 'completed') {
            setSaveStatusKey('saved', 'projects.choose');
            await loadProjectList();
            if (job.projectId) await openProject(job.projectId);
            return job;
          }
          if (job.status === 'failed') {
            throw new Error(job.error || t('xml.failed', { message: '' }));
          }
          if (job.message) setSaveStatus('saving', job.message);
        }
        throw new Error('XML 导入任务查询超时');
      }

      function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }

      async function checkCurrentSession() {
        try {
          const body = await apiRequest('/api/me');
          currentUser = body.user || null;
          if (!currentUser) {
            showLoginView();
            return;
          }
          setSaveStatusKey('idle', 'projects.choose');
          showProjectHome();
          await loadProjectList();
        } catch (error) {
          showLoginView();
        }
      }

      // ---------- Top-level event bindings ----------
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        try {
          const body = await apiRequest('/api/login', {
            method: 'POST',
            body: JSON.stringify({
              username: loginUsername.value.trim(),
              password: loginPassword.value
            })
          });
          currentUser = body.user;
          loginPassword.value = '';
          setSaveStatusKey('idle', 'projects.choose');
          showProjectHome();
          await loadProjectList();
        } catch (error) {
          loginError.textContent = error.message;
        }
      });

      logoutBtn.addEventListener('click', async () => {
        try {
          await apiRequest('/api/logout', { method: 'POST' });
        } catch (error) {
          // Local state should still be cleared even if the server session was gone.
        }
        showLoginView();
      });

      languageSelect.addEventListener('change', (e) => {
        currentLanguage = I18N[e.target.value] ? e.target.value : 'zh-CN';
        localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
        refreshLanguage();
      });

      newProjectBtn.addEventListener('click', async () => {
        if (!isAdmin()) return;
        const name = prompt(t('projects.promptName'));
        if (!name || !name.trim()) return;
        try {
          await createProject(name.trim());
        } catch (error) {
          alert(t('projects.createFailed', { message: error.message }));
        }
      });

      newProjectJsonBtn.addEventListener('click', () => {
        if (!isAdmin()) return;
        pendingJsonImportMode = 'create';
        importFileInput.click();
      });

      newProjectCsvBtn.addEventListener('click', () => {
        if (!isAdmin()) return;
        if (!window.MESCsvImport || typeof window.MESCsvImport.openFilePicker !== 'function') return;
        window.MESCsvImport.openFilePicker({
          onText: async (text, file) => {
            const defaultName = file.name.replace(/\.csv$/i, '') || t('import.defaultProject');
            const name = prompt(t('projects.promptImportName'), defaultName);
            if (!name || !name.trim()) return;
            try {
              const result = await createProjectFromCsvText(text, name.trim());
              if (result) alert(t('csv.importSuccess', result));
            } catch (error) {
              alert(t('csv.importFailed', { message: error.message }));
            }
          }
        });
      });

      newProjectXmlBtn.addEventListener('click', () => {
        if (!isAdmin()) return;
        pendingXmlImportMode = 'create';
        pendingXmlUpdateProjectId = null;
        xmlImportFileInput.click();
      });

      backToProjectsBtn.addEventListener('click', () => {
        setWorkspaceVisible(false);
        loadProjectList();
      });

      saveStatus.addEventListener('click', () => {
        if (hasUnsavedProjectChanges) saveCurrentProject();
      });

      projectList.addEventListener('click', async (e) => {
        const menu = e.target.closest('.project-edit-menu');
        const menuSummary = e.target.closest('.project-edit-menu summary');
        if (menuSummary) {
          closeProjectEditMenus(menu);
          return;
        }
        const openBtn = e.target.closest('.open-project-btn');
        const editNameBtn = e.target.closest('.edit-project-name-btn');
        const editTagsBtn = e.target.closest('.edit-project-tags-btn');
        const copyBtn = e.target.closest('.copy-project-btn');
        const xmlUpdateBtn = e.target.closest('.xml-update-project-btn');
        const deleteBtn = e.target.closest('.delete-project-btn');
        if (editNameBtn || editTagsBtn || copyBtn || xmlUpdateBtn || deleteBtn) {
          closeProjectEditMenus();
        }
        if (openBtn) {
          await openProject(parseInt(openBtn.dataset.id));
          return;
        }
        if (editNameBtn) {
          if (!isAdmin()) return;
          const id = parseInt(editNameBtn.dataset.id);
          const project = allProjects.find(item => Number(item.id) === id);
          const value = prompt(t('projects.promptName'), project ? project.name : '');
          if (value === null || !value.trim()) return;
          try {
            await renameProject(id, value);
          } catch (error) {
            alert(t('projects.renameFailed', { message: error.message }));
          }
          return;
        }
        if (copyBtn) {
          if (!isAdmin()) return;
          const id = parseInt(copyBtn.dataset.id);
          const project = allProjects.find(item => Number(item.id) === id);
          const sourceName = project && project.name ? project.name : t('projects.untitled');
          const value = prompt(t('projects.promptCopyName'), t('projects.copyName', { name: sourceName }));
          if (value === null || !value.trim()) return;
          try {
            await copyProject(id, value, project && Array.isArray(project.tags) ? project.tags : []);
          } catch (error) {
            alert(t('projects.copyFailed', { message: error.message }));
          }
          return;
        }
        if (editTagsBtn) {
          if (!isAdmin()) return;
          const id = parseInt(editTagsBtn.dataset.id);
          const project = allProjects.find(item => Number(item.id) === id);
          const currentTags = project && Array.isArray(project.tags) ? project.tags.join(', ') : '';
          const value = prompt(t('projects.promptTags'), currentTags);
          if (value === null) return;
          try {
            await updateProjectTags(id, value.split(',').map(tag => tag.trim()));
          } catch (error) {
            alert(t('projects.tagsUpdateFailed', { message: error.message }));
          }
          return;
        }
        if (xmlUpdateBtn) {
          if (!isAdmin()) return;
          pendingXmlImportMode = 'update-current';
          pendingXmlUpdateProjectId = parseInt(xmlUpdateBtn.dataset.id);
          xmlImportFileInput.click();
          return;
        }
        if (deleteBtn) {
          if (!isAdmin()) return;
          const id = parseInt(deleteBtn.dataset.id);
          const card = deleteBtn.closest('.project-card');
          const title = card ? card.querySelector('.project-card-title')?.textContent : t('projects.untitled');
          if (!confirm(t('projects.confirmDelete', { title }))) return;
          try {
            await deleteProject(id);
          } catch (error) {
            alert(t('projects.deleteFailed', { message: error.message }));
          }
        }
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.project-edit-menu')) closeProjectEditMenus();
      });

      // 右侧面板隐藏/显示（浮动覆盖模式）
      toggleRightBtn.addEventListener('click', () => {
        panelRight.classList.toggle('hidden');
        updateWorkspaceLayoutMode();
      });

      // 右键菜单功能
      function setMenuItemVisible(item, visible) {
        if (!item) return;
        item.style.display = visible ? 'block' : 'none';
      }

      function refreshContextMenuDividers(menu) {
        menu.querySelectorAll('.context-menu-divider').forEach(divider => {
          let previous = divider.previousElementSibling;
          let next = divider.nextElementSibling;
          while (previous && previous.classList.contains('context-menu-divider')) previous = previous.previousElementSibling;
          while (next && next.classList.contains('context-menu-divider')) next = next.nextElementSibling;
          const hasVisiblePrevious = previous && previous.classList.contains('context-menu-item') && previous.style.display !== 'none';
          const hasVisibleNext = next && next.classList.contains('context-menu-item') && next.style.display !== 'none';
          divider.style.display = hasVisiblePrevious && hasVisibleNext ? 'block' : 'none';
        });
      }

      function positionMenuInViewport(menu, x, y) {
        const viewportPadding = 8;
        menu.classList.remove('show');
        menu.style.maxHeight = `${Math.max(120, window.innerHeight - viewportPadding * 2)}px`;
        menu.style.overflowY = 'auto';
        menu.style.left = '0px';
        menu.style.top = '0px';
        menu.classList.add('show');
        requestAnimationFrame(() => {
          const rect = menu.getBoundingClientRect();
          const maxLeft = Math.max(viewportPadding, window.innerWidth - rect.width - viewportPadding);
          const maxTop = Math.max(viewportPadding, window.innerHeight - rect.height - viewportPadding);
          const left = Math.min(Math.max(viewportPadding, x), maxLeft);
          const top = Math.min(Math.max(viewportPadding, y), maxTop);
          menu.style.left = `${left}px`;
          menu.style.top = `${top}px`;
        });
      }

      function showContextMenu(e, tagId = null, position = null) {
        e.preventDefault();
        e.stopPropagation();
        
        contextMenuTagId = tagId;
        contextMenuPosition = position;
        lastContextMenuOpenedAt = Date.now();
        
        // 根据是否有标签ID来决定显示哪些菜单项
        const createTagItem = document.getElementById('createTagMenuItem');
        
        if (tagId) {
          // 如果是针对现有标签的右键菜单
          const tag = findTagById(tagId);
          const canAddChild = tag ? canAddChildTag(tag) : false;
          const isEvent = tag ? isEventTag(tag) : false;
          const canShowEvents = tag ? getDirectEventChildren(tag).length > 0 : false;
          const canToggleText = !!tag && !isEvent;
          if (canToggleText) {
            // 检查当前节点及其子节点是否全部隐藏文本
            const allHidden = checkAllTextHidden(tag);
            toggleTextMenuItem.textContent = allHidden ? t('menu.showText') : t('menu.hideText');
          }
          setMenuItemVisible(createTagItem, false);
          setMenuItemVisible(toggleTextMenuItem, canToggleText);
          setMenuItemVisible(editTextMenuItem, !isEvent);
          setMenuItemVisible(editEventMenuItem, isEvent);
          showEventsMenuItem.textContent = displayedEventParentIds.has(tagId) ? t('menu.hideEvents') : t('menu.showEvents');
          setMenuItemVisible(showEventsMenuItem, canShowEvents);
          setMenuItemVisible(addChildMenuItem, canAddChild);
          setMenuItemVisible(deleteTagMenuItem, !!tag);
        } else {
          // 如果是在图片空白处右键，只显示创建标签
          setMenuItemVisible(createTagItem, true);
          setMenuItemVisible(toggleTextMenuItem, false);
          setMenuItemVisible(editTextMenuItem, false);
          setMenuItemVisible(editEventMenuItem, false);
          setMenuItemVisible(showEventsMenuItem, false);
          setMenuItemVisible(addChildMenuItem, false);
          setMenuItemVisible(deleteTagMenuItem, false);
        }
        
        refreshContextMenuDividers(contextMenu);
        positionMenuInViewport(contextMenu, e.clientX, e.clientY);
      }

      function hideContextMenu() {
        contextMenu.classList.remove('show');
        contextMenuTagId = null;
        contextMenuPosition = null;
      }

      // 点击其他地方关闭菜单
      document.addEventListener('click', (e) => {
        if (e.button !== 0) return;
        if (Date.now() - lastContextMenuOpenedAt < 250) return;
        if (e.target.closest('#contextMenu')) return;
        // 如果点击的不是文本编辑对话框，则关闭菜单
        if (!e.target.closest('#textEditDialog') && !e.target.closest('#eventEditDialog') && !e.target.closest('#locationCategoryDialog')) {
          hideContextMenu();
        }
      });
      
      // ESC键关闭菜单和对话框
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          hideContextMenu();
          hideTextEditDialog();
          hideEventEditDialog();
          hideLocationCategoryDialog();
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

      editEventMenuItem.addEventListener('click', () => {
        if (contextMenuTagId) {
          showEventEditDialog(contextMenuTagId);
          hideContextMenu();
        }
      });

      showEventsMenuItem.addEventListener('click', () => {
        if (contextMenuTagId) {
          if (displayedEventParentIds.has(contextMenuTagId)) {
            displayedEventParentIds.delete(contextMenuTagId);
          } else {
            displayedEventParentIds.add(contextMenuTagId);
          }
          renderMarkers();
          hideContextMenu();
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
        if (isLocationTag(tag) && locationEditCategoryField && locationEditCategorySelect) {
          locationEditCategoryField.classList.remove('is-hidden');
          locationEditCategorySelect.value = tag.locationCategory === 'equipment' ? 'equipment' : 'process';
        } else if (locationEditCategoryField) {
          locationEditCategoryField.classList.add('is-hidden');
        }
        textEditDialog.style.display = 'flex';
        textEditInput.focus();
        textEditInput.select();
        
        // 保存当前编辑的标签ID
        textEditDialog.dataset.tagId = tagId;
      }

      function hideTextEditDialog() {
        textEditDialog.style.display = 'none';
        textEditInput.value = '';
        if (locationEditCategoryField) locationEditCategoryField.classList.add('is-hidden');
        if (locationEditCategorySelect) locationEditCategorySelect.value = 'process';
        delete textEditDialog.dataset.tagId;
      }

      // 确认修改文本
      textEditConfirm.addEventListener('click', () => {
        const tagId = parseInt(textEditDialog.dataset.tagId);
        if (tagId) {
          const tag = findTagById(tagId);
          if (tag) {
            tag.text = textEditInput.value;
            if (isLocationTag(tag) && locationEditCategorySelect) {
              const nextCategory = locationEditCategorySelect.value === 'equipment' ? 'equipment' : 'process';
              if (tag.locationCategory !== nextCategory) {
                if (!canLocationKeepChildrenForCategory(tag)) {
                  alert(t('tags.noChildType'));
                  return;
                }
                tag.locationCategory = nextCategory;
              }
            }
            if (isEventTag(tag)) {
              const record = getEventRecordForTag(tag);
              record.event = tag.text;
              syncEventRecordPath(tag);
            } else {
              syncEventRecordPathsForBranch(tag);
            }
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

      function createEventStepRow(step = {}) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><input type="text" class="event-step-input" data-field="processStep" value="${escapeHtml(step.processStep || '')}"></td>
          <td><input type="text" class="event-step-input" data-field="processStepName" value="${escapeHtml(step.processStepName || '')}"></td>
          <td><input type="text" class="event-step-input" data-field="constraint" value="${escapeHtml(step.constraint || '')}"></td>
          <td><input type="text" class="event-step-input" data-field="command" value="${escapeHtml(step.command || '')}"></td>
          <td><input type="text" class="event-step-input" data-field="commandTemplateName" value="${escapeHtml(step.commandTemplateName || '')}"></td>
          <td><button class="tag-node-action danger delete-event-step-btn" type="button" title="${escapeHtml(t('event.deleteStep'))}">×</button></td>
        `;
        row.querySelector('.delete-event-step-btn').addEventListener('click', () => {
          row.remove();
        });
        return row;
      }

      function renderEventStepsEditor(steps = []) {
        eventStepsBody.innerHTML = '';
        normalizeProcessSteps(steps).forEach(step => {
          eventStepsBody.appendChild(createEventStepRow(step));
        });
      }

      function readEventStepsEditor() {
        return Array.from(eventStepsBody.querySelectorAll('tr'))
          .map(row => {
            const step = {
              processStep: '',
              processStepName: '',
              constraint: '',
              command: '',
              commandTemplateName: ''
            };
            row.querySelectorAll('.event-step-input').forEach(input => {
              step[input.dataset.field] = input.value;
            });
            return step;
          })
          .filter(step => Object.values(step).some(value => value.trim() !== ''));
      }

      function showEventEditDialog(tagId) {
        const tag = findTagById(tagId);
        if (!tag || !isEventTag(tag)) return;
        syncEventRecordPath(tag);
        const record = getEventRecordForTag(tag);
        eventNameInput.value = record.event || tag.text || '';
        eventSwitchInput.value = normalizeEventSwitch(record.eventSwitch);
        eventSwitchFunctionInput.value = record.eventSwitchFunction || '';
        renderEventStepsEditor(record.processSteps);
        const path = getTagBusinessPath(tag);
        eventPathPreview.textContent = [path.lineName, path.station, path.location, path.process].filter(Boolean).join(' / ');
        eventEditDialog.dataset.tagId = tagId;
        eventEditDialog.style.display = 'flex';
        eventNameInput.focus();
        eventNameInput.select();
      }

      function hideEventEditDialog() {
        eventEditDialog.style.display = 'none';
        eventNameInput.value = '';
        eventSwitchInput.value = '';
        eventSwitchFunctionInput.value = '';
        eventStepsBody.innerHTML = '';
        eventPathPreview.textContent = '';
        delete eventEditDialog.dataset.tagId;
      }

      addEventStepBtn.addEventListener('click', () => {
        eventStepsBody.appendChild(createEventStepRow());
      });

      eventEditConfirm.addEventListener('click', () => {
        const tagId = parseInt(eventEditDialog.dataset.tagId);
        const tag = tagId ? findTagById(tagId) : null;
        if (tag && isEventTag(tag)) {
          const record = getEventRecordForTag(tag);
          record.event = eventNameInput.value;
          record.eventSwitch = normalizeEventSwitch(eventSwitchInput.value);
          record.eventSwitchFunction = eventSwitchFunctionInput.value;
          record.processSteps = readEventStepsEditor();
          syncEventRecordPath(tag);
          tag.text = record.event;
          renderAll();
          markProjectDirty();
        }
        hideEventEditDialog();
      });

      eventEditCancel.addEventListener('click', hideEventEditDialog);

      eventNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') eventEditConfirm.click();
      });

      eventEditDialog.addEventListener('click', (e) => {
        if (e.target === eventEditDialog) hideEventEditDialog();
      });

      function showLocationCategoryDialog() {
        if (!locationCategoryDialog) return Promise.resolve('process');
        locationCategoryDialog.style.display = 'flex';
        const firstChoice = locationCategoryDialog.querySelector('.location-category-choice');
        if (firstChoice) firstChoice.focus();
        return new Promise(resolve => {
          pendingLocationCategoryResolve = resolve;
        });
      }

      function hideLocationCategoryDialog(value = null) {
        if (!locationCategoryDialog || locationCategoryDialog.style.display === 'none') return;
        locationCategoryDialog.style.display = 'none';
        if (pendingLocationCategoryResolve) {
          const resolve = pendingLocationCategoryResolve;
          pendingLocationCategoryResolve = null;
          resolve(value);
        }
      }

      document.querySelectorAll('.location-category-choice').forEach(button => {
        button.addEventListener('click', () => {
          const category = button.dataset.category === 'equipment' ? 'equipment' : 'process';
          hideLocationCategoryDialog(category);
        });
      });

      if (locationCategoryCancel) {
        locationCategoryCancel.addEventListener('click', () => hideLocationCategoryDialog(null));
      }

      if (locationCategoryDialog) {
        locationCategoryDialog.addEventListener('click', (e) => {
          if (e.target === locationCategoryDialog) hideLocationCategoryDialog(null);
        });
      }

      // 文本显示全局控制
      function updateTextVisibility() {
        if (showTextCheckbox.checked) {
          imageWrapper.classList.add('show-text');
        } else {
          imageWrapper.classList.remove('show-text');
        }
        updateMarkerTextDisplay();
        updateMarkerHoverState();
      }
      showTextCheckbox.addEventListener('change', updateTextVisibility);

      function renderSidePanelView() {
        sidePanelSelect.value = sidePanelView === 'materials' ? 'materials' : 'tags';
        const showGroupMode = sidePanelView === 'tags' && tagListMode === 'group';
        tagsPanelView.classList.toggle('is-hidden', sidePanelView !== 'tags');
        tagListContainer.classList.toggle('is-hidden', showGroupMode);
        if (locationGroupPanel) locationGroupPanel.classList.toggle('is-hidden', !showGroupMode);
        materialsPanelView.classList.toggle('is-hidden', sidePanelView !== 'materials');
      }

      function setSidePanelView(nextView) {
        sidePanelView = ['tags', 'materials'].includes(nextView) ? nextView : 'tags';
        renderSidePanelView();
        renderTagList();
        runRenderHooks('panel');
      }

      sidePanelSelect.addEventListener('change', (e) => {
        setSidePanelView(e.target.value);
      });
      renderSidePanelView();
      updateWorkspaceLayoutMode();

      tagTreeModeBtn.addEventListener('click', () => {
        sidePanelView = 'tags';
        tagListMode = 'tree';
        renderSidePanelView();
        renderTagList();
        runRenderHooks('panel');
      });
      tagTypeModeBtn.addEventListener('click', () => {
        sidePanelView = 'tags';
        tagListMode = 'type';
        renderSidePanelView();
        renderTagList();
        runRenderHooks('panel');
      });
      if (tagGroupModeBtn) {
        tagGroupModeBtn.addEventListener('click', () => {
          sidePanelView = 'tags';
          tagListMode = 'group';
          renderSidePanelView();
          renderTagList();
          runRenderHooks('panel');
        });
      }
      collapseAllTagsBtn.addEventListener('click', collapseAllTags);
      importTypeSelect.addEventListener('change', updateImportUi);
      if (projectSearchInput) {
        projectSearchInput.addEventListener('input', (e) => {
          projectSearchQuery = e.target.value;
          renderProjectList(allProjects);
        });
      }
      if (projectTagFilterSelect) {
        projectTagFilterSelect.addEventListener('change', (e) => {
          projectTagFilter = e.target.value;
          renderProjectList(allProjects);
        });
      }
      if (projectGroupSelect) {
        projectGroupSelect.addEventListener('change', (e) => {
          projectGroupMode = e.target.value === 'tag' ? 'tag' : 'list';
          renderProjectList(allProjects);
        });
      }
      if (projectSortSelect) {
        projectSortSelect.addEventListener('change', (e) => {
          projectSortMode = e.target.value === 'name' ? 'name' : 'updated';
          renderProjectList(allProjects);
        });
      }
      tagSearchInput.addEventListener('input', (e) => {
        tagSearchQuery = e.target.value.trim().toLowerCase();
        updateCanvasBranchFilterOptions();
        renderTagList();
        runRenderHooks('overlay');
      });
      tagSearchClearBtn.addEventListener('click', () => {
        tagSearchQuery = '';
        tagSearchInput.value = '';
        updateCanvasBranchFilterOptions();
        renderTagList();
        runRenderHooks('overlay');
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

      function collapseAllTags() {
        const flattenedTags = getAllTagsFlattened();
        collapsedTagIds = new Set(
          flattenedTags
            .filter(tag => tag.children && tag.children.length > 0)
            .map(tag => String(tag._id))
        );
        collapsedTypeGroupIds = new Set(
          tagTypes
            .map((type, index) => flattenedTags.some(tag => tag.typeIndex === index) ? String(index) : null)
            .filter(Boolean)
        );
        renderTagList();
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
        const optionTags = getCanvasBranchOptionTags();
        canvasHiddenBranchIds = canvasHiddenBranchIds
          .filter(id => findTagById(parseInt(id)));
        const optionIds = new Set(optionTags.map(tag => String(tag.id)));
        const missingHiddenTags = canvasHiddenBranchIds
          .filter(id => !optionIds.has(id))
          .map(id => findTagById(parseInt(id)))
          .filter(Boolean);

        canvasBranchFilterMenu.innerHTML = '';

        if (optionTags.length > 0) {
          const visibleIds = optionTags.map(tag => String(tag.id));
          const allVisibleChecked = optionTags.every(tag => !isCanvasBranchHiddenBySelfOrAncestor(tag));
          const bulk = document.createElement('div');
          bulk.className = 'canvas-filter-bulk';
          bulk.innerHTML = `
            <span><input type="checkbox" ${allVisibleChecked ? 'checked' : ''}> ${escapeHtml(t('panel.selectAll'))}</span>
            <span>${visibleIds.length}</span>
          `;
          bulk.addEventListener('click', (e) => {
            e.preventDefault();
            if (allVisibleChecked) {
              const nextIds = new Set(canvasHiddenBranchIds);
              visibleIds.forEach(id => nextIds.add(id));
              canvasHiddenBranchIds = Array.from(nextIds);
            } else {
              canvasHiddenBranchIds = canvasHiddenBranchIds.filter(id => !visibleIds.includes(id));
            }
            updateCanvasBranchFilterOptions();
            renderMarkers();
            renderTagList();
          });
          canvasBranchFilterMenu.appendChild(bulk);
        }

        if (optionTags.length === 0 && missingHiddenTags.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'canvas-filter-empty';
          empty.textContent = tags.length === 0 ? t('panel.noNodes') : t('panel.noMatchingNodes');
          canvasBranchFilterMenu.appendChild(empty);
        }

        function appendOption(tag, prefix = '') {
          const id = String(tag.id);
          const type = tagTypes[tag.typeIndex];
          const isHidden = canvasHiddenBranchIds.includes(id);
          const isCovered = isCanvasBranchHiddenByAncestor(tag);
          const isChecked = !isHidden && !isCovered;
          const label = document.createElement('label');
          label.className = 'canvas-filter-option';
          if (isCovered) label.classList.add('covered');
          label.innerHTML = `
            <input type="checkbox" value="${id}" ${isChecked ? 'checked' : ''} ${isCovered ? 'disabled' : ''}>
            <span>${escapeHtml(`${prefix}${getTypeAbbreviation(type ? type.name : 'Tag')} · ${getTagDisplayName(tag)}${isCovered ? t('panel.covered') : ''}`)}</span>
          `;
          const checkbox = label.querySelector('input');
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
              canvasHiddenBranchIds = canvasHiddenBranchIds.filter(hiddenId => hiddenId !== id);
            } else {
              if (!canvasHiddenBranchIds.includes(id)) canvasHiddenBranchIds.push(id);
              canvasHiddenBranchIds = canvasHiddenBranchIds.filter(hiddenId => {
                const hiddenTag = findTagById(parseInt(hiddenId));
                return hiddenId === id || !(hiddenTag && containsTagId(tag, hiddenTag.id));
              });
            }
            updateCanvasBranchFilterOptions();
            renderMarkers();
            renderTagList();
          });
          canvasBranchFilterMenu.appendChild(label);
        }

        missingHiddenTags.forEach(tag => appendOption(tag, t('panel.currentPrefix')));
        optionTags.forEach(tag => {
          if (!missingHiddenTags.some(hiddenTag => hiddenTag.id === tag.id)) {
            appendOption(tag);
          }
        });

        if (canvasHiddenBranchIds.length === 0) {
          canvasBranchFilterLabel.textContent = t('panel.allNodes');
        } else {
          const visibleCount = getAllTagsFlattened(getCanvasVisibleRootTags()).length;
          canvasBranchFilterLabel.textContent = t('panel.selectedNodes', { count: visibleCount });
        }
      }

      function getCanvasVisibleRootTags() {
        if (canvasHiddenBranchIds.length === 0) return tags;
        const cloneVisible = tagList => tagList
          .filter(tag => !canvasHiddenBranchIds.includes(String(tag.id)))
          .map(tag => ({
            ...tag,
            children: tag.children && tag.children.length > 0 ? cloneVisible(tag.children) : []
          }));
        return cloneVisible(tags);
      }

      function isCanvasBranchHiddenByAncestor(tag) {
        let parent = findParentTag(tag.id);
        while (parent) {
          if (canvasHiddenBranchIds.includes(String(parent.id))) return true;
          parent = findParentTag(parent.id);
        }
        return false;
      }

      function isCanvasBranchHiddenBySelfOrAncestor(tag) {
        return canvasHiddenBranchIds.includes(String(tag.id)) || isCanvasBranchHiddenByAncestor(tag);
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

      function findParentTag(targetId, list = tags, parent = null) {
        for (let tag of list) {
          if (tag.id === targetId) return parent;
          if (tag.children && tag.children.length > 0) {
            const found = findParentTag(targetId, tag.children, tag);
            if (found) return found;
          }
        }
        return null;
      }

      function getTagBusinessPath(tag) {
        const path = {
          lineName: currentProjectTitle || '',
          station: '',
          location: '',
          locationCategory: 'process',
          process: ''
        };
        const ancestors = [];
        let cursor = tag;
        while (cursor) {
          ancestors.unshift(cursor);
          cursor = findParentTag(cursor.id);
        }
        ancestors.forEach(item => {
          const type = tagTypes[item.typeIndex];
          const name = getTagDisplayName(item);
          if (!type) return;
          if (type.name.includes('Station')) path.station = name;
          if (type.name.includes('Location')) {
            path.location = name;
            path.locationCategory = item.locationCategory === 'equipment' ? 'equipment' : 'process';
          }
          if (type.name.includes('Process')) path.process = name;
        });
        return path;
      }

      function setHoveredTag(tagId) {
        if (isDraggingTag) return;
        hoveredTagId = tagId;
        updateMarkerHoverState();
      }

      function clearHoveredTag(tagId) {
        if (isDraggingTag) return;
        if (hoveredTagId === tagId) {
          hoveredTagId = null;
          updateMarkerHoverState();
        }
      }

      function updateMarkerHoverState() {
        const hoveredTag = hoveredTagId ? findTagById(hoveredTagId) : null;
        document.querySelectorAll('.tag-marker').forEach(marker => {
          const markerTagId = parseInt(marker.getAttribute('data-tag-id'));
          const isHovered = hoveredTag && markerTagId === hoveredTag.id;
          const isDescendant = hoveredTag && containsTagId(hoveredTag, markerTagId);
          marker.classList.toggle('hover-root', !!isHovered);
          marker.classList.toggle('hover-descendant', !!isDescendant);
        });
      }

      function createParentEventPopover(parentTag) {
        const eventChildren = getDirectEventChildren(parentTag);
        if (eventChildren.length === 0) return null;
        const popover = document.createElement('div');
        popover.className = 'parent-event-popover';
        const title = document.createElement('div');
        title.className = 'parent-event-popover-title';
        const parentType = tagTypes[parentTag.typeIndex];
        title.textContent = parentTag.text || (parentType ? parentType.name : '') || t('tags.unnamed');
        popover.appendChild(title);
        eventChildren.forEach(eventTag => {
          const record = getEventRecordForTag(eventTag);
          const item = document.createElement('div');
          item.className = 'parent-event-item';
          item.innerHTML = `
            <img src="./static/icons/event.svg" alt="Event">
            <span>${escapeHtml(`${record.event || eventTag.text || t('event.unnamed')}(es: ${normalizeEventSwitch(record.eventSwitch)})`)}</span>
          `;
          popover.appendChild(item);
        });
        return popover;
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
        const groupedLocationIds = getGroupedLocationIdSet();
        
        const visibleMarkerTags = allTags.filter(tag => {
          const type = tagTypes[tag.typeIndex];
          if (locationGroupRenderEnabled && type && type.name.includes('Location') && groupedLocationIds.has(Number(tag._id))) return false;
          return hasAssignedCoordinates(tag) && !(type && type.name.includes('Event'));
        });

        visibleMarkerTags.forEach(tag => {
          const type = tagTypes[tag.typeIndex];
          const originalTag = findTagById(tag._id);
          const marker = document.createElement('div');
          marker.className = 'tag-marker';
          if (tag._isChild) marker.classList.add('child-marker');
          if (originalTag && displayedEventParentIds.has(originalTag.id)) {
            marker.classList.add('has-event-popover');
          }

          marker.style.left = `${tag.x * 100}%`;
          marker.style.top = `${tag.y * 100}%`;
          marker.setAttribute('data-tag-id', tag._id);

          const dot = document.createElement('div');
          dot.className = 'dot';
          dot.style.setProperty('--marker-color', type ? type.color : '#999');
          
          const markerIcon = getTagTypeIcon(originalTag || tag, type);
          if (markerIcon) {
            const iconImg = document.createElement('img');
            iconImg.src = markerIcon;
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
          const eventRecord = originalTag && isEventTag(originalTag) ? getEventRecordForTag(originalTag) : null;
          textSpan.textContent = eventRecord ? '' : (tag.text || '');

          marker.appendChild(dot);
          marker.appendChild(textSpan);
          if (originalTag && displayedEventParentIds.has(originalTag.id)) {
            const eventPopover = createParentEventPopover(originalTag);
            if (eventPopover) marker.appendChild(eventPopover);
          }
          annotationCanvas.appendChild(marker);

          // 记录标记点位置（用于后续绘制连接线）
          markerPositions[tag._id] = {
            x: tag.x * annotationCanvas.offsetWidth,
            y: tag.y * annotationCanvas.offsetHeight,
            parentId: tag._parentId
          };

          marker.addEventListener('mousedown', (e) => startDrag(tag, e));
          marker.addEventListener('mouseenter', () => setHoveredTag(tag._id));
          marker.addEventListener('mouseleave', () => clearHoveredTag(tag._id));
          
          // 添加右键菜单事件
          marker.addEventListener('contextmenu', (e) => {
            showContextMenu(e, tag._id);
          });
          
          // 添加双击事件 - 在右侧列表中高亮定位
          marker.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            highlightTagInList(tag._id);
            if (originalTag && isEventTag(originalTag)) showEventEditDialog(tag._id);
          });
        });
        
        // 更新文本显示状态
        updateMarkerTextDisplay();
        updateMarkerHoverState();
        
        // 绘制父子连接线，仅在父子两端都可见时才绘制
        allTags.forEach(tag => {
          if (tag._parentId && markerPositions[tag._parentId] && markerPositions[tag._id]) {
            const parent = markerPositions[tag._parentId];
            const child = markerPositions[tag._id];
            
            ['connection-line-halo', 'connection-line'].forEach(className => {
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', parent.x);
              line.setAttribute('y1', parent.y);
              line.setAttribute('x2', child.x);
              line.setAttribute('y2', child.y);
              line.setAttribute('class', className);
              svg.appendChild(line);
            });
          }
        });

        applyPanTransform();
      }

      // 获取类型名称的缩写
      function getTypeAbbreviation(typeName) {
        if (typeName.includes('Station')) return 'ST';
        if (typeName.includes('Location')) return 'LC';
        if (typeName.includes('Event')) return 'EV';
        return typeName.substring(0, 2).toUpperCase();
      }

      function getTypeIndexByName(namePart) {
        return tagTypes.findIndex(type => type.name.includes(namePart));
      }

      function getRootTagTypeIndex() {
        const stationIndex = getTypeIndexByName('Station');
        return stationIndex === -1 ? 0 : stationIndex;
      }

      function getChildTypeIndexForParent(parentTag) {
        const parentType = tagTypes[parentTag.typeIndex];
        if (!parentType) return -1;
        if (parentType.name.includes('Station')) return getTypeIndexByName('Location');
        if (parentType.name.includes('Location')) return getTypeIndexByName('Event');
        return -1;
      }

      function canAddChildTag(tag) {
        return getChildTypeIndexForParent(tag) !== -1;
      }

      function getTagSearchText(tag) {
        const type = tagTypes[tag.typeIndex];
        const eventRecord = isEventTag(tag) ? getEventRecordForTag(tag) : null;
        return [
          tag.text || '',
          type ? type.name : '',
          tag.locationCategory || '',
          eventRecord ? eventRecord.event : '',
          eventRecord ? eventRecord.eventSwitchFunction : '',
          eventRecord ? `${normalizeEventSwitch(eventRecord.eventSwitch)}` : '',
          eventRecord ? normalizeProcessSteps(eventRecord.processSteps).map(step => Object.values(step).join(' ')).join(' ') : '',
          getTypeAbbreviation(type ? type.name : 'Tag'),
          hasAssignedCoordinates(tag) ? `${(tag.x * 100).toFixed(1)}` : (isEventTag(tag) ? '' : t('tags.unassignedCoordinate')),
          hasAssignedCoordinates(tag) ? `${(tag.y * 100).toFixed(1)}` : ''
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
        if (tagGroupModeBtn) tagGroupModeBtn.classList.toggle('active', tagListMode === 'group');
        tagSearchInput.value = tagSearchQuery;

        if (tags.length === 0) {
          tagListContainer.innerHTML = `<div class="no-tags">${escapeHtml(t('tags.empty'))}</div>`;
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
            tagListContainer.innerHTML = `<div class="no-tags">${escapeHtml(t('tags.noMatch'))}</div>`;
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

          const groupId = String(typeIndex);
          const isCollapsed = collapsedTypeGroupIds.has(groupId);
          content.classList.toggle('collapsed', isCollapsed);
          header.querySelector('.collapse-icon').classList.toggle('collapsed', isCollapsed);
          header.addEventListener('click', () => {
            if (collapsedTypeGroupIds.has(groupId)) {
              collapsedTypeGroupIds.delete(groupId);
            } else {
              collapsedTypeGroupIds.add(groupId);
            }
            renderTagList();
          });
        });
        if (renderedGroups === 0) {
          tagListContainer.innerHTML = `<div class="no-tags">${escapeHtml(t('tags.noMatch'))}</div>`;
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
        if (isCanvasBranchHiddenBySelfOrAncestor(tag)) {
          row.classList.add('canvas-filter-hidden');
        }
        const isEventNode = isEventTag(tag);
        if (!isEventNode && !hasAssignedCoordinates(tag)) row.classList.add('coordinate-unassigned');
        row.setAttribute('data-tag-id', tag.id);
        row.title = t('tags.rowTitle');

        const childCount = hasChildren ? tag.children.length : 0;
        const eventRecord = isEventNode ? getEventRecordForTag(tag) : null;
        const displayText = eventRecord
          ? (eventRecord.event || tag.text || t('event.unnamed'))
          : (tag.text && tag.text.trim() ? tag.text.trim() : t('tags.unnamed'));
        const parentTag = parentId ? findTagById(parentId) : null;
        const parentMeta = parentTag ? ` · ${t('tags.parent', { name: parentTag.text || getTypeAbbreviation(tagTypes[parentTag.typeIndex]?.name || 'Tag') })}` : '';
        const childMeta = childCount ? ` · ${t('tags.children', { count: childCount })}` : '';
        const locationMeta = isLocationTag(tag) ? ` · ${tag.locationCategory === 'equipment' ? t('tags.locationEquipment') : t('tags.locationProcess')}` : '';
        const eventMeta = eventRecord ? ` · es: ${normalizeEventSwitch(eventRecord.eventSwitch)}` : '';
        const unassignedMeta = !isEventNode && !hasAssignedCoordinates(tag) ? ` · ${t('tags.unassignedCoordinate')}` : '';
        const canAddChild = canAddChildTag(tag);
        const canAssignCoordinate = type && type.name.includes('Station') && !hasAssignedCoordinates(tag);
        const isCollapsed = hasChildren && includeChildren && collapsedTagIds.has(String(tag.id));

        row.innerHTML = `
          <button class="tag-node-toggle ${hasChildren && includeChildren ? '' : 'empty'}" type="button">${hasChildren && includeChildren ? (isCollapsed ? '▶' : '▼') : ''}</button>
          <div class="tag-node-main">
            <span class="tag-node-dot" style="background:${type ? type.color : '#999'}"></span>
            <span class="tag-node-text">${escapeHtml(displayText)}</span>
            <span class="tag-node-meta">${escapeHtml(`${getTypeAbbreviation(type ? type.name : 'Tag')}${locationMeta}${eventMeta}${unassignedMeta}${childMeta}${parentMeta}`)}</span>
          </div>
          <div class="tag-node-actions">
            ${canAssignCoordinate ? `<button class="tag-node-action assign-coordinate-btn" type="button" title="${escapeHtml(t('csv.assignButtonTitle'))}">⌖</button>` : ''}
            <button class="tag-node-action edit-tag-btn" type="button" title="${escapeHtml(t('tags.editTitle'))}">✎</button>
            ${eventRecord ? `<button class="tag-node-action edit-event-btn" type="button" title="${escapeHtml(t('menu.editEvent'))}">!</button>` : ''}
            ${canAddChild ? `<button class="tag-node-action add-child-node-btn" type="button" title="${escapeHtml(t('tags.addChildTitle'))}">+</button>` : ''}
            <button class="tag-node-action danger delete-tag-btn" type="button" title="${escapeHtml(t('tags.deleteTitle'))}">×</button>
          </div>
        `;

        node.appendChild(row);
        container.appendChild(node);

        row.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          if (isEventTag(tag)) {
            showEventEditDialog(tag.id);
          } else {
            showTextEditDialog(tag.id);
          }
        });
        row.addEventListener('contextmenu', (e) => {
          showContextMenu(e, tag.id);
        });

        const assignCoordinateBtn = row.querySelector('.assign-coordinate-btn');
        if (assignCoordinateBtn) {
          assignCoordinateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.MESCsvImport && typeof window.MESCsvImport.startCoordinateAssignment === 'function') {
              window.MESCsvImport.startCoordinateAssignment(tag.id);
            }
          });
        }

        row.querySelector('.edit-tag-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          showTextEditDialog(tag.id);
        });

        const editEventBtn = row.querySelector('.edit-event-btn');
        if (editEventBtn) {
          editEventBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showEventEditDialog(tag.id);
          });
        }

        row.querySelector('.delete-tag-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          deleteTagById(tag.id);
        });

        const addChildBtn = row.querySelector('.add-child-node-btn');
        if (addChildBtn) {
          addChildBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addChildToTag(tag.id);
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
          if (isCollapsed) childrenContent.style.display = 'none';

          const toggleBtn = row.querySelector('.tag-node-toggle');
          toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = String(tag.id);
            if (collapsedTagIds.has(id)) {
              collapsedTagIds.delete(id);
            } else {
              collapsedTagIds.add(id);
            }
            renderTagList();
          });
        }
      }

      // ---------- State mutations and business operations ----------
      // Keep relationship cleanup here so render functions can stay mostly
      // focused on drawing UI from state.
      function canLocationKeepChildrenForCategory(tag) {
        if (!isLocationTag(tag)) return false;
        if (!tag.children || tag.children.length === 0) return true;
        return tag.children.every(child => {
          const childType = tagTypes[child.typeIndex];
          return childType && childType.name.includes('Event');
        });
      }

      function syncEventRecordPathsForBranch(rootTag) {
        if (isEventTag(rootTag)) syncEventRecordPath(rootTag);
        if (rootTag.children && rootTag.children.length > 0) {
          rootTag.children.forEach(syncEventRecordPathsForBranch);
        }
      }

      function deleteTagById(tagId) {
        let deletedEventRecordIds = [];
        // 辅助函数：清理单个标签对物料的反向关联
        function cleanTagMaterialLinks(tag) {
          if (tag.materialLinks && tag.materialLinks.length > 0) {
            tag.materialLinks.forEach(materialIndex => {
              if (materials[materialIndex]) {
                materials[materialIndex].processLinks = (materials[materialIndex].processLinks || []).filter(pid => pid !== tag.id);
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
              deletedEventRecordIds = getEventRecordIdsForBranch(arr[i]);
              
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
          if (deletedEventRecordIds.length > 0) {
            eventRecords = eventRecords.filter(record => !deletedEventRecordIds.includes(record.id));
          }
          canvasHiddenBranchIds = canvasHiddenBranchIds.filter(id => findTagById(parseInt(id)));
          collapsedTagIds.forEach(id => {
            if (!findTagById(parseInt(id))) collapsedTagIds.delete(id);
          });
          displayedEventParentIds.delete(tagId);
          if (hoveredTagId === tagId) hoveredTagId = null;
          locationGroups = locationGroups
            .filter(group => Number(group.stationId) !== Number(tagId))
            .map(group => ({
              ...group,
              locationIds: group.locationIds.filter(locationId => Number(locationId) !== Number(tagId))
            }));
          renderAll();
          markProjectDirty();
        }
      }

      function getEventRecordIdsForBranch(rootTag) {
        const ids = [];
        if (rootTag.eventRecordId) ids.push(rootTag.eventRecordId);
        if (rootTag.children && rootTag.children.length > 0) {
          rootTag.children.forEach(child => {
            ids.push(...getEventRecordIdsForBranch(child));
          });
        }
        return ids;
      }

      async function addChildToTag(parentId) {
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

        const childTypeIndex = getChildTypeIndexForParent(parentTag);

        if (childTypeIndex === -1) {
          alert(t('tags.noChildType'));
          return;
        }
        const childType = tagTypes[childTypeIndex];

        const newChild = {
          id: Date.now(),
          typeIndex: childTypeIndex,
          text: '',
          x: newX,
          y: newY,
          children: []
        };
        if (childType && childType.name.includes('Location')) {
          const selectedCategory = await showLocationCategoryDialog();
          if (!selectedCategory) return;
          newChild.locationCategory = selectedCategory;
        }
        if (childType && childType.name.includes('Event')) {
          const record = createEventRecordFromTag(newChild);
          newChild.eventRecordId = record.id;
          eventRecords.push(record);
        }
        
        parentTag.children.push(newChild);
        if (childType && childType.name.includes('Event')) syncEventRecordPath(newChild);
        renderAll();
        markProjectDirty();
      }

      // ★ 核心修复：renderAll 现在包含类型面板的刷新
      function renderAll() {
        // Central refresh after broad state changes.
        renderSidePanelView();
        updateCanvasBranchFilterOptions();
        renderMarkers();
        renderTagList();
        renderMaterialList();
        runRenderHooks('all');
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
          materialListContainer.innerHTML = `<div class="no-materials">${escapeHtml(t('materials.empty'))}</div>`;
          return;
        }

        materials.forEach((material, index) => {
          const materialDiv = document.createElement('div');
          materialDiv.className = 'material-item';
          materialDiv.innerHTML = `
            <div class="material-header">
              <div style="flex:1;">
                <input type="text" class="material-name-input" data-index="${index}" value="${escapeHtml(material.name)}" placeholder="${escapeHtml(t('materials.namePlaceholder'))}" style="width:100%; font-weight:600;">
              </div>
              <button class="btn btn-danger btn-sm delete-material-btn" data-index="${index}">${escapeHtml(t('materials.delete'))}</button>
            </div>
            
            <div class="material-edit-row">
              <div class="material-field-group">
                <label>${escapeHtml(t('materials.abbrev'))}</label>
                <input type="text" class="material-abbrev-input" data-index="${index}" value="${escapeHtml(material.abbreviation)}" placeholder="${escapeHtml(t('materials.abbrev'))}" maxlength="10">
              </div>
              <div class="material-field-group">
                <label>${escapeHtml(t('materials.category'))}</label>
                <input type="text" class="material-category-input" data-index="${index}" value="${escapeHtml(material.category)}" placeholder="${escapeHtml(t('materials.category'))}">
              </div>
            </div>
            
            <div class="material-edit-row full">
              <div class="material-field-group">
                <label>${escapeHtml(t('materials.type'))}</label>
                <input type="text" class="material-type-input" data-index="${index}" value="${escapeHtml(material.type)}" placeholder="${escapeHtml(t('materials.type'))}">
              </div>
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
              canvasHiddenBranchIds = [];
              hoveredTagId = null;
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
          typeIndex: getRootTagTypeIndex(),
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
        if (!tag || isEventTag(tag)) return true;
        if (tag._textHidden !== true) return false;
        if (tag.children && tag.children.length > 0) {
          return tag.children.every(child => isEventTag(child) || checkAllTextHidden(child));
        }
        return true;
      }

      // 切换节点及其所有子节点的文本显示/隐藏
      function toggleNodeTextVisibility(tag, show) {
        if (isEventTag(tag)) return;
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
              // Event keeps the canvas clean: show its full text on hover or via
              // the parent-node event popover, not through the global text toggle.
              const shouldShow = !isEventTag(tag)
                && isGlobalShow
                && tag._textHidden !== true
                && textSpan.textContent
                && textSpan.textContent.trim() !== '';
              
              if (shouldShow) {
                textSpan.classList.remove('force-hidden');
              } else {
                textSpan.classList.add('force-hidden');
              }
            }
          }
        });
      }

      // 在右侧列表中高亮定位标签
      function highlightTagInList(tagId) {
        sidePanelView = 'tags';
        tagListMode = 'tree';
        renderSidePanelView();
        let parentTag = findParentTag(tagId);
        while (parentTag) {
          collapsedTagIds.delete(String(parentTag.id));
          parentTag = findParentTag(parentTag.id);
        }
        const tag = findTagById(tagId);
        if (tag) collapsedTypeGroupIds.delete(String(tag.typeIndex));
        renderTagList();

        // 清除之前的高亮
        document.querySelectorAll('.tag-node-row.highlighted').forEach(el => {
          el.classList.remove('highlighted');
        });

        // 通过data-tag-id属性找到对应的节点行
        const targetEditor = tagListContainer.querySelector(`.tag-node-row[data-tag-id="${tagId}"]`);
        
        if (targetEditor) {
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
      let markerDragRenderPending = false;

      function scheduleMarkerDragRender() {
        if (markerDragRenderPending) return;
        markerDragRenderPending = true;
        requestAnimationFrame(() => {
          markerDragRenderPending = false;
          renderMarkers();
        });
      }

      function startDrag(flatTag, e) {
        if (e.button !== 0) return;
        // The list/canvas may pass flattened tags; always mutate the original
        // nested tag object so export/import and child relationships stay intact.
        e.preventDefault();
        e.stopPropagation();
        
        const originalTag = findTagById(flatTag._id);
        if (!originalTag) return;

        isDraggingTag = true;
        hoveredTagId = null;
        updateMarkerHoverState();
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

        scheduleMarkerDragRender();
      }

      function stopDrag() {
        if (dragTag) {
          markProjectDirty();
        }
        dragTag = null;
        isDraggingTag = false;
        renderAll();
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
        imageWrapper.style.height = '';
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
        imageWrapper.style.setProperty('--inverse-zoom', (1 / Math.max(0.1, zoomLevel)).toFixed(4));
        imageWrapper.classList.toggle('screen-marker-mode', markerRenderMode === 'screen');
        zoomReadout.textContent = `${Math.round(zoomLevel * 100)}%`;
        runRenderHooks('transform');
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
        const horizontalVisible = Math.min(96, Math.max(36, wrapperWidth * 0.1));
        const verticalVisible = Math.min(84, Math.max(32, wrapperHeight * 0.1));
        const centerX = (wrapperWidth - scaledWidth) / 2;
        const centerY = (wrapperHeight - scaledHeight) / 2;

        let minX;
        let maxX;
        let minY;
        let maxY;

        if (scaledWidth <= wrapperWidth) {
          minX = centerX;
          maxX = centerX;
        } else {
          minX = horizontalVisible - scaledWidth;
          maxX = wrapperWidth - horizontalVisible;
        }

        if (scaledHeight <= wrapperHeight) {
          minY = centerY;
          maxY = centerY;
        } else {
          minY = verticalVisible - scaledHeight;
          maxY = wrapperHeight - verticalVisible;
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
        if (e.button !== 0) return;
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

      function shouldUseNativeWheelScroll(target) {
        if (!(target instanceof Element)) return false;
        return !!target.closest('.location-group-canvas-grid, .location-group-event-list, .location-group-event-popout-list');
      }

      imageWrapper.addEventListener('wheel', (e) => {
        if (!annotateImage.src) return;
        if (shouldUseNativeWheelScroll(e.target)) return;
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
      if (markerRenderModeSelect) {
        markerRenderModeSelect.addEventListener('change', (e) => {
          markerRenderMode = e.target.value === 'screen' ? 'screen' : 'image';
          applyPanTransform();
          renderMarkers();
        });
      }

      window.addEventListener('resize', () => {
        if (!annotateImage.src || imageWrapper.style.display === 'none') return;
        fitCanvasToImage();
        resetView();
        renderMarkers();
      });

      // ---------- 添加物料 ----------
      addMaterialBtn.addEventListener('click', () => {
        const newMaterial = {
          name: t('materials.newName'),
          abbreviation: t('materials.newAbbrev'),
          category: t('materials.defaultCategory'),
          type: t('materials.defaultType')
        };
        materials.push(newMaterial);
        renderMaterialList();
        markProjectDirty();
      });

      // ---------- 清空所有标签 ----------
      clearAllBtn.addEventListener('click', () => {
        tags = [];
        eventRecords = [];
        canvasHiddenBranchIds = [];
        collapsedTagIds.clear();
        collapsedTypeGroupIds.clear();
        displayedEventParentIds.clear();
        hoveredTagId = null;
        materials.forEach(m => m.processLinks = []); // 清空旧项目的关联标签
        renderAll();
        markProjectDirty();
      });

      // ---------- 导出 JSON ----------
      exportBtn.addEventListener('click', () => {
        if (!isAdmin()) {
          alert(t('export.adminOnly'));
          return;
        }
        const data = serializeProjectData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentProjectTitle || t('export.defaultName')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });

      // ---------- 导入 JSON ----------
      importBtn.addEventListener('click', () => {
        if (!currentProjectId) {
          alert(t('projects.choose'));
          return;
        }
        if (importTypeSelect.value === 'csv') {
          if (window.MESCsvImport && typeof window.MESCsvImport.openFilePicker === 'function') {
            window.MESCsvImport.openFilePicker();
          }
          return;
        }
        if (importTypeSelect.value === 'xml') {
          if (!isAdmin()) {
            alert(t('import.adminOnly'));
            return;
          }
          pendingXmlImportMode = 'update-current';
          pendingXmlUpdateProjectId = currentProjectId;
          xmlImportFileInput.click();
          return;
        }
        if (!isAdmin()) {
          alert(t('import.adminOnly'));
          return;
        }
        pendingJsonImportMode = 'update-current';
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
              alert(t('import.invalidJson'));
              return;
            }
            if (pendingJsonImportMode === 'create') {
              const defaultName = file.name.replace(/\.json$/i, '') || t('import.defaultProject');
              const name = prompt(t('projects.promptImportName'), defaultName);
              if (!name || !name.trim()) return;
              importProjectFromJson(data, name.trim())
                .then(() => alert(t('import.success')))
                .catch(error => alert(t('import.failed', { message: error.message })));
            } else {
              replaceCurrentProjectFromJson(data)
                .then(() => alert(t('import.success')))
                .catch(error => alert(t('import.failed', { message: error.message })));
            }
          } catch (error) {
            alert(t('import.parseFailed', { message: error.message }));
          } finally {
            pendingJsonImportMode = 'update-current';
          }
        };
        reader.readAsText(file);
        
        // 清空文件输入框，允许重复导入同一文件
        importFileInput.value = '';
      });

      xmlImportFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
          pendingXmlUpdateProjectId = null;
          pendingXmlImportMode = 'update-current';
          return;
        }
        if (pendingXmlUpdateProjectId) {
          const projectId = pendingXmlUpdateProjectId;
          pendingXmlUpdateProjectId = null;
          pendingXmlImportMode = 'update-current';
          uploadXmlUpdate(file, projectId)
            .then(() => alert(t('projects.xmlUpdateSuccess')))
            .catch(error => {
              setSaveStatusKey('idle', 'projects.choose');
              alert(t('projects.xmlUpdateFailed', { message: error.message }));
            });
          xmlImportFileInput.value = '';
          return;
        }
        if (pendingXmlImportMode !== 'create') {
          pendingXmlImportMode = 'update-current';
          xmlImportFileInput.value = '';
          return;
        }
        const defaultName = file.name.replace(/\.xml$/i, '') || t('import.defaultProject');
        const name = prompt(t('projects.promptImportName'), defaultName);
        if (!name || !name.trim()) {
          pendingXmlImportMode = 'update-current';
          xmlImportFileInput.value = '';
          return;
        }
        uploadXmlImport(file, name.trim())
          .then(() => alert(t('xml.success')))
          .catch(error => {
            setSaveStatusKey('idle', 'projects.choose');
              alert(t('xml.failed', { message: error.message }));
            });
        pendingXmlImportMode = 'update-current';
        xmlImportFileInput.value = '';
      });

      window.MESDesignerApi = {
        t,
        getTags: () => tags,
        getTagTypes: () => tagTypes,
        getLocationGroups: () => locationGroups,
        createLocationGroupId,
        getTypeIndexByName,
        getAllTagsFlattened,
        findTagById,
        findParentTag,
        getDirectEventChildren,
        getEventRecordForTag,
        hasAssignedCoordinates,
        isLocationGrouped,
        setLocationGroupRenderEnabled,
        highlightTagInList,
        showEventEditDialog,
        getCanvasPointFromEvent,
        getAnnotationCanvas: () => annotationCanvas,
        getImageWrapper: () => imageWrapper,
        getZoomLevel: () => zoomLevel,
        hasOpenProject: () => !!currentProjectId,
        hasImage: () => !!annotateImage.src,
        getTagSearchQuery: () => tagSearchQuery,
        registerRenderHook,
        renderAll,
        markProjectDirty
      };

      // ---------- 初始化 ----------
      // Initial render assumes there is no loaded image yet. Upload/import flows
      // call resetView() and renderAll() again after image dimensions are known.
      applyStaticI18n();
      resetProjectData();
      renderAll();
      updateTextVisibility();
      showLoginView();
      checkCurrentSession();
    })();
