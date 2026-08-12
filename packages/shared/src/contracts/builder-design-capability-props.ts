export type BuilderDesignProp = {
  default?: unknown;
  enum?: string[];
  item?: BuilderDesignItem;
  maximum?: number;
  maximumItems?: number;
  maximumLength?: number;
  minimum?: number;
  minimumItems?: number;
  required?: boolean;
  type: string;
  wholeNumber?: boolean;
};
export type BuilderDesignProps = Record<string, BuilderDesignProp>;
export type BuilderDesignItem = {
  properties: BuilderDesignProps;
  uniqueBy?: string;
};
export type BuilderDesignPlacement = {
  allowedCollections: string[];
  kind: 'content' | 'fixed';
};
export type BuilderDesignCapability = {
  aiEditable: boolean;
  aiInsertable: boolean;
  componentType: string;
  description: string;
  initialProps?: Record<string, unknown>;
  placement: BuilderDesignPlacement;
  protected: boolean;
  props: BuilderDesignProps;
  refused: boolean;
  refusal?: { code: string; message: string };
  renderable: boolean;
  responsiveProps: string[];
  specialOperations?: Record<string, BuilderDesignProps>;
};

export const label = (defaultValue?: string): BuilderDesignProp => ({
  ...(defaultValue === undefined ? {} : { default: defaultValue }),
  maximumLength: 120,
  type: 'string',
});
export const copy = (defaultValue?: string): BuilderDesignProp => ({
  ...(defaultValue === undefined ? {} : { default: defaultValue }),
  maximumLength: 2000,
  type: 'string',
});
export const safeLink: BuilderDesignProp = {
  maximumLength: 512,
  type: 'safe-link',
};
export const fixedPlacement: BuilderDesignPlacement = {
  allowedCollections: [],
  kind: 'fixed',
};
export const contentPlacement: BuilderDesignPlacement = {
  allowedCollections: ['content', 'zones'],
  kind: 'content',
};
export const allow = (
  componentType: string,
  description: string,
  props: BuilderDesignProps,
  aiInsertable = true,
  protectedComponent = false,
  placement: BuilderDesignPlacement = contentPlacement
): BuilderDesignCapability => ({
  aiEditable: true,
  aiInsertable,
  componentType,
  description,
  placement,
  protected: protectedComponent,
  props,
  refused: false,
  renderable: true,
  responsiveProps: [],
});
export const deny = (
  componentType: string,
  description: string,
  code: string,
  message: string
): BuilderDesignCapability => ({
  aiEditable: false,
  aiInsertable: false,
  componentType,
  description,
  placement: fixedPlacement,
  protected: true,
  props: {},
  refused: true,
  refusal: { code, message },
  renderable: true,
  responsiveProps: [],
});

export const headerProps: BuilderDesignProps = {
  ctaButton: {
    item: {
      properties: {
        show: { required: true, type: 'boolean' },
        text: { ...label(), required: true },
        url: { ...safeLink, required: true },
      },
    },
    type: 'object',
  },
  glassEffect: { type: 'boolean' },
  layout: {
    enum: ['logo-left-nav-center', 'logo-left-nav-right', 'logo-center'],
    type: 'enum',
  },
  navigationLinks: {
    item: {
      properties: {
        label: { ...label(), required: true },
        url: { ...safeLink, required: true },
      },
      uniqueBy: 'label',
    },
    maximumItems: 8,
    type: 'array',
  },
  paddingY: { enum: ['sm', 'md', 'lg'], type: 'enum' },
  searchRadius: { enum: ['none', 'sm', 'md', 'full'], type: 'enum' },
  searchStyle: { enum: ['outline', 'filled', 'minimal'], type: 'enum' },
  showCart: { type: 'boolean' },
  showLogo: { type: 'boolean' },
  showMenu: { type: 'boolean' },
  showSearch: { type: 'boolean' },
  sticky: { type: 'boolean' },
};
export const heroProps: BuilderDesignProps = {
  align: { default: 'center', enum: ['center', 'left', 'right'], type: 'enum' },
  ctaLink: { ...safeLink, default: '/products' },
  ctaText: { ...label('Shop now'), required: true },
  overlay: { default: false, type: 'boolean' },
  padding: {
    default: 'medium',
    enum: ['large', 'medium', 'small'],
    type: 'enum',
  },
  subtitle: { ...copy('Discover our collection.'), required: true },
  title: { ...label('Featured collection'), required: true },
};
export const featureList: BuilderDesignProp = {
  default: [{ description: 'Describe this benefit.', title: 'A benefit' }],
  item: {
    properties: {
      description: { ...copy(), required: true },
      icon: { type: 'feature-icon' },
      title: { ...label(), required: true },
    },
    uniqueBy: 'title',
  },
  maximumItems: 8,
  minimumItems: 1,
  type: 'array',
};
export const safeTextProps: BuilderDesignProps = {
  align: { default: 'left', enum: ['center', 'left', 'right'], type: 'enum' },
  content: { ...copy('Add supporting storefront copy here.'), required: true },
  title: { ...label('About us'), required: true },
};
