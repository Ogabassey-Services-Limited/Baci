import { stripHtmlTags } from '@/lib/sanitize-core';
import type { ProductSpecItem, ProductSpecSection } from './spec-data';

const HTML_ENTITY_REPLACEMENTS: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(
      /&(amp|lt|gt|quot|nbsp|#39);/g,
      (match) => HTML_ENTITY_REPLACEMENTS[match] || match
    );
}

function normalizeSpecText(value: string) {
  return decodeHtmlEntities(stripHtmlTags(value)).replace(/\s+/g, ' ').trim();
}

function normalizeSpecTextValue(value: unknown) {
  if (typeof value === 'string') {
    return normalizeSpecText(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function normalizeSpecItems(value: unknown): ProductSpecItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const label = normalizeSpecTextValue(item.label);
    const itemValue = normalizeSpecTextValue(item.value);

    return label && itemValue ? [{ label, value: itemValue }] : [];
  });
}

export function normalizeSpecSections(value: unknown): ProductSpecSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((section) => {
    if (!isRecord(section)) {
      return [];
    }

    const items = normalizeSpecItems(section.items);
    if (items.length === 0) {
      return [];
    }

    return [
      {
        category: normalizeSpecTextValue(section.category) || 'General',
        items,
      },
    ];
  });
}

export function buildDescriptionKeySpecs(
  description?: string | null
): ProductSpecSection[] {
  if (!description?.includes('<table')) {
    return [];
  }

  const keySpecsHeadingIndex = description.search(
    /<h[1-6][^>]*>\s*Key Specs(?: at a Glance)?\s*<\/h[1-6]>/i
  );
  const tableSource =
    keySpecsHeadingIndex >= 0
      ? description.slice(keySpecsHeadingIndex)
      : description;
  const tableMatch = tableSource.match(/<table[\s\S]*?<\/table>/i);

  if (!tableMatch) {
    return [];
  }

  const items = [...tableMatch[0].matchAll(/<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) => {
      const cells = [
        ...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi),
      ]
        .map((cellMatch) => normalizeSpecText(cellMatch[1]))
        .filter(Boolean);

      if (cells.length < 2) {
        return null;
      }

      const [label, value] = cells;
      if (!label || !value || /^(feature|what you get)$/i.test(label)) {
        return null;
      }

      return { label, value };
    })
    .filter((item): item is ProductSpecItem => Boolean(item));

  if (items.length === 0) {
    return [];
  }

  return [{ category: 'Key Specs', items }];
}
