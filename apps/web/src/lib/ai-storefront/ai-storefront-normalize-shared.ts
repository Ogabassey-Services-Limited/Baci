import type {
  FeatureItem,
  IconName,
  Link,
} from './ai-storefront-normalize-types';
import {
  asRecord,
  ICON_NAMES,
  pickLiteral,
  safeHref,
  text,
} from './ai-storefront-normalize-types';

const DEFAULT_CTA_URL = '/products';

export function normalizeLinks(
  value: unknown,
  fallback: Link[],
  maxLength: number
): Link[] {
  if (!Array.isArray(value)) return fallback;

  const links = value.flatMap((item) => {
    const record = asRecord(item);
    const label = text(record.label ?? record.name ?? record.title, 120);
    const url = safeHref(record.url ?? record.href ?? record.link);
    return label && url ? [{ label, url }] : [];
  });

  return links.length > 0 ? links.slice(0, maxLength) : fallback;
}

export function normalizeCtaButton(value: unknown):
  | {
      show: boolean;
      text?: string;
      url?: string;
    }
  | undefined {
  const record = asRecord(value);
  const label = text(
    typeof value === 'string'
      ? value
      : (record.text ?? record.label ?? record.title),
    120
  );
  const url =
    safeHref(record.url ?? record.href ?? record.link) ?? DEFAULT_CTA_URL;
  return label ? { show: true, text: label, url } : undefined;
}

export function normalizeIcon(value: unknown, fallback: IconName): IconName {
  return pickLiteral(value, ICON_NAMES, fallback);
}

/**
 * Normalizes AI-provided selling points while preserving renderer quality.
 * Returns up to `maxLength` normalized items only when at least two survive;
 * otherwise returns `fallback` so two-column/grid sections never render sparse.
 */
export function normalizeFeatureItems(
  value: unknown,
  fallback: FeatureItem[],
  maxLength: number
): FeatureItem[] {
  if (!Array.isArray(value)) return fallback;

  const items = value.flatMap((item) => {
    if (typeof item === 'string') {
      const title = text(item, 120);
      return title
        ? [{ title, description: title, icon: 'check' as const }]
        : [];
    }

    const record = asRecord(item);
    const title = text(record.title ?? record.label ?? record.name, 120);
    const description =
      text(record.description ?? record.subtitle ?? record.text, 240) ?? title;
    if (!title || !description) return [];

    return [
      {
        title,
        description,
        icon: normalizeIcon(record.icon, 'check'),
      },
    ];
  });

  return items.length >= 2 ? items.slice(0, maxLength) : fallback;
}
