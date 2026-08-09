import { builderDesignCapabilities } from '@baci/shared/contracts';

export type ComponentDefinition = {
  defaults?: Record<string, unknown>;
  editableProps: readonly string[];
  insertable?: boolean;
  protected?: boolean;
};

const legacyAiEditableComponents = {
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

const manifestAiEditableComponents = Object.fromEntries(
  builderDesignCapabilities.components
    .filter(
      ({ aiEditable, componentType }) =>
        aiEditable && !Object.hasOwn(legacyAiEditableComponents, componentType)
    )
    .map((capability) => {
      const defaults = Object.fromEntries(
        Object.entries(capability.props).flatMap(([property, descriptor]) =>
          descriptor.default === undefined
            ? []
            : [[property, descriptor.default]]
        )
      );
      return [
        capability.componentType,
        {
          ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
          editableProps: Object.keys(capability.props),
          insertable: capability.aiInsertable,
          protected: capability.protected,
        },
      ];
    })
) as Record<string, ComponentDefinition>;

export const aiEditableComponents = {
  ...legacyAiEditableComponents,
  ...manifestAiEditableComponents,
} as const satisfies Record<string, ComponentDefinition>;

export type AiEditableComponentType = keyof typeof aiEditableComponents;
