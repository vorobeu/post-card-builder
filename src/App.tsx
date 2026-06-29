import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileArchive, ImagePlus, Trash2, Type } from 'lucide-react';
import { drawPreview, renderCard } from './render';
import { makeZip } from './zip';
import type { CardItem, CropSettings, Template, TemplateCatalog, TemplateGroup } from './types';
import { fallbackCatalog } from './types';

const defaultCrop: CropSettings = { scale: 1, offsetX: 0, offsetY: 0 };

export function App() {
  const [catalog, setCatalog] = useState<TemplateCatalog>(fallbackCatalog);
  const [catalogError, setCatalogError] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(fallbackCatalog.groups[0]?.id ?? '');
  const [cards, setCards] = useState<CardItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allTemplates = useMemo(() => catalog.groups.flatMap((group) => group.templates), [catalog]);
  const selectedGroup = useMemo(
    () => catalog.groups.find((group) => group.id === selectedGroupId) ?? catalog.groups[0],
    [catalog, selectedGroupId],
  );
  const defaultTemplate = useMemo(() => findDefaultTemplate(catalog), [catalog]);
  const activeCard = useMemo(() => cards.find((card) => card.id === activeId) ?? cards[0], [activeId, cards]);
  const activeTemplate = useMemo(
    () => allTemplates.find((template) => template.id === activeCard?.templateId) ?? defaultTemplate,
    [activeCard?.templateId, allTemplates, defaultTemplate],
  );

  useEffect(() => {
    fetch('/templates/templates.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`templates.json: ${response.status}`);
        return response.json();
      })
      .then((json) => {
        const nextCatalog = normalizeCatalog(json);
        setCatalog(nextCatalog);
        setSelectedGroupId(nextCatalog.groups[0]?.id ?? '');
        setCatalogError('');
      })
      .catch(() => {
        setCatalog(fallbackCatalog);
        setSelectedGroupId(fallbackCatalog.groups[0]?.id ?? '');
        setCatalogError('Каталог templates.json не загрузился, используется встроенный набор.');
      });
  }, []);

  useEffect(() => {
    if (!activeId && cards.length) setActiveId(cards[0].id);
  }, [activeId, cards]);

  useEffect(() => {
    return () => cards.forEach((card) => URL.revokeObjectURL(card.imageUrl));
  }, [cards]);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'));
    if (!files.length || !defaultTemplate) return;

    const nextCards = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      imageUrl: URL.createObjectURL(file),
      templateId: defaultTemplate.id,
      fieldValues: createFieldValues(defaultTemplate),
      crop: { ...defaultCrop },
    }));

    setCards((current) => [...current, ...nextCards]);
    setActiveId(nextCards[0].id);
    event.target.value = '';
  }

  function updateCard(id: string, patch: Partial<CardItem>) {
    setCards((current) => current.map((card) => (card.id === id ? { ...card, ...patch } : card)));
  }

  function updateCrop(id: string, patch: Partial<CropSettings>) {
    setCards((current) =>
      current.map((card) => (card.id === id ? { ...card, crop: { ...card.crop, ...patch } } : card)),
    );
  }

  function updateField(id: string, name: string, value: string) {
    setCards((current) =>
      current.map((card) =>
        card.id === id ? { ...card, fieldValues: { ...card.fieldValues, [name]: value } } : card,
      ),
    );
  }

  function selectTemplate(card: CardItem, template: Template) {
    updateCard(card.id, {
      templateId: template.id,
      fieldValues: createFieldValues(template, card.fieldValues),
    });
  }

  function removeCard(id: string) {
    const card = cards.find((item) => item.id === id);
    if (card) URL.revokeObjectURL(card.imageUrl);
    const rest = cards.filter((item) => item.id !== id);
    setCards(rest);
    setActiveId(rest[0]?.id ?? null);
  }

  async function exportOne(card: CardItem, template: Template) {
    const blob = await renderCard(card, template);
    downloadBlob(blob, `${safeName(card.file.name)}.png`);
  }

  async function exportAll() {
    if (!cards.length) return;
    setIsExporting(true);
    try {
      const files = [];
      for (let index = 0; index < cards.length; index += 1) {
        const card = cards[index];
        const template = allTemplates.find((item) => item.id === card.templateId) ?? defaultTemplate;
        if (!template) continue;
        files.push({
          name: `${String(index + 1).padStart(2, '0')}-${safeName(card.file.name)}.png`,
          blob: await renderCard(card, template),
        });
      }
      const zip = await makeZip(files);
      downloadBlob(zip, 'cards.zip');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Конструктор карточек</h1>
            <p>Загрузите фотографии, выберите группу и шаблон для каждой карточки, затем скачайте PNG или ZIP.</p>
            {catalogError && <p className="notice">{catalogError}</p>}
          </div>
          <div className="topbarActions">
            <button className="button secondary" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus size={18} />
              Загрузить фото
            </button>
            <button className="button primary" disabled={!cards.length || isExporting} onClick={exportAll}>
              <FileArchive size={18} />
              {isExporting ? 'Собираю...' : 'Скачать ZIP'}
            </button>
            <input ref={fileInputRef} className="hiddenInput" type="file" accept="image/*" multiple onChange={handleFiles} />
          </div>
        </header>

        {cards.length && activeCard && activeTemplate ? (
          <div className="editorGrid">
            <aside className="cardList" aria-label="Загруженные фотографии">
              {cards.map((card, index) => {
                const template = allTemplates.find((item) => item.id === card.templateId) ?? defaultTemplate;
                if (!template) return null;
                return (
                  <button
                    key={card.id}
                    className={`listItem ${activeCard.id === card.id ? 'active' : ''}`}
                    onClick={() => setActiveId(card.id)}
                  >
                    <Preview card={card} template={template} compact />
                    <span>
                      <strong>Карточка {index + 1}</strong>
                      <small>{template.title}</small>
                    </span>
                  </button>
                );
              })}
            </aside>

            <section className="canvasPanel">
              <Preview card={activeCard} template={activeTemplate} />
            </section>

            <aside className="controls">
              <div className="controlHeader">
                <div>
                  <span className="eyebrow">Настройки</span>
                  <h2>{activeCard.file.name}</h2>
                </div>
                <button className="iconButton" title="Удалить карточку" onClick={() => removeCard(activeCard.id)}>
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="field">
                <span>Группа</span>
                <div className="groupTabs">
                  {catalog.groups.map((group) => (
                    <button
                      key={group.id}
                      className={selectedGroup?.id === group.id ? 'selected' : ''}
                      onClick={() => setSelectedGroupId(group.id)}
                    >
                      {group.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span>Шаблон</span>
                <div className="templateGrid">
                  {(selectedGroup?.templates ?? []).map((template) => (
                    <button
                      key={template.id}
                      className={activeTemplate.id === template.id ? 'selected' : ''}
                      onClick={() => selectTemplate(activeCard, template)}
                    >
                      {template.textFields.length > 0 && <Type size={15} />}
                      {template.title}
                    </button>
                  ))}
                </div>
              </div>

              {activeTemplate.textFields.length > 0 && (
                <div className="field">
                  <span>Текстовые поля</span>
                  <div className="textFieldList">
                    {activeTemplate.textFields.map((field) => (
                      <label key={field.name} className="textField">
                        <span>{field.label || field.name}</span>
                        <textarea
                          rows={3}
                          value={activeCard.fieldValues[field.name] ?? ''}
                          placeholder={field.name}
                          onChange={(event) => updateField(activeCard.id, field.name, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="field">
                <span>Кадрирование</span>
                <CropControls card={activeCard} updateCrop={updateCrop} />
              </div>

              <div className="controlActions">
                <button className="button secondary" onClick={() => updateCrop(activeCard.id, defaultCrop)}>
                  Сбросить кадр
                </button>
                <button className="button primary" onClick={() => exportOne(activeCard, activeTemplate)}>
                  <Download size={18} />
                  Скачать PNG
                </button>
              </div>
            </aside>
          </div>
        ) : (
          <section className="emptyState">
            <button className="uploadDrop" onClick={() => fileInputRef.current?.click()} disabled={!defaultTemplate}>
              <ImagePlus size={30} />
              <strong>Загрузить несколько фотографий</strong>
              <span>PNG, JPG или WEBP. После загрузки у каждой карточки появятся отдельные настройки.</span>
            </button>
          </section>
        )}
      </section>
    </main>
  );
}

function CropControls({ card, updateCrop }: { card: CardItem; updateCrop: (id: string, patch: Partial<CropSettings>) => void }) {
  return (
    <>
      <div className="rangeField">
        <span>Масштаб</span>
        <div className="rangeControl">
          <input
            type="range"
            min="1"
            max="2.2"
            step="0.01"
            value={card.crop.scale}
            onChange={(event) => updateCrop(card.id, { scale: Number(event.target.value) })}
          />
          <label className="numberField">
            <input
              type="number"
              min="100"
              max="220"
              step="1"
              value={Math.round(card.crop.scale * 100)}
              onChange={(event) => updateCrop(card.id, { scale: clamp(Number(event.target.value), 100, 220) / 100 })}
            />
            <span>%</span>
          </label>
        </div>
      </div>
      <div className="rangeField">
        <span>Сдвиг по горизонтали</span>
        <div className="rangeControl">
          <input
            type="range"
            min="-420"
            max="420"
            step="1"
            value={card.crop.offsetX}
            onChange={(event) => updateCrop(card.id, { offsetX: Number(event.target.value) })}
          />
          <label className="numberField">
            <input
              type="number"
              min="-420"
              max="420"
              step="1"
              value={Math.round(card.crop.offsetX)}
              onChange={(event) => updateCrop(card.id, { offsetX: clamp(Number(event.target.value), -420, 420) })}
            />
            <span>px</span>
          </label>
        </div>
      </div>
      <div className="rangeField">
        <span>Сдвиг по вертикали</span>
        <div className="rangeControl">
          <input
            type="range"
            min="-420"
            max="420"
            step="1"
            value={card.crop.offsetY}
            onChange={(event) => updateCrop(card.id, { offsetY: Number(event.target.value) })}
          />
          <label className="numberField">
            <input
              type="number"
              min="-420"
              max="420"
              step="1"
              value={Math.round(card.crop.offsetY)}
              onChange={(event) => updateCrop(card.id, { offsetY: clamp(Number(event.target.value), -420, 420) })}
            />
            <span>px</span>
          </label>
        </div>
      </div>
    </>
  );
}

function Preview({ card, template, compact = false }: { card: CardItem; template: Template; compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawPreview(canvas, card, template).then(() => {
      if (cancelled) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      cancelled = true;
    };
  }, [card, template]);

  return <canvas className={compact ? 'preview compact' : 'preview'} ref={canvasRef} aria-label="Предпросмотр карточки" />;
}

function normalizeCatalog(raw: TemplateCatalog): TemplateCatalog {
  if (!raw?.groups?.length) return fallbackCatalog;

  const groups: TemplateGroup[] = raw.groups
    .map((group) => ({
      id: String(group.id || slugify(group.title || 'group')),
      title: String(group.title || group.id || 'Группа'),
      templates: (group.templates ?? [])
        .filter((template) => template.id && template.svgPath)
        .map((template) => ({
          ...template,
          title: template.title || template.id,
          width: Number(template.width || 1000),
          height: Number(template.height || 1000),
          textFields: (template.textFields ?? []).map((field) => ({
            fontWeight: 500,
            label: field.label || field.name,
            ...field,
            align: field.align || 'left',
            color: field.color || '#ffffff',
            maxLines: field.maxLines || 3,
            uppercase: field.uppercase ?? true,
          })),
        })),
    }))
    .filter((group) => group.templates.length > 0);

  return groups.length ? { groups } : fallbackCatalog;
}

function findDefaultTemplate(catalog: TemplateCatalog) {
  const templates = catalog.groups.flatMap((group) => group.templates);
  return templates.find((template) => template.textFields.length === 0) ?? templates[0];
}

function createFieldValues(template: Template, current: Record<string, string> = {}) {
  return Object.fromEntries(template.textFields.map((field) => [field.name, current[field.name] ?? '']));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeName(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'card'
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
