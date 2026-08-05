import type { QuizPrizeProduct } from '@/schemas/quiz-prize-product';

export interface PrizeProductCursor {
  productOffset: number;
  variantOffset: number;
}

interface PrizeProductPage {
  nextCursor: string | null;
  products: QuizPrizeProduct[];
}

function encodeCursor({
  productOffset,
  variantOffset,
}: PrizeProductCursor): string {
  const diagonal = productOffset + variantOffset;
  return String((diagonal * (diagonal + 1)) / 2 + variantOffset);
}

export function decodePrizeProductCursor(value: string): PrizeProductCursor {
  const encoded = Number(value);
  const diagonal = Math.floor((Math.sqrt(8 * encoded + 1) - 1) / 2);
  const diagonalStart = (diagonal * (diagonal + 1)) / 2;
  const variantOffset = encoded - diagonalStart;

  return {
    productOffset: diagonal - variantOffset,
    variantOffset,
  };
}

export function paginatePrizeProducts(args: {
  groups: QuizPrizeProduct[][];
  hasMoreCandidates: boolean;
  limit: number;
  start: PrizeProductCursor;
}): PrizeProductPage {
  const { groups, hasMoreCandidates, limit, start } = args;
  const products: QuizPrizeProduct[] = [];

  for (const [groupIndex, group] of groups.entries()) {
    const firstItem = groupIndex === 0 ? start.variantOffset : 0;
    for (let itemIndex = firstItem; itemIndex < group.length; itemIndex += 1) {
      products.push(group[itemIndex] as QuizPrizeProduct);
      if (products.length !== limit) continue;

      const hasMoreInGroup = itemIndex + 1 < group.length;
      const hasMoreGroups = groupIndex + 1 < groups.length;
      const nextCursor =
        hasMoreInGroup || hasMoreGroups || hasMoreCandidates
          ? encodeCursor({
              productOffset: start.productOffset + groupIndex,
              variantOffset: hasMoreInGroup ? itemIndex + 1 : 0,
            })
          : null;

      if (nextCursor && !hasMoreInGroup) {
        return {
          nextCursor: encodeCursor({
            productOffset: start.productOffset + groupIndex + 1,
            variantOffset: 0,
          }),
          products,
        };
      }
      return { nextCursor, products };
    }
  }

  return {
    nextCursor: hasMoreCandidates
      ? encodeCursor({
          productOffset: start.productOffset + groups.length,
          variantOffset: 0,
        })
      : null,
    products,
  };
}
