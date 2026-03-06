import type { Product } from '../types';

interface DeriveEngineProductGridDataOptions {
  allProducts: Product[];
  selectedCategory: string;
  selectedBrand: string;
  selectedCondition: string;
  minPrice: number;
  maxPrice: number;
  minRating: number;
  limit?: number;
}

export function deriveEngineProductGridData({
  allProducts,
  selectedCategory,
  selectedBrand,
  selectedCondition,
  minPrice,
  maxPrice,
  minRating,
  limit,
}: DeriveEngineProductGridDataOptions) {
  const brandSet = new Set<string>();
  for (const p of allProducts) {
    if (p.brand) {
      brandSet.add(p.brand);
    }
  }
  const brands = Array.from(brandSet);

  const result: Product[] = [];

  for (const p of allProducts) {
    if (limit && limit > 0 && result.length >= limit) {
      break;
    }

    if (
      selectedCategory !== 'All' &&
      p.category?.toLowerCase() !== selectedCategory.toLowerCase()
    ) {
      continue;
    }

    if (selectedBrand !== 'All' && p.brand !== selectedBrand) {
      continue;
    }

    if (selectedCondition !== 'All' && p.condition !== selectedCondition) {
      continue;
    }

    const price = p.rawPrice || 0;
    if (
      (minPrice > 0 && price < minPrice) ||
      (maxPrice < 100000000 && price > maxPrice)
    ) {
      continue;
    }

    if (minRating > 0 && (p.rating || 0) < minRating) {
      continue;
    }

    result.push(p);
  }

  return {
    brands,
    filteredProducts: result,
  };
}
