import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { deriveEngineProductGridData } from './EngineProductGrid.helpers';

const makeProduct = (overrides: Partial<Product>): Product => ({
  id: overrides.id ?? 'product-id',
  name: overrides.name ?? 'Product',
  price: overrides.price ?? 'NGN 0',
  rawPrice: overrides.rawPrice,
  image: overrides.image ?? '/test.jpg',
  description: overrides.description ?? 'Test product',
  rating: overrides.rating,
  category: overrides.category ?? 'Phones',
  condition: overrides.condition ?? 'New',
  brand: overrides.brand,
  images: overrides.images ?? [],
});

const allProducts: Product[] = [
  makeProduct({
    id: '1',
    name: 'Alpha Phone',
    rawPrice: 100,
    rating: 4,
    category: 'Phones',
    condition: 'New',
    brand: 'Apple',
  }),
  makeProduct({
    id: '2',
    name: 'Beta Phone',
    rawPrice: 250,
    rating: 5,
    category: 'Phones',
    condition: 'Used',
    brand: 'Samsung',
  }),
  makeProduct({
    id: '3',
    name: 'Gamma Laptop',
    rawPrice: 500,
    rating: 4,
    category: 'Laptops',
    condition: 'New',
    brand: 'Apple',
  }),
  makeProduct({
    id: '4',
    name: 'Delta Phone',
    rawPrice: 500,
    rating: 4,
    category: 'Phones',
    condition: 'New',
  }),
  makeProduct({
    id: '5',
    name: 'Edge Phone',
    rawPrice: 500,
    rating: 4,
    category: 'Phones',
    condition: 'New',
    brand: 'Apple',
  }),
  makeProduct({
    id: '6',
    name: 'Fallback Phone',
    category: 'Phones',
    condition: 'New',
    brand: 'Zero',
  }),
];

describe('deriveEngineProductGridData', () => {
  it('collects unique brands from all products without the filtering IIFE pattern', () => {
    const { brands } = deriveEngineProductGridData({
      allProducts,
      selectedCategory: 'All',
      selectedBrand: 'All',
      selectedCondition: 'All',
      minPrice: 0,
      maxPrice: 100000000,
      minRating: 0,
    });

    expect(brands).toEqual(['Apple', 'Samsung', 'Zero']);
  });

  it('applies mixed filters in order and stops once the limit is reached', () => {
    const { filteredProducts } = deriveEngineProductGridData({
      allProducts,
      selectedCategory: 'Phones',
      selectedBrand: 'Apple',
      selectedCondition: 'New',
      minPrice: 100,
      maxPrice: 500,
      minRating: 4,
      limit: 2,
    });

    expect(filteredProducts.map((product) => product.name)).toEqual([
      'Alpha Phone',
      'Edge Phone',
    ]);
    expect(filteredProducts).toHaveLength(2);
    expect(filteredProducts.every((product) => product.category === 'Phones')).toBe(
      true
    );
  });

  it('keeps price and rating edge values that exactly match the min and max filters', () => {
    const { filteredProducts } = deriveEngineProductGridData({
      allProducts,
      selectedCategory: 'All',
      selectedBrand: 'All',
      selectedCondition: 'All',
      minPrice: 100,
      maxPrice: 500,
      minRating: 4,
    });

    expect(filteredProducts.map((product) => product.name)).toEqual([
      'Alpha Phone',
      'Beta Phone',
      'Gamma Laptop',
      'Delta Phone',
      'Edge Phone',
    ]);
  });

  it('returns fewer than the limit when fewer products match', () => {
    const { filteredProducts } = deriveEngineProductGridData({
      allProducts,
      selectedCategory: 'Laptops',
      selectedBrand: 'Apple',
      selectedCondition: 'New',
      minPrice: 500,
      maxPrice: 500,
      minRating: 4,
      limit: 2,
    });

    expect(filteredProducts.map((product) => product.name)).toEqual([
      'Gamma Laptop',
    ]);
    expect(filteredProducts).toHaveLength(1);
  });

  it('includes products with missing rawPrice when no price filter is active', () => {
    const { filteredProducts } = deriveEngineProductGridData({
      allProducts,
      selectedCategory: 'All',
      selectedBrand: 'All',
      selectedCondition: 'All',
      minPrice: 0,
      maxPrice: 100000000,
      minRating: 0,
    });

    expect(
      filteredProducts.some((product) => product.name === 'Fallback Phone')
    ).toBe(true);
  });

  it('excludes products with missing rawPrice when minPrice filter is active', () => {
    const { filteredProducts } = deriveEngineProductGridData({
      allProducts,
      selectedCategory: 'All',
      selectedBrand: 'All',
      selectedCondition: 'All',
      minPrice: 1,
      maxPrice: 100000000,
      minRating: 0,
    });

    expect(
      filteredProducts.some((product) => product.name === 'Fallback Phone')
    ).toBe(false);
  });

  it('excludes products with missing rawPrice when maxPrice filter is active', () => {
    const { filteredProducts } = deriveEngineProductGridData({
      allProducts,
      selectedCategory: 'All',
      selectedBrand: 'All',
      selectedCondition: 'All',
      minPrice: 0,
      maxPrice: 1,
      minRating: 0,
    });

    expect(
      filteredProducts.some((product) => product.name === 'Fallback Phone')
    ).toBe(false);
  });

  it('excludes products with missing rating when minRating filter is active', () => {
    const { filteredProducts } = deriveEngineProductGridData({
      allProducts,
      selectedCategory: 'All',
      selectedBrand: 'All',
      selectedCondition: 'All',
      minPrice: 0,
      maxPrice: 100000000,
      minRating: 1,
    });

    expect(
      filteredProducts.some((product) => product.name === 'Fallback Phone')
    ).toBe(false);
  });
});
