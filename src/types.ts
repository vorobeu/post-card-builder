export type TemplateId = 'with-title' | 'no-title';

export type Template = {
  id: TemplateId;
  label: string;
  svgPath: string;
  hasTitle: boolean;
};

export type CropSettings = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type CardItem = {
  id: string;
  file: File;
  imageUrl: string;
  templateId: TemplateId;
  title: string;
  crop: CropSettings;
};

export const templates: Template[] = [
  {
    id: 'with-title',
    label: 'С заголовком',
    svgPath: '/templates/template-with-title.svg',
    hasTitle: true,
  },
  {
    id: 'no-title',
    label: 'Без заголовка',
    svgPath: '/templates/template-no-title.svg',
    hasTitle: false,
  },
];
