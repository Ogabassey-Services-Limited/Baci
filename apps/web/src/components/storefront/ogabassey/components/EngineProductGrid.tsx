/**
 * Product Grid with instant client-side filtering
 * - All products loaded via SSR
 * - All filtering is purely client-side for instant response
 */

'use client';

import type { Route } from 'next';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { prioritizeSmartphoneProducts } from '@baci/shared';
import { useCart } from '@/hooks/use-cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import type { Product as BaciProduct } from '@/lib/products';
import { products as mockProducts } from '../data/products';
import { useV2Saved } from '../providers/v2-saved-context';
import type { Product } from '../types';
import { AdUnit } from './AdUnit';
import { AdvancedProductFilters } from './AdvancedProductFilters';
import { FloatingParticles, type Particle } from './FloatingParticles';
import { ProductGridItem } from './ProductGridItem';
import { ProductListItem } from './ProductListItem';

type ConditionLabel = 'New' | 'Used' | 'Open Box' | 'New & Used';

const CONDITION_LABELS: Record<string, ConditionLabel> = {
  open_box: 'Open Box',
  new: 'New',
  used: 'Used',
};

const mapCondition = (condition?: string): ConditionLabel => {
  return CONDITION_LABELS[condition || ''] || 'New';
};

function toTemplateProducts(baciProducts: BaciProduct[]): Product[] {
  return baciProducts.map((p) => {
    const formattedPrice = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(p.price);

    const mapImage = (img: any): string => {
      if (!img) return '';
      if (typeof img === 'string') return img;
      return img.url || '';
    };

    // PERFORMANCE OPTIMIZATION: Avoid intermediate array allocations (.map().filter())
    const images: string[] = [];
    if (p.images) {
      for (const img of p.images) {
        const mapped = mapImage(img);
        if (mapped) images.push(mapped);
      }
    }
    const mainImage = p.image || images[0];
    const condition: ConditionLabel = p.has_condition_offers
      ? 'New & Used'
      : mapCondition(p.condition);

    const rawCategories = p.categories;
    const categoryObj = Array.isArray(rawCategories) ? rawCategories[0] : rawCategories;

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: formattedPrice,
      rawPrice: p.price,
      image: mainImage,
      description: p.description,
      rating: p.rating ?? 4.5,
      category: categoryObj?.name || p.category || 'General',
      category_id: p.category_id,
      categories: categoryObj,
      categorySlug: categoryObj?.slug || p.category_slug,
      condition,
      brand: p.brand,
      colors: p.colors,
      storage: p.storage_options?.[0],
      images,
    };
  });
}

interface EngineProductGridProps {
  storeSlug?: string;
  useMockData?: boolean;
  externalProducts?: BaciProduct[];
  categories?: { name: string; slug: string }[];
  title?: string;
  showViewAll?: boolean;
  limit?: number;
}

