import type { CardItem, Template, TextField } from './types';

const CORNER_RADIUS = 34;

const imageCache = new Map<string, HTMLImageElement>();

export async function renderCard(card: CardItem, template: Template): Promise<Blob> {
  await loadExportFont();

  const canvas = document.createElement('canvas');
  canvas.width = template.width;
  canvas.height = template.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas is not supported in this browser.');
  }

  await drawCard(context, card, template);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not export PNG.'));
    }, 'image/png');
  });
}

export async function drawPreview(canvas: HTMLCanvasElement, card: CardItem, template: Template) {
  await loadExportFont();

  canvas.width = template.width;
  canvas.height = template.height;
  const context = canvas.getContext('2d');
  if (!context) return;

  await drawCard(context, card, template);
}

async function drawCard(context: CanvasRenderingContext2D, card: CardItem, template: Template) {
  const photo = await loadImage(card.imageUrl);
  drawRoundedPhoto(context, photo, card.crop, template.width, template.height);

  const overlay = await loadImage(template.svgPath);
  context.drawImage(overlay, 0, 0, template.width, template.height);

  for (const field of template.textFields) {
    const value = card.fieldValues[field.name]?.trim();
    if (value) drawTextField(context, field, value);
  }
}

function drawRoundedPhoto(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  crop: CardItem['crop'],
  canvasWidth: number,
  canvasHeight: number,
) {
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.save();
  roundedRect(context, 0, 0, canvasWidth, canvasHeight, CORNER_RADIUS);
  context.clip();

  const baseScale = Math.max(canvasWidth / image.naturalWidth, canvasHeight / image.naturalHeight);
  const scale = baseScale * crop.scale;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = (canvasWidth - width) / 2 + crop.offsetX;
  const y = (canvasHeight - height) / 2 + crop.offsetY;

  context.drawImage(image, x, y, width, height);
  context.restore();
}

function drawTextField(context: CanvasRenderingContext2D, field: TextField, rawText: string) {
  const text = field.uppercase ? rawText.toUpperCase() : rawText;

  context.save();
  context.translate(field.x, field.y);
  context.rotate((field.rotation * Math.PI) / 180);
  context.fillStyle = field.color || '#ffffff';
  context.font = `${field.fontWeight ?? 500} ${field.fontSize}px "Stolzl Medium", Arial, sans-serif`;
  context.textAlign = field.align;
  context.textBaseline = 'alphabetic';
  context.shadowColor = 'rgba(0, 0, 0, 0.14)';
  context.shadowBlur = 10;
  context.shadowOffsetY = 3;

  const lines = wrapText(context, text, field.width, field.maxLines);
  const startY = -(lines.length - 1) * field.lineHeight;

  lines.forEach((line, index) => {
    context.fillText(line, 0, startY + index * field.lineHeight);
  });
  context.restore();
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const manualLines = text.replace(/\r\n/g, '\n').split('\n');
  const lines: string[] = [];

  for (const manualLine of manualLines) {
    if (lines.length >= maxLines) break;

    const words = manualLine.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      if (lines.length) lines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) lines.push(current);
      current = word;

      if (lines.length === maxLines) break;
    }

    if (current && lines.length < maxLines) {
      lines.push(current);
    }
  }

  const sourceWordCount = text.split(/\s+/).filter(Boolean).length;
  const renderedWordCount = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (renderedWordCount < sourceWordCount && lines.length) {
    ellipsizeLastLine(context, lines, maxWidth);
  }

  return lines;
}

function ellipsizeLastLine(context: CanvasRenderingContext2D, lines: string[], maxWidth: number) {
  let last = lines[lines.length - 1];
  while (last.length > 1 && context.measureText(`${last}...`).width > maxWidth) {
    last = last.slice(0, -1).trimEnd();
  }
  lines[lines.length - 1] = `${last}...`;
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      imageCache.set(src, image);
      resolve(image);
    };
    image.onerror = () => reject(new Error(`Could not load image: ${src}`));
    image.src = src;
  });
}

async function loadExportFont() {
  if (!('fonts' in document)) return;

  try {
    const font = new FontFace('Stolzl Medium', 'url(/fonts/stolzl_medium.otf)', { weight: '500' });
    await font.load();
    document.fonts.add(font);
    await document.fonts.ready;
  } catch {
    await document.fonts.ready;
  }
}
