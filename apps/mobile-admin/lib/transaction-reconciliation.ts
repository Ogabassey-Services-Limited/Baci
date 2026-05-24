import { normalizeComparableProductName } from '@/lib/product-matching';

export interface ReconciliationItem {
  id: string;
  name: string;
  price: number;
}

export interface ReconciliationProductCandidate {
  name: string;
  parentName: string | null;
  price: number;
  productId: string;
  status: string | null;
  variantId: string | null;
}

export interface RankedReconciliationCandidate {
  confidence: 'high' | 'medium' | 'low';
  label: string;
  price: number;
  productId: string;
  score: number;
  variantId: string | null;
}

const PRICE_DISTANCE_FLOOR = 5000;
const PRICE_DISTANCE_RATIO = 0.15;
const ACTIVE_STATUS_SCORE_BOOST = 10;
const CLOSE_PRICE_SCORE_BONUS = 30;
const RANK_SCORE_PER_TOKEN_OVERLAP = 20;
const MIN_TOKEN_OVERLAP_TO_CONSIDER = 2;
const HIGH_CONFIDENCE_MIN_TOKEN_OVERLAP = 4;
const MEDIUM_CONFIDENCE_MIN_TOKEN_OVERLAP = 3;
const MAX_RECONCILIATION_MATCHES = 5;
const CONFIDENCE_HIGH: RankedReconciliationCandidate['confidence'] = 'high';
const CONFIDENCE_MEDIUM: RankedReconciliationCandidate['confidence'] = 'medium';
const CONFIDENCE_LOW: RankedReconciliationCandidate['confidence'] = 'low';

function tokens(value: string) {
  return normalizeComparableProductName(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function titleCaseStorageLabel(value: string) {
  return value.replace(/\b(\d+)\s*gb\b/gi, '$1GB');
}

function buildCandidateLabel(product: ReconciliationProductCandidate) {
  return titleCaseStorageLabel(
    [product.parentName, product.name].filter(Boolean).join(' ')
  );
}

export function rankReconciliationCandidates(args: {
  item: ReconciliationItem;
  products: ReconciliationProductCandidate[];
}): RankedReconciliationCandidate[] {
  const itemTokens = tokens(args.item.name);

  return args.products
    .map((product): RankedReconciliationCandidate | null => {
      const searchableName = [product.parentName, product.name]
        .filter(Boolean)
        .join(' ');
      const productTokens = new Set(tokens(searchableName));
      const overlap = itemTokens.filter((token) =>
        productTokens.has(token)
      ).length;
	      const priceDistance = Math.abs(args.item.price - product.price);
	      const closePrice =
	        priceDistance <=
	        Math.max(PRICE_DISTANCE_FLOOR, args.item.price * PRICE_DISTANCE_RATIO);
	      const statusBoost =
	        product.status === 'active' ? ACTIVE_STATUS_SCORE_BOOST : 0;

	      if (overlap < MIN_TOKEN_OVERLAP_TO_CONSIDER) {
	        return null;
	      }

	      const score =
	        overlap * RANK_SCORE_PER_TOKEN_OVERLAP +
	        statusBoost +
	        (closePrice ? CLOSE_PRICE_SCORE_BONUS : 0);
	      const confidence =
	        overlap >= HIGH_CONFIDENCE_MIN_TOKEN_OVERLAP && closePrice
	          ? CONFIDENCE_HIGH
	          : overlap >= MEDIUM_CONFIDENCE_MIN_TOKEN_OVERLAP && closePrice
	            ? CONFIDENCE_MEDIUM
	            : CONFIDENCE_LOW;

      return {
        confidence,
        label: buildCandidateLabel(product),
        price: product.price,
        productId: product.productId,
        score,
        variantId: product.variantId,
      };
    })
    .filter(
      (candidate): candidate is RankedReconciliationCandidate =>
        candidate !== null
	    )
	    .sort((a, b) => b.score - a.score)
	    .slice(0, MAX_RECONCILIATION_MATCHES);
	}
