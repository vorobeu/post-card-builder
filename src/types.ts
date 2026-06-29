export type TextAlign = 'left' | 'center' | 'right';

export type TextField = {
  name: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  lineHeight: number;
  rotation: number;
  color: string;
  maxLines: number;
  uppercase: boolean;
  align: TextAlign;
  fontWeight?: number;
};

export type Template = {
  id: string;
  title: string;
  svgPath: string;
  previewPath?: string;
  width: number;
  height: number;
  textFields: TextField[];
};

export type TemplateGroup = {
  id: string;
  title: string;
  templates: Template[];
};

export type TemplateCatalog = {
  groups: TemplateGroup[];
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
  templateId: string;
  fieldValues: Record<string, string>;
  crop: CropSettings;
};

export const fallbackCatalog: TemplateCatalog = {
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
