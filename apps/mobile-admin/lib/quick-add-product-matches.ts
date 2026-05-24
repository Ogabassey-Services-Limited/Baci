import type { SelectableOrderProduct } from '@/components/orders/new-order.types';
import { normalizeComparableProductName } from '@/lib/product-matching';

const PRICE_DISTANCE_FLOOR = 5000;
const PRICE_DISTANCE_RATIO = 0.15;
const EXACT_NAME_SCORE = 100;
const VARIANT_PRICE_BASE_SCORE = 90;
const VARIANT_PRICE_DISTANCE_DIVISOR = 1000;
const VARIANT_PRICE_MIN_TOKEN_OVERLAP = 2;
const TOKEN_MATCH_BASE_SCORE = 70;
const TOKEN_MATCH_MAX_REQUIRED = 3;
const MAX_QUICK_ADD_MATCH_RESULTS = 5;
const MATCH_REASON_EXACT_NAME = 'exact-name';
const MATCH_REASON_VARIANT_AND_PRICE = 'variant-and-price';
const MATCH_REASON_TOKEN_MATCH = 'token-match';

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
	        priceDistance <=
	          Math.max(PRICE_DISTANCE_FLOOR, quickAddPrice * PRICE_DISTANCE_RATIO);

	      if (normalizedProduct === normalizedQuery) {
	        return {
	          ...product,
	          matchReason: MATCH_REASON_EXACT_NAME,
	          score: EXACT_NAME_SCORE,
	        };
	      }

	      if (
	        product.parent_product_id &&
	        tokenOverlap >= VARIANT_PRICE_MIN_TOKEN_OVERLAP &&
	        isPriceClose
	      ) {
	        return {
	          ...product,
	          matchReason: MATCH_REASON_VARIANT_AND_PRICE,
	          score:
	            VARIANT_PRICE_BASE_SCORE -
	            priceDistance / VARIANT_PRICE_DISTANCE_DIVISOR,
	        };
	      }

	      if (
	        tokenOverlap >= Math.min(TOKEN_MATCH_MAX_REQUIRED, queryTokens.length)
	      ) {
	        return {
	          ...product,
	          matchReason: MATCH_REASON_TOKEN_MATCH,
	          score: TOKEN_MATCH_BASE_SCORE + tokenOverlap,
	        };
	      }

      return null;
	    })
	    .filter((match): match is QuickAddProductMatch => match !== null)
	    .sort((a, b) => b.score - a.score)
	    .slice(0, MAX_QUICK_ADD_MATCH_RESULTS);
	}