export const EngineProductGrid: React.FC<EngineProductGridProps> = ({
  storeSlug,
  useMockData = false,
  externalProducts,
  categories: externalCategories,
  title = 'Featured Products',
  showViewAll = true,
  limit,
}) => {
  const merchantContext = useMerchantSafe();
  const { addToCart, cart } = useCart();
  const { toggleSaved, isSaved } = useV2Saved();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawBase = merchantContext?.basePath ?? (storeSlug ? `/${storeSlug}` : '');
  const basePath = rawBase === '/' ? '' : rawBase;
  const allProductsHref = `${basePath}/products`;

  // All products from SSR
  const allProducts = (() => {
    if (useMockData) return mockProducts;
    if (externalProducts) return toTemplateProducts(externalProducts);
    return [];
  })();

  // Filter state - always start with 'All' to avoid hydration mismatch
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(100000000);
  const [minRating, setMinRating] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // UI state
  const [addedItems, setAddedItems] = useState<(number | string)[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);

  // Pagination: Load 20 products initially, then more on demand
  const PRODUCTS_PER_PAGE = 20;
  const [displayCount, setDisplayCount] = useState(PRODUCTS_PER_PAGE);

  // Categories from props
  const navCategories = merchantContext?.navigationCategories || [];
  const categoryList = externalCategories || navCategories;
  const categories = ['All', ...categoryList.map(c => c.name)];

  // Brands from all products (not filtered, so brand filter always shows all options)
  // PERFORMANCE OPTIMIZATION: Avoid intermediate array allocations (.map().filter())
  const brands = Array.from(
    (() => {
      const set = new Set<string>();
      for (const p of allProducts) {
        if (p.brand) set.add(p.brand);
      }
      return set;
    })()
  );

  // INSTANT client-side filtering - all filters applied in one computation
  // PERFORMANCE OPTIMIZATION: Replaced O(N*K) chained filters with O(N) single-pass filter + early return
  const filteredProducts = (() => {
    const result = [];

    for (const p of allProducts) {
      // Limit check (Early exit)
      if (limit && limit > 0 && result.length >= limit) {
        break;
      }

      // Category filter
      if (
        selectedCategory !== 'All' &&
        p.category?.toLowerCase() !== selectedCategory.toLowerCase()
      ) {
        continue;
      }

      // Brand filter
      if (selectedBrand !== 'All' && p.brand !== selectedBrand) {
        continue;
      }

      // Condition filter
      if (selectedCondition !== 'All' && p.condition !== selectedCondition) {
        continue;
      }

      // Price filter
      const price = p.rawPrice || 0;
      if ((minPrice > 0 && price < minPrice) || (maxPrice < 100000000 && price > maxPrice)) {
        continue;
      }

      // Rating filter
      if (minRating > 0 && (p.rating || 0) < minRating) {
        continue;
      }

      result.push(p);
    }

    if (selectedCategory === 'All') {
      return prioritizeSmartphoneProducts(result);
    }

    return result;
  })();

  // Update URL when category changes (for sharing/bookmarking)
  const handleCategoryChange = (category: string) => {
    // Save scroll position before state change
    const scrollY = window.scrollY;

    setSelectedCategory(category);
    const newUrl = category === 'All'
      ? pathname
      : `${pathname}?category=${encodeURIComponent(category)}`;
    window.history.replaceState(null, '', newUrl);

    // Restore scroll position after React re-render
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  };

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setSelectedBrand('All');
    setSelectedCondition('All');
    setMinPrice(0);
    setMaxPrice(100000000);
    setMinRating(0);
    setDisplayCount(PRODUCTS_PER_PAGE);
    window.history.replaceState(null, '', pathname);
  };

  // Sync category filter from URL ?category= param on mount/navigation
  // Use case-insensitive match to stay consistent with the product filtering logic
  // Depend on categoryList (props) instead of derived categories array for stable reference
  useEffect(() => {
    const urlCategory = searchParams.get('category');
    if (!urlCategory) return;
    if (urlCategory.toLowerCase() === 'all') {
      setSelectedCategory('All');
      return;
    }
    const match = categoryList.find(
      (c) => c.name.toLowerCase() === urlCategory.toLowerCase()
    );
    if (match) {
      setSelectedCategory(match.name);
    }
  }, [searchParams, categoryList]);

  // Reset pagination when filters change
  React.useEffect(() => {
    setDisplayCount(PRODUCTS_PER_PAGE);
  }, [selectedCategory, selectedBrand, selectedCondition, minPrice, maxPrice, minRating]);

  // Slice filtered products for pagination (unless limit is set by parent)
  const visibleProducts = limit ? filteredProducts : filteredProducts.slice(0, displayCount);
  const hasMoreProducts = !limit && displayCount < filteredProducts.length;

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + PRODUCTS_PER_PAGE);
  };

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product as any, 1);

    const rect = e.currentTarget.getBoundingClientRect();
    const particleId = Date.now() + Math.random();
    setParticles(prev => [...prev, { id: particleId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }]);
    setTimeout(() => setParticles(prev => prev.filter(p => p.id !== particleId)), 1000);

    setAddedItems(prev => [...prev, product.id]);
    setTimeout(() => setAddedItems(prev => prev.filter(id => id !== product.id)), 2000);
  };

  const getCartQuantity = (productId: number | string): number => {
    return cart.find(item => String(item.id) === String(productId))?.quantity || 0;
  };

  // Show skeleton only if no products loaded from SSR
  if (allProducts.length === 0) {
    return (
      <div className="max-w-[1400px] mx-auto px-3 md:px-6 pt-6 md:pt-8 pb-20">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={`skeleton-${i}`} className="bg-gray-200 rounded-xl aspect-square" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <AdvancedProductFilters
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategoryChange}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onPriceChange={(min, max) => { setMinPrice(min); setMaxPrice(max); }}
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

      <section className="max-w-[1400px] mx-auto px-3 md:px-6 py-6 md:py-8 relative">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            {title === 'Featured Products' && (
              <span className="text-red-600 font-bold uppercase tracking-wider text-xs md:text-sm">
                Best Sellers
              </span>
            )}
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 mt-1">{title}</h2>
          </div>
          {showViewAll && (
            <Link href={allProductsHref as Route} className="text-[color:var(--store-foreground)] hover:text-[color:var(--store-primary)] font-medium transition-colors text-xs md:text-base hidden sm:block">
              View all products
            </Link>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-gray-500 text-lg">No products found matching your filters.</p>
            <button onClick={handleResetFilters} className="mt-4 text-red-600 font-semibold hover:underline" type="button">
              Reset Filters
            </button>
          </div>
        ) : (
          <div
            className={viewMode === 'grid'
              ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6'
              : 'flex flex-col gap-3 md:gap-4'}
          >
            {visibleProducts.map((product, index) => {
              const isAdded = addedItems.includes(product.id);
              const isWishlisted = isSaved(String(product.id));

              return (
                <React.Fragment key={product.id}>
                  {viewMode === 'grid' ? (
                    <ProductGridItem
                      product={product}
                      onAddToCart={handleAddToCart}
                      isAdded={isAdded}
                      cartQuantity={getCartQuantity(product.id)}
                      viewMode="grid"
                      isWishlisted={isWishlisted}
                      onToggleWishlist={(e) => { e.preventDefault(); toggleSaved(product); }}
                      storeSlug={storeSlug}
                    />
                  ) : (
                    <>
                      <div className="block md:hidden">
                        <ProductGridItem
                          product={product}
                          onAddToCart={handleAddToCart}
                          isAdded={isAdded}
                          cartQuantity={getCartQuantity(product.id)}
                          viewMode="list"
                          isWishlisted={isWishlisted}
                          onToggleWishlist={(e) => { e.preventDefault(); toggleSaved(product); }}
                          storeSlug={storeSlug}
                        />
                      </div>
                      <div className="hidden md:block">
                        <ProductListItem
                          product={product}
                          onAddToCart={handleAddToCart}
                          isAdded={isAdded}
                          isWishlisted={isWishlisted}
                          onToggleWishlist={(e) => { e.preventDefault(); toggleSaved(product); }}
                          storeSlug={storeSlug}
                        />
                      </div>
                    </>
                  )}

                  {(index + 1 === 4 || index + 1 === 8) && (
                    <div className={`col-span-2 ${viewMode === 'grid' ? 'lg:col-span-4' : 'w-full'} flex items-center justify-center my-2 md:my-4`}>
                      <AdUnit placementKey="PRODUCT_GRID_MPU" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Load More Button */}
        {filteredProducts.length > 0 && hasMoreProducts && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <button
              onClick={handleLoadMore}
              type="button"
              className="px-8 py-3 bg-gray-900 hover:bg-red-600 text-white font-semibold rounded-xl transition-all duration-200 active:scale-95"
            >
              Load More Products
            </button>
            <span className="text-sm text-gray-500">
              Showing {visibleProducts.length} of {filteredProducts.length} products
            </span>
          </div>
        )}

        <FloatingParticles particles={particles} />
      </section>
    </div>
  );
};
