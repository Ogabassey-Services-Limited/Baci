import type {
  AiStorefrontComponent,
  AiStorefrontLayout,
} from '@/schemas/ai-storefront-layout';
import type { BuilderConfigInput } from '@/schemas/builder';

interface NormalizeAiStorefrontLayoutInput {
  businessName: string;
  layout: AiStorefrontLayout;
  starterConfig: BuilderConfigInput;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function withId<T extends AiStorefrontComponent>(
  component: T,
  index: number
): T {
  return {
    ...component,
    props: {
      ...component.props,
      id: component.props.id || `${component.type.toLowerCase()}-${index + 1}`,
    },
  };
}

function defaultHeader(): AiStorefrontComponent {
  return {
    type: 'Header',
    props: {
      id: 'header',
      showLogo: true,
      showSearch: true,
      showCart: true,
      showMenu: true,
      sticky: true,
      navigationLinks: [
        { label: 'Home', url: '/' },
        { label: 'Shop', url: '/products' },
      ],
      ctaButton: { show: false },
      layout: 'logo-left-nav-center',
      searchStyle: 'outline',
      searchRadius: 'md',
      paddingY: 'md',
      glassEffect: false,
    },
  };
}

function defaultProductGrid(): AiStorefrontComponent {
  return {
    type: 'ProductGrid',
    props: {
      id: 'product-grid',
      title: 'Featured products',
      columns: 3,
      limit: 8,
      sortBy: 'newest',
      showFilters: true,
    },
  };
}

function defaultFooter(businessName: string): AiStorefrontComponent {
  return {
    type: 'Footer',
    props: {
      id: 'footer',
      copyrightText: `(c) ${new Date().getFullYear()} ${businessName}. All rights reserved.`,
      showQuickLinks: true,
      quickLinks: [
        { label: 'About', url: '/about' },
        { label: 'Contact', url: '/contact' },
        { label: 'Terms', url: '/terms' },
      ],
      socialLinks: {},
      showNewsletter: false,
    },
  };
}

function enforceRequiredSections(
  sections: AiStorefrontComponent[],
  businessName: string
): AiStorefrontComponent[] {
  const next = [...sections];

  if (!next.some((section) => section.type === 'Header')) {
    next.unshift(defaultHeader());
  }

  if (!next.some((section) => section.type === 'ProductGrid')) {
    const footerIndex = next.findIndex((section) => section.type === 'Footer');
    if (footerIndex >= 0) {
      next.splice(footerIndex, 0, defaultProductGrid());
    } else {
      next.push(defaultProductGrid());
    }
  }

  if (!next.some((section) => section.type === 'Footer')) {
    next.push(defaultFooter(businessName));
  }

  return next;
}

function dedupeSingletons(
  sections: AiStorefrontComponent[]
): AiStorefrontComponent[] {
  const seen = new Set<string>();

  return sections.filter((section) => {
    if (section.type !== 'Header' && section.type !== 'Footer') return true;
    if (seen.has(section.type)) return false;
    seen.add(section.type);
    return true;
  });
}

export function normalizeAiStorefrontLayout({
  businessName,
  layout,
  starterConfig,
}: NormalizeAiStorefrontLayoutInput): BuilderConfigInput {
  const sections = dedupeSingletons(
    enforceRequiredSections(layout.sections.map(withId), businessName)
  );
  const starterTheme = asRecord(starterConfig.theme);
  const starterThemeColors = asRecord(starterTheme.colors);

  return {
    ...starterConfig,
    root: {
      ...starterConfig.root,
      title: starterConfig.root?.title || 'Home',
    },
    content: sections.map((section) => ({
      type: section.type,
      props: section.props,
    })),
    zones: starterConfig.zones ?? {},
    ...(layout.theme
      ? {
          theme: {
            ...starterTheme,
            colors: {
              ...starterThemeColors,
              primary: layout.theme.primary,
              accent: layout.theme.accent,
              background: layout.theme.background,
            },
          },
        }
      : {}),
  };
}
