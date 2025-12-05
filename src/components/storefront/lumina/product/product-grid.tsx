'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/products';
import { LuminaProductGridItem } from './product-grid-item';
import { LuminaProductFilters } from './product-filters';
import { FloatingParticles, type Particle } from '../components/floating-particles';

interface LuminaProductGridProps {
  products: Product[];
  storeSlug?: string;
  title?: string;
  showViewAll?: boolean;
  showFilters?: boolean;
  cartProductIds?: Set<string>;
  wishlistProductIds?: Set<string>;
  onAddToCart?: (e: React.MouseEvent, product: Product) => void;
  onToggleWishlist?: (productId: string) => void;
}

type ViewMode = 'grid' | 'list';

export function LuminaProductGrid({
  products,
  storeSlug = '',
  title = 'Featured Products',
  showViewAll = true,
  showFilters = true,
  cartProductIds = new Set(),
  wishlistProductIds = new Set(),
  onAddToCart,
  onToggleWishlist,
}: LuminaProductGridProps) {
  const baseUrl = storeSlug ? `/storefront/${storeSlug}` : '';

  // Filter & Sort State
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [selectedCondition, setSelectedCondition] = useState<string>('All');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(10000000);
  const [minRating, setMinRating] = useState<number>(0);

  // Floating particles for +1 animation
  const [particles, setParticles] = useState<Particle[]>([]);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  // Handle add to cart with particle animation
  const handleAddToCartWithAnimation = useCallback(
    (e: React.MouseEvent, product: Product) => {
      // Create particle at click position
      const rect = e.currentTarget.getBoundingClientRect();
      const id = Date.now() + Math.random();
      setParticles((prev) => [
        ...prev,
        {
          id,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        },
      ]);

      // Remove particle after animation
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id !== id));
      }, 1000);

      // Show visual feedback on button
      setAddedItems((prev) => new Set(prev).add(product.id));
      setTimeout(() => {
        setAddedItems((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
      }, 2000);

      // Call parent handler
      onAddToCart?.(e, product);
    },
    [onAddToCart]
  );

  // Derive unique categories and brands from products
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    return ['All', ...Array.from(cats)] as string[];
  }, [products]);

  const brands = useMemo(() => {
    const b = new Set(products.map((p) => p.brand).filter(Boolean));
    return Array.from(b) as string[];
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Category filter
    if (selectedCategory !== 'All') {
      result = result.filter((p) => p.category === selectedCategory);
    }

    // Brand filter
    if (selectedBrand !== 'All') {
      result = result.filter((p) => p.brand === selectedBrand);
    }

    // Condition filter
    if (selectedCondition !== 'All') {
      const conditionMap: Record<string, string> = {
        'New': 'new',
        'Used': 'used',
      };
      result = result.filter((p) => p.condition === conditionMap[selectedCondition]);
    }

    // Price filter
    result = result.filter((p) => p.price >= minPrice && p.price <= maxPrice);

    // Rating filter (using schema_markup.aggregateRating if available)
    if (minRating > 0) {
      result = result.filter((p) => {
        const rating = p.schema_markup?.aggregateRating?.ratingValue;
        return rating !== undefined && rating >= minRating;
      });
    }

    return result;
  }, [products, selectedCategory, selectedBrand, selectedCondition, minPrice, maxPrice, minRating]);

  const handlePriceChange = (min: number, max: number) => {
    setMinPrice(min);
    setMaxPrice(max || 10000000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Filters */}
      {showFilters && (
        <LuminaProductFilters
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          minPrice={minPrice}
          maxPrice={maxPrice}
          onPriceChange={handlePriceChange}
          brands={brands}
          selectedBrand={selectedBrand}
          onSelectBrand={setSelectedBrand}
          selectedCondition={selectedCondition}
          onSelectCondition={setSelectedCondition}
          minRating={minRating}
          onSelectRating={setMinRating}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      )}

      {/* Main Content */}
      <section className="max-w-[1400px] mx-auto px-3 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            {title === 'Featured Products' && (
              <span className="text-red-600 font-bold uppercase tracking-wider text-xs md:text-sm">
                Best Sellers
              </span>
            )}
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 mt-1">{title}</h2>
          </div>

          <div className="flex items-center gap-4">
            {showViewAll && (
              <Link
                href={`${baseUrl}/products` as Route}
                className="text-gray-500 hover:text-red-600 font-medium transition-colors text-xs md:text-base hidden sm:block"
              >
                View all products
              </Link>
            )}
          </div>
        </div>

        {/* Product Grid/List */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-500 text-lg">No products found matching your filters.</p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSelectedBrand('All');
                setSelectedCondition('All');
                setMinPrice(0);
                setMaxPrice(10000000);
                setMinRating(0);
              }}
              className="mt-4 text-red-600 font-semibold hover:underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div
            className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6'
                : 'flex flex-col gap-3 md:gap-4'
            )}
          >
            {filteredProducts.map((product) => (
              <LuminaProductGridItem
                key={product.id}
                product={product}
                storeSlug={storeSlug}
                viewMode={viewMode}
                isAdded={cartProductIds.has(product.id) || addedItems.has(product.id)}
                isWishlisted={wishlistProductIds.has(product.id)}
                onAddToCart={handleAddToCartWithAnimation}
                onToggleWishlist={() => onToggleWishlist?.(product.id)}
              />
            ))}
          </div>
        )}

        {/* Results Count */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Showing {filteredProducts.length} of {products.length} products
        </div>
      </section>

      {/* Floating Particles for +1 animation */}
      <FloatingParticles particles={particles} />
    </div>
  );
}
