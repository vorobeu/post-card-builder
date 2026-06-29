const defaultCatalog = {
  groups: [
    {
      id: 'default',
      title: 'Основные шаблоны',
      templates: [
        {
          id: 'with-title',
          title: 'С заголовком',
          svgPath: '/templates/template-with-title.svg',
          width: 1000,
          height: 1000,
          textFields: [
            {
              name: 'zagolovok',
              label: 'Заголовок',
              x: 84,
              y: 938,
              width: 850,
              fontSize: 52,
              lineHeight: 53,
              rotation: 0,
              color: '#ffffff',
              maxLines: 3,
              uppercase: true,
              align: 'left',
              fontWeight: 500,
            },
          ],
        },
        {
          id: 'no-title',
          title: 'Без заголовка',
          svgPath: '/templates/template-no-title.svg',
          width: 1000,
          height: 1000,
          textFields: [],
        },
      ],
    },
  ],
};

let catalog = structuredClone(defaultCatalog);
let activeGroupId = catalog.groups[0].id;
let activeTemplateId = catalog.groups[0].templates[0].id;
let activeFieldName = catalog.groups[0].templates[0].textFields[0]?.name || '';
let zoom = 0.62;
let dragState = null;
const localSvgUrls = new Map();

const els = {
  groupList: document.querySelector('#groupList'),
  templateList: document.querySelector('#templateList'),
  fieldList: document.querySelector('#fieldList'),
  fieldLayer: document.querySelector('#fieldLayer'),
  fieldEditor: document.querySelector('#fieldEditor'),
  svgPreview: document.querySelector('#svgPreview'),
  activeHint: document.querySelector('#activeHint'),
  stage: document.querySelector('#stage'),
  zoom: document.querySelector('#zoom'),
  importJson: document.querySelector('#importJson'),
  exportJson: document.querySelector('#exportJson'),
  addGroup: document.querySelector('#addGroup'),
  addTemplate: document.querySelector('#addTemplate'),
  addField: document.querySelector('#addField'),
  deleteGroup: document.querySelector('#deleteGroup'),
  deleteTemplate: document.querySelector('#deleteTemplate'),
  groupTitle: document.querySelector('#groupTitle'),
  groupId: document.querySelector('#groupId'),
  templateTitle: document.querySelector('#templateTitle'),
  templateId: document.querySelector('#templateId'),
  templateFolder: document.querySelector('#templateFolder'),
  templateSvgFile: document.querySelector('#templateSvgFile'),
  templateSvg: document.querySelector('#templateSvg'),
  templateWidth: document.querySelector('#templateWidth'),
  templateHeight: document.querySelector('#templateHeight'),
};

render();

els.zoom.addEventListener('input', () => {
  zoom = Number(els.zoom.value);
  renderStage();
});

els.addGroup.addEventListener('click', () => {
  const id = uniqueId('group');
  catalog.groups.push({ id, title: 'Новая группа', templates: [] });
  activeGroupId = id;
  activeTemplateId = '';
  activeFieldName = '';
  render();
});

els.addTemplate.addEventListener('click', () => {
  const group = activeGroup();
  if (!group) return;
  const id = uniqueId('template');
  group.templates.push({
    id,
    title: 'Новый шаблон',
    svgPath: '/templates/new-template.svg',
    width: 1000,
    height: 1000,
    textFields: [],
  });
  activeTemplateId = id;
  activeFieldName = '';
  render();
});

els.deleteGroup.addEventListener('click', () => {
  if (catalog.groups.length <= 1) {
    alert('Последнюю группу удалить нельзя.');
    return;
  }

  const group = activeGroup();
  if (!group) return;

  const confirmed = confirm(`Удалить группу "${group.title}" и все ее шаблоны?`);
  if (!confirmed) return;

  catalog.groups = catalog.groups.filter((item) => item.id !== group.id);
  activeGroupId = catalog.groups[0].id;
  activeTemplateId = catalog.groups[0].templates[0]?.id || '';
  activeFieldName = catalog.groups[0].templates[0]?.textFields[0]?.name || '';
  render();
});

els.addField.addEventListener('click', () => {
  const template = activeTemplate();
  if (!template) return;
  const name = uniqueFieldName(template);
  template.textFields.push({
    name,
    label: 'Новое поле',
    x: 100,
    y: 900,
    width: 600,
    fontSize: 52,
    lineHeight: 54,
    rotation: 0,
    color: '#ffffff',
    maxLines: 3,
    uppercase: true,
    align: 'left',
    fontWeight: 500,
  });
  activeFieldName = name;
  render();
});

