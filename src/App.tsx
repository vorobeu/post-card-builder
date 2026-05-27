import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileArchive, ImagePlus, Trash2, Type } from 'lucide-react';
import { drawPreview, renderCard } from './render';
import { makeZip } from './zip';
import type { CardItem, CropSettings, TemplateId } from './types';
import { templates } from './types';

const defaultCrop: CropSettings = { scale: 1, offsetX: 0, offsetY: 0 };

export function App() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCard = useMemo(() => cards.find((card) => card.id === activeId) ?? cards[0], [activeId, cards]);

  useEffect(() => {
    if (!activeId && cards.length) setActiveId(cards[0].id);
  }, [activeId, cards]);

  useEffect(() => {
    return () => cards.forEach((card) => URL.revokeObjectURL(card.imageUrl));
  }, [cards]);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;

    const nextCards = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      imageUrl: URL.createObjectURL(file),
      templateId: 'no-title' as TemplateId,
      title: '',
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

  function removeCard(id: string) {
    const card = cards.find((item) => item.id === id);
    if (card) URL.revokeObjectURL(card.imageUrl);
    const rest = cards.filter((item) => item.id !== id);
    setCards(rest);
    setActiveId(rest[0]?.id ?? null);
  }

  async function exportOne(card: CardItem) {
    const template = templates.find((item) => item.id === card.templateId)!;
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
        const template = templates.find((item) => item.id === card.templateId)!;
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
            <p>Загрузите фотографии, выберите шаблон для каждой и экспортируйте PNG 1000x1000.</p>
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

        {cards.length ? (
          <div className="editorGrid">
            <aside className="cardList" aria-label="Загруженные фотографии">
              {cards.map((card, index) => (
                <button
                  key={card.id}
                  className={`listItem ${activeCard?.id === card.id ? 'active' : ''}`}
                  onClick={() => setActiveId(card.id)}
                >
                  <Preview card={card} compact />
                  <span>
                    <strong>Карточка {index + 1}</strong>
                    <small>{templates.find((template) => template.id === card.templateId)?.label}</small>
                  </span>
                </button>
              ))}
            </aside>

            {activeCard && (
              <section className="canvasPanel">
                <Preview card={activeCard} />
              </section>
            )}

            {activeCard && (
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

                <label className="field">
                  <span>Шаблон</span>
                  <div className="segmented">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        className={activeCard.templateId === template.id ? 'selected' : ''}
                        onClick={() => updateCard(activeCard.id, { templateId: template.id })}
                      >
                        {template.hasTitle && <Type size={15} />}
                        {template.label}
                      </button>
                    ))}
                  </div>
                </label>

                {templates.find((template) => template.id === activeCard.templateId)?.hasTitle && (
                  <label className="field">
                    <span>Заголовок</span>
                    <textarea
                      rows={3}
                      value={activeCard.title}
                      placeholder="СКОРО ЦЕЛИНА&#10;А ТЫ ГОТОВ?"
                      onChange={(event) => updateCard(activeCard.id, { title: event.target.value })}
                    />
                  </label>
                )}

                <div className="field">
                  <span>Кадрирование</span>
                  <div className="rangeField">
                    <span>Масштаб</span>
                    <div className="rangeControl">
                      <input
                        type="range"
                        min="1"
                        max="2.2"
                        step="0.01"
                        value={activeCard.crop.scale}
                        onChange={(event) => updateCrop(activeCard.id, { scale: Number(event.target.value) })}
                      />
                      <label className="numberField">
                        <input
                          type="number"
                          min="100"
                          max="220"
                          step="1"
                          value={Math.round(activeCard.crop.scale * 100)}
                          onChange={(event) =>
                            updateCrop(activeCard.id, { scale: clamp(Number(event.target.value), 100, 220) / 100 })
                          }
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
                        value={activeCard.crop.offsetX}
                        onChange={(event) => updateCrop(activeCard.id, { offsetX: Number(event.target.value) })}
                      />
                      <label className="numberField">
                        <input
                          type="number"
                          min="-420"
                          max="420"
                          step="1"
                          value={Math.round(activeCard.crop.offsetX)}
                          onChange={(event) =>
                            updateCrop(activeCard.id, { offsetX: clamp(Number(event.target.value), -420, 420) })
                          }
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
                        value={activeCard.crop.offsetY}
                        onChange={(event) => updateCrop(activeCard.id, { offsetY: Number(event.target.value) })}
                      />
                      <label className="numberField">
                        <input
                          type="number"
                          min="-420"
                          max="420"
                          step="1"
                          value={Math.round(activeCard.crop.offsetY)}
                          onChange={(event) =>
                            updateCrop(activeCard.id, { offsetY: clamp(Number(event.target.value), -420, 420) })
                          }
                        />
                        <span>px</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="controlActions">
                  <button className="button secondary" onClick={() => updateCrop(activeCard.id, defaultCrop)}>
                    Сбросить кадр
                  </button>
                  <button className="button primary" onClick={() => exportOne(activeCard)}>
                    <Download size={18} />
                    Скачать PNG
                  </button>
                </div>
              </aside>
            )}
          </div>
        ) : (
          <section className="emptyState">
            <button className="uploadDrop" onClick={() => fileInputRef.current?.click()}>
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

function Preview({ card, compact = false }: { card: CardItem; compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const template = templates.find((item) => item.id === card.templateId)!;

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
  return name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'card';
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
