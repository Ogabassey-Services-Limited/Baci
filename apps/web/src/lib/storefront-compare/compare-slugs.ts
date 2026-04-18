import { generateSlug } from '../seo-utils';
import type { ParsedCompareSlug } from './compare-types';

export function buildCanonicalProductCompareSlug(
  left: string,
  right: string
): string {
  return [left, right].sort().join('-vs-');
}

export function buildCanonicalBrandCompareSlug(
  left: string,
  right: string
): string {
  return [generateSlug(left), generateSlug(right)].sort().join('-vs-');
}

export function parseCompareSlug(slug: string): ParsedCompareSlug | null {
  const [leftKey, rightKey, ...rest] = slug.split('-vs-');

  if (!leftKey || !rightKey || rest.length > 0) {
    return null;
  }

  return {
    leftKey,
    rightKey,
    canonicalSlug: [leftKey, rightKey].sort().join('-vs-'),
  };
}