els.deleteTemplate.addEventListener('click', () => {
  const group = activeGroup();
  if (!group || !activeTemplateId) return;
  group.templates = group.templates.filter((template) => template.id !== activeTemplateId);
  activeTemplateId = group.templates[0]?.id || '';
  activeFieldName = activeTemplate()?.textFields[0]?.name || '';
  render();
});

els.exportJson.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'templates.json';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
});

els.importJson.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const next = JSON.parse(await file.text());
  catalog = normalizeCatalog(next);
  activeGroupId = catalog.groups[0]?.id || '';
  activeTemplateId = catalog.groups[0]?.templates[0]?.id || '';
  activeFieldName = catalog.groups[0]?.templates[0]?.textFields[0]?.name || '';
  event.target.value = '';
  render();
});

els.groupTitle.addEventListener('input', () => {
  const group = activeGroup();
  if (!group) return;
  group.title = els.groupTitle.value;
  renderLists();
});

els.groupId.addEventListener('change', () => {
  const group = activeGroup();
  if (!group) return;
  const nextId = slugify(els.groupId.value) || group.id;
  group.id = nextId;
  activeGroupId = nextId;
  render();
});

els.templateTitle.addEventListener('input', () => {
  const template = activeTemplate();
  if (!template) return;
  template.title = els.templateTitle.value;
  renderLists();
});

els.templateId.addEventListener('change', () => {
  const template = activeTemplate();
  if (!template) return;
  const nextId = slugify(els.templateId.value) || template.id;
  template.id = nextId;
  activeTemplateId = nextId;
  render();
});

els.templateSvg.addEventListener('input', () => {
  const template = activeTemplate();
  if (!template) return;
  template.svgPath = els.templateSvg.value;
  renderStage();
});

els.templateFolder.addEventListener('change', () => {
  const template = activeTemplate();
  if (!template) return;
  const fileName = template.svgPath.split('/').pop() || 'template.svg';
  template.svgPath = buildTemplatePath(els.templateFolder.value, fileName);
  renderInspector();
  renderStage();
});

els.templateSvgFile.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  const template = activeTemplate();
  if (!file || !template) return;

  const folder = els.templateFolder.value || activeGroup()?.id || '';
  template.svgPath = buildTemplatePath(folder, file.name);
  const size = parseSvgSize(await file.text());
  template.width = size.width;
  template.height = size.height;

  const previousUrl = localSvgUrls.get(template.id);
  if (previousUrl) URL.revokeObjectURL(previousUrl);
  localSvgUrls.set(template.id, URL.createObjectURL(file));

  event.target.value = '';
  renderInspector();
  renderStage();
});

els.templateWidth.addEventListener('input', () => {
  const template = activeTemplate();
  if (!template) return;
  template.width = Math.max(1, Number(els.templateWidth.value) || 1000);
  renderStage();
});

els.templateHeight.addEventListener('input', () => {
  const template = activeTemplate();
  if (!template) return;
  template.height = Math.max(1, Number(els.templateHeight.value) || 1000);
  renderStage();
});

function render() {
  renderLists();
  renderInspector();
  renderStage();
}

function renderLists() {
  els.groupList.innerHTML = '';
  catalog.groups.forEach((group) => {
    const button = document.createElement('button');
    button.className = `listItem ${group.id === activeGroupId ? 'active' : ''}`;
    button.innerHTML = `<strong>${escapeHtml(group.title)}</strong><small>${group.templates.length} шабл.</small>`;
    button.addEventListener('click', () => {
      activeGroupId = group.id;
      activeTemplateId = group.templates[0]?.id || '';
      activeFieldName = activeTemplate()?.textFields[0]?.name || '';
      render();
    });
    els.groupList.append(button);
  });

  els.templateList.innerHTML = '';
  (activeGroup()?.templates || []).forEach((template) => {
    const button = document.createElement('button');
    button.className = `listItem ${template.id === activeTemplateId ? 'active' : ''}`;
    button.innerHTML = `<strong>${escapeHtml(template.title)}</strong><small>${template.textFields.length} полей</small>`;
    button.addEventListener('click', () => {
      activeTemplateId = template.id;
      activeFieldName = template.textFields[0]?.name || '';
      render();
    });
    els.templateList.append(button);
  });

  els.fieldList.innerHTML = '';
  (activeTemplate()?.textFields || []).forEach((field) => {
    const button = document.createElement('button');
    button.className = `listItem ${field.name === activeFieldName ? 'active' : ''}`;
    button.innerHTML = `<strong>${escapeHtml(field.label || field.name)}</strong><small>${field.name}</small>`;
    button.addEventListener('click', () => {
      activeFieldName = field.name;
      render();
    });
    els.fieldList.append(button);
  });
}

