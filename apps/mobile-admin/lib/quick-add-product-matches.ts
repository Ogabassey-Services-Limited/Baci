import type { SelectableOrderProduct } from '@/components/orders/new-order.types';
import { normalizeComparableProductName } from '@/lib/product-matching';

interface CustomItemDraftForMatch {
  name: string;
  price: string;
}

export interface QuickAddProductMatch extends SelectableOrderProduct {
  matchReason: 'exact-name' | 'variant-and-price' | 'token-match';
  score: number;
}

function parsePrice(value: string) {
  const parsed = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function stringifyMetadata(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  if (Array.isArray(value)) {
    return value.map(stringifyMetadata).join(' ');
  }

  return Object.values(value as Record<string, unknown>)
    .map(stringifyMetadata)
    .join(' ');
}

function tokenize(value: string) {
  return normalizeComparableProductName(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function getSearchableProductName(product: SelectableOrderProduct) {
  return [
    product.name,
    product.sku,
    product.condition,
    stringifyMetadata(product.variant_attributes),
  ]
    .filter(Boolean)
    .join(' ');
}

function getTokenOverlapScore(queryTokens: string[], productName: string) {
  const productTokens = new Set(tokenize(productName));
  return queryTokens.filter((token) => productTokens.has(token)).length;
}

export function findQuickAddProductMatches(args: {
  customItem: CustomItemDraftForMatch;
  products: SelectableOrderProduct[];
}): QuickAddProductMatch[] {
  const normalizedQuery = normalizeComparableProductName(args.customItem.name);
  const queryTokens = tokenize(args.customItem.name);
  const quickAddPrice = parsePrice(args.customItem.price);

  if (!normalizedQuery || queryTokens.length === 0) {
    return [];
  }

  return args.products
    .map((product): QuickAddProductMatch | null => {
      const searchableName = getSearchableProductName(product);
      const normalizedProduct = normalizeComparableProductName(searchableName);
      const tokenOverlap = getTokenOverlapScore(queryTokens, searchableName);
      const priceDistance =
        quickAddPrice == null
          ? Number.POSITIVE_INFINITY
          : Math.abs(product.price - quickAddPrice);
      const isPriceClose =
        quickAddPrice != null &&
        priceDistance <= Math.max(5000, quickAddPrice * 0.15);

      if (normalizedProduct === normalizedQuery) {
        return { ...product, matchReason: 'exact-name', score: 100 };
      }

      if (product.parent_product_id && tokenOverlap >= 2 && isPriceClose) {
        return {
          ...product,
          matchReason: 'variant-and-price',
          score: 90 - priceDistance / 1000,
        };
      }

      if (tokenOverlap >= Math.min(3, queryTokens.length)) {
        return {
          ...product,
          matchReason: 'token-match',
          score: 70 + tokenOverlap,
        };
      }

      return null;
    })
    .filter((match): match is QuickAddProductMatch => match !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
