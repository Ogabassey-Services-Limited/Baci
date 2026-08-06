import { builderAiFeatureIconNames } from '@baci/shared/contracts';

export type ComponentDefinition = {
  editableProps: readonly string[];
  insertable?: boolean;
  protected?: boolean;
  defaults?: Record<string, unknown>;
};

export const aiEditableComponents = {
  Features: {
    defaults: {
      columns: 3,
      features: [{ description: 'Describe this benefit.', title: 'A benefit' }],
      title: 'Why choose us',
    },
    editableProps: ['title', 'subtitle', 'columns', 'features'],
    insertable: true,
  },
  Footer: {
    editableProps: [
      'copyrightText',
      'quickLinks',
      'showNewsletter',
      'showQuickLinks',
    ],
    protected: true,
  },
  Header: {
    editableProps: [
      'ctaButton',
      'glassEffect',
      'layout',
      'navigationLinks',
      'paddingY',
      'searchRadius',
      'searchStyle',
      'showCart',
      'showLogo',
      'showMenu',
      'showSearch',
      'sticky',
    ],
    protected: true,
  },
  Hero: {
    defaults: {
      align: 'center',
      ctaLink: '/products',
      ctaText: 'Shop now',
      headingLevel: 'h2',
      overlay: false,
      padding: 'medium',
      subtitle: 'Discover our collection.',
      title: 'Featured collection',
    },
    editableProps: [
      'align',
      'ctaLink',
      'ctaText',
      'overlay',
      'padding',
      'subtitle',
      'title',
    ],
    insertable: true,
  },
  HeroCarousel: { editableProps: [] },
  Newsletter: {
    defaults: {
      buttonText: 'Subscribe',
      description: 'Sign up for updates from this store.',
      placeholder: 'Enter your email',
      title: 'Newsletter signup',
    },
    editableProps: ['buttonText', 'description', 'placeholder', 'title'],
    insertable: true,
  },
  ProductGrid: {
    defaults: {
      columns: 3,
      limit: 6,
      showFilters: true,
      title: 'Featured products',
    },
    editableProps: ['columns', 'limit', 'showFilters', 'title'],
    insertable: true,
  },
  Testimonial: {
    defaults: {
      author: 'Name',
      quote: 'Add a customer quote.',
      rating: 0,
      role: 'Role',
    },
    editableProps: ['author', 'quote', 'rating', 'role'],
    insertable: true,
  },
  Text: {
    defaults: {
      align: 'left',
      content: 'Add supporting storefront copy here.',
      title: 'About us',
    },
    editableProps: ['align', 'content', 'title'],
    insertable: true,
  },
} as const satisfies Record<string, ComponentDefinition>;

export type AiEditableComponentType = keyof typeof aiEditableComponents;
export type BuilderAiPropShape =
  | 'feature-list'
  | 'link'
  | 'link-list'
  | 'primitive'
  | 'url';

const structuredPropShapes: Record<
  string,
  Record<string, BuilderAiPropShape>
> = {
  Features: { features: 'feature-list' },
  Footer: { quickLinks: 'link-list' },
  Header: { ctaButton: 'link', navigationLinks: 'link-list' },
  Hero: { ctaLink: 'url' },
};