function renderInspector() {
  const group = activeGroup();
  const template = activeTemplate();
  els.groupTitle.value = group?.title || '';
  els.groupId.value = group?.id || '';
  els.deleteGroup.disabled = catalog.groups.length <= 1;
  els.templateTitle.value = template?.title || '';
  els.templateId.value = template?.id || '';
  els.templateFolder.value = template?.svgPath ? folderFromTemplatePath(template.svgPath) : '';
  els.templateSvg.value = template?.svgPath || '';
  els.templateWidth.value = template?.width || 1000;
  els.templateHeight.value = template?.height || 1000;
  els.activeHint.textContent = template ? `${group.title} / ${template.title}` : 'Выберите шаблон';
  renderFieldEditor();
}

function renderStage() {
  const template = activeTemplate();
  els.stage.style.transform = `scale(${zoom})`;
  els.stage.style.width = `${template?.width || 1000}px`;
  els.stage.style.height = `${template?.height || 1000}px`;
  els.svgPreview.src = template ? localSvgUrls.get(template.id) || previewPath(template.svgPath) : '';
  els.fieldLayer.innerHTML = '';

  (template?.textFields || []).forEach((field) => {
    const box = document.createElement('div');
    box.className = `textBox ${field.name === activeFieldName ? 'active' : ''}`;
    box.style.left = `${field.x}px`;
    box.style.top = `${field.y - field.lineHeight}px`;
    box.style.width = `${field.width}px`;
    box.style.height = `${field.lineHeight}px`;
    box.style.color = field.color;
    box.style.fontSize = `${field.fontSize}px`;
    box.style.textAlign = field.align;
    box.style.transform = `rotate(${field.rotation}deg)`;
    box.textContent = field.label || field.name;
    box.addEventListener('pointerdown', (event) => startDrag(event, field));
    box.addEventListener('click', () => {
      activeFieldName = field.name;
      render();
    });
    els.fieldLayer.append(box);
  });
}

function renderFieldEditor() {
  const template = activeTemplate();
  const field = activeField();
  els.fieldEditor.innerHTML = '';
  if (!template || !field) {
    els.fieldEditor.textContent = 'Выберите или добавьте текстовое поле.';
    return;
  }

  const controls = [
    ['name', 'Имя', 'text'],
    ['label', 'Название', 'text'],
    ['x', 'X', 'number'],
    ['y', 'Y', 'number'],
    ['width', 'Ширина', 'number'],
    ['fontSize', 'Размер', 'number'],
    ['lineHeight', 'Интервал', 'number'],
    ['rotation', 'Угол', 'number'],
    ['color', 'Цвет', 'color'],
    ['maxLines', 'Строк', 'number'],
    ['fontWeight', 'Вес', 'number'],
  ];

  controls.forEach(([key, label, type]) => {
    const wrapper = document.createElement('label');
    wrapper.textContent = label;
    const input = document.createElement('input');
    input.type = type;
    input.value = field[key] ?? '';
    input.addEventListener('input', () => {
      if (type === 'number') field[key] = Number(input.value);
      else field[key] = input.value;
      if (key === 'name') activeFieldName = field.name;
      renderLists();
      renderStage();
    });
    wrapper.append(input);
    els.fieldEditor.append(wrapper);
  });

  const alignLabel = document.createElement('label');
  alignLabel.textContent = 'Выравнивание';
  const align = document.createElement('select');
  ['left', 'center', 'right'].forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    option.selected = field.align === value;
    align.append(option);
  });
  align.addEventListener('change', () => {
    field.align = align.value;
    renderStage();
  });
  alignLabel.append(align);
  els.fieldEditor.append(alignLabel);

  const upperLabel = document.createElement('label');
  upperLabel.textContent = 'Верхний регистр';
  const upper = document.createElement('select');
  [
    ['true', 'Да'],
    ['false', 'Нет'],
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = String(field.uppercase) === value;
    upper.append(option);
  });
  upper.addEventListener('change', () => {
    field.uppercase = upper.value === 'true';
  });
  upperLabel.append(upper);
  els.fieldEditor.append(upperLabel);

  const deleteButton = document.createElement('button');
  deleteButton.className = 'button danger full';
  deleteButton.textContent = 'Удалить поле';
  deleteButton.addEventListener('click', () => {
    template.textFields = template.textFields.filter((item) => item.name !== field.name);
    activeFieldName = template.textFields[0]?.name || '';
    render();
  });
  els.fieldEditor.append(deleteButton);
}

