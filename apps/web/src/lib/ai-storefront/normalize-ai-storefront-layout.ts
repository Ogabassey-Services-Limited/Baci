import type { AiStorefrontComponent } from '@/schemas/ai-storefront-layout';
import type { BuilderConfigInput } from '@/schemas/builder';
import { normalizeComponent } from './ai-storefront-normalize-component';
import {
  defaultFooter,
  defaultHeader,
  defaultHero,
  defaultProductGrid,
} from './ai-storefront-normalize-defaults';
import {
  asRecord,
  hexColor,
  type ThemeColors,
  text,
} from './ai-storefront-normalize-types';

interface NormalizeAiStorefrontLayoutInput {
  businessName: string;
  layout: unknown;
  starterConfig: BuilderConfigInput;
}

function normalizeTheme(value: unknown): ThemeColors | null {
  const record = asRecord(value);
  const theme = {
    primary: hexColor(record.primary),
    accent: hexColor(record.accent),
    background: hexColor(record.background),
  };
  const entries = Object.entries(theme).filter(
    (entry): entry is [keyof ThemeColors, string] => Boolean(entry[1])
  );

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function normalizeLayout(
  businessName: string,
  layout: unknown
): {
  theme: ThemeColors | null;
  sections: AiStorefrontComponent[];
} {
  const record = asRecord(layout);
  const rawSections = Array.isArray(record.sections) ? record.sections : [];
  const sections = rawSections.flatMap((section, index) => {
    const normalized = normalizeComponent(businessName, section, index);
    return normalized ? [normalized] : [];
  });

  return {
    theme: normalizeTheme(record.theme),
    sections,
  };
}

function insertAfterFirst(
  sections: AiStorefrontComponent[],
  afterType: AiStorefrontComponent['type'],
  section: AiStorefrontComponent
): void {
  const index = sections.findIndex((candidate) => candidate.type === afterType);
  if (index >= 0) {
    sections.splice(index + 1, 0, section);
    return;
  }
  sections.unshift(section);
}

function enforceRequiredSections(
  sections: AiStorefrontComponent[],
  businessName: string
): AiStorefrontComponent[] {
  const next = [...sections];

  if (!next.some((section) => section.type === 'Header')) {
    next.unshift(defaultHeader());
  }

  if (!next.some((section) => section.type === 'Hero')) {
    insertAfterFirst(next, 'Header', defaultHero(businessName));
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

export function getAiStorefrontDesignRationale(layout: unknown): string | null {
  return text(asRecord(layout).designRationale, 500) ?? null;
}

export function normalizeAiStorefrontLayout({
  businessName,
  layout,
  starterConfig,
}: NormalizeAiStorefrontLayoutInput): BuilderConfigInput {
  const normalizedLayout = normalizeLayout(businessName, layout);
  const sections = dedupeSingletons(
    enforceRequiredSections(normalizedLayout.sections, businessName)
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
    ...(normalizedLayout.theme
      ? {
          theme: {
            ...starterTheme,
            colors: {
              ...starterThemeColors,
              ...normalizedLayout.theme,
            },
          },
        }
      : {}),
  };
}
