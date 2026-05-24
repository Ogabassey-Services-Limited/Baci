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
        priceDistance <= Math.max(5000, args.item.price * 0.15);
      const statusBoost = product.status === 'active' ? 10 : 0;

      if (overlap < 2) {
        return null;
      }

      const score = overlap * 20 + statusBoost + (closePrice ? 30 : 0);
      const confidence =
        overlap >= 4 && closePrice
          ? 'high'
          : overlap >= 3 && closePrice
            ? 'medium'
            : 'low';

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
    .slice(0, 5);
}