function startDrag(event, field) {
  activeFieldName = field.name;
  const rect = els.stage.getBoundingClientRect();
  dragState = {
    field,
    startX: (event.clientX - rect.left) / zoom,
    startY: (event.clientY - rect.top) / zoom,
    originX: field.x,
    originY: field.y,
  };
  window.addEventListener('pointermove', drag);
  window.addEventListener('pointerup', stopDrag, { once: true });
  render();
}

function drag(event) {
  if (!dragState) return;
  const rect = els.stage.getBoundingClientRect();
  const x = (event.clientX - rect.left) / zoom;
  const y = (event.clientY - rect.top) / zoom;
  dragState.field.x = Math.round(dragState.originX + x - dragState.startX);
  dragState.field.y = Math.round(dragState.originY + y - dragState.startY);
  renderInspector();
  renderStage();
}

function stopDrag() {
  dragState = null;
  window.removeEventListener('pointermove', drag);
}

function activeGroup() {
  return catalog.groups.find((group) => group.id === activeGroupId) || catalog.groups[0];
}

function activeTemplate() {
  return activeGroup()?.templates.find((template) => template.id === activeTemplateId) || activeGroup()?.templates[0];
}

function activeField() {
  return activeTemplate()?.textFields.find((field) => field.name === activeFieldName);
}

function previewPath(path) {
  if (!path) return '';
  if (path.startsWith('/')) return `../public${path}`;
  return path;
}

function normalizeCatalog(raw) {
  if (!raw?.groups?.length) return structuredClone(defaultCatalog);
  return {
    groups: raw.groups.map((group) => ({
      id: group.id || uniqueId('group'),
      title: group.title || 'Группа',
      templates: (group.templates || []).map((template) => ({
        id: template.id || uniqueId('template'),
        title: template.title || 'Шаблон',
        svgPath: template.svgPath || '',
        previewPath: template.previewPath,
        width: Number(template.width || 1000),
        height: Number(template.height || 1000),
        textFields: (template.textFields || []).map((field) => ({
          name: field.name || uniqueFieldName(template),
          label: field.label || field.name || 'Поле',
          x: Number(field.x ?? 100),
          y: Number(field.y ?? 900),
          width: Number(field.width ?? 600),
          fontSize: Number(field.fontSize ?? 52),
          lineHeight: Number(field.lineHeight ?? 54),
          rotation: Number(field.rotation ?? 0),
          color: field.color || '#ffffff',
          maxLines: Number(field.maxLines ?? 3),
          uppercase: field.uppercase ?? true,
          align: field.align || 'left',
          fontWeight: Number(field.fontWeight ?? 500),
        })),
      })),
    })),
  };
}

function uniqueId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildTemplatePath(folder, fileName) {
  const cleanFolder = String(folder || '')
    .trim()
    .replace(/^\/?templates\/?/, '')
    .replace(/^\/+|\/+$/g, '');
  const safeFile = String(fileName || 'template.svg').trim().replace(/^\/+/, '');
  return cleanFolder ? `/templates/${cleanFolder}/${safeFile}` : `/templates/${safeFile}`;
}

function folderFromTemplatePath(path) {
  const parts = String(path || '').replace(/^\/?templates\/?/, '').split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

function parseSvgSize(svgText) {
  const parser = new DOMParser();
  const document = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = document.documentElement;
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const values = viewBox.split(/[\s,]+/).map(Number);
    if (values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) {
      return { width: Math.round(values[2]), height: Math.round(values[3]) };
    }
  }

  const width = parseSvgLength(svg.getAttribute('width'));
  const height = parseSvgLength(svg.getAttribute('height'));
  return {
    width: width || 1000,
    height: height || 1000,
  };
}

function parseSvgLength(value) {
  const number = Number(String(value || '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function uniqueFieldName(template) {
  let index = 1;
  let name = `field_${index}`;
  while (template.textFields?.some((field) => field.name === name)) {
    index += 1;
    name = `field_${index}`;
  }
  return name;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