const booleanProps = new Set([
  'Footer.showNewsletter',
  'Footer.showQuickLinks',
  'Header.glassEffect',
  'Header.showCart',
  'Header.showLogo',
  'Header.showMenu',
  'Header.showSearch',
  'Header.sticky',
  'Hero.overlay',
  'ProductGrid.showFilters',
]);
const stringProps = new Set([
  'Features.subtitle',
  'Features.title',
  'Footer.copyrightText',
  'Hero.ctaText',
  'Hero.subtitle',
  'Hero.title',
  'Newsletter.buttonText',
  'Newsletter.description',
  'Newsletter.placeholder',
  'Newsletter.title',
  'ProductGrid.title',
  'Testimonial.author',
  'Testimonial.quote',
  'Testimonial.role',
  'Text.content',
  'Text.title',
]);
const enumProps: Record<string, readonly string[]> = {
  'Header.layout': [
    'logo-left-nav-center',
    'logo-left-nav-right',
    'logo-center',
  ],
  'Header.paddingY': ['sm', 'md', 'lg'],
  'Header.searchRadius': ['none', 'sm', 'md', 'full'],
  'Header.searchStyle': ['outline', 'filled', 'minimal'],
  'Hero.align': ['center', 'left', 'right'],
  'Hero.padding': ['large', 'medium', 'small'],
  'Text.align': ['center', 'left', 'right'],
};
const numberRanges: Record<string, readonly [number, number, boolean?]> = {
  'Features.columns': [2, 4, true],
  'ProductGrid.columns': [1, 4, true],
  'ProductGrid.limit': [1, 24, true],
  'Testimonial.rating': [0, 5, true],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function definitionFor(
  componentType: AiEditableComponentType
): ComponentDefinition {
  return aiEditableComponents[componentType];
}

export function isAiEditableComponent(
  componentType: string
): componentType is AiEditableComponentType {
  return Object.hasOwn(aiEditableComponents, componentType);
}

export function isAiInsertableComponent(
  componentType: string
): componentType is AiEditableComponentType {
  return (
    isAiEditableComponent(componentType) &&
    definitionFor(componentType).insertable === true
  );
}

export function isProtectedAiComponent(componentType: string): boolean {
  return (
    isAiEditableComponent(componentType) &&
    definitionFor(componentType).protected === true
  );
}

export function getBuilderAiPropShape(
  componentType: string,
  property: string
): BuilderAiPropShape | undefined {
  if (!isAiEditableComponent(componentType)) return undefined;
  if (!definitionFor(componentType).editableProps.includes(property)) {
    return undefined;
  }
  return structuredPropShapes[componentType]?.[property] ?? 'primitive';
}

export function isBuilderAiPropValue(
  componentType: string,
  property: string,
  value: unknown
): boolean {
  const key = `${componentType}.${property}`;
  if (booleanProps.has(key)) return typeof value === 'boolean';
  if (stringProps.has(key)) return typeof value === 'string';
  if (enumProps[key])
    return typeof value === 'string' && enumProps[key].includes(value);
  const range = numberRanges[key];
  if (range) {
    return (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= range[0] &&
      value <= range[1] &&
      (!range[2] || Number.isInteger(value))
    );
  }
  if (key === 'Features.features') {
    return (
      Array.isArray(value) &&
      value.every(
        (feature) =>
          isRecord(feature) &&
          (feature.icon === undefined ||
            builderAiFeatureIconNames.some((icon) => icon === feature.icon))
      )
    );
  }
  return getBuilderAiPropShape(componentType, property) !== 'primitive';
}

export function getBuilderAiCatalogProjection() {
  return Object.keys(aiEditableComponents).map((componentType) => {
    const definition = definitionFor(componentType as AiEditableComponentType);
    return {
      componentType,
      editableProps: definition.editableProps.map((property) => {
        const key = `${componentType}.${property}`;
        const allowedValues = enumProps[key];
        const range = numberRanges[key];
        return {
          name: property,
          shape: getBuilderAiPropShape(componentType, property),
          ...(allowedValues ? { allowedValues } : {}),
          ...(range
            ? {
                maximum: range[1],
                minimum: range[0],
                wholeNumber: range[2] === true,
              }
            : {}),
        };
      }),
      insertable: definition.insertable === true,
      protected: definition.protected === true,
    };
  });
}

export function createInsertableComponentProps(
  componentType: string,
  patch: Record<string, unknown>
): Record<string, unknown> {
  if (!isAiInsertableComponent(componentType)) {
    throw new Error(`Unsupported insertable component: ${componentType}`);
  }
  const definition = definitionFor(componentType);
  const props = { ...definition.defaults };

  for (const property of definition.editableProps) {
    if (patch[property] !== undefined) props[property] = patch[property];
  }
  return props;
}
