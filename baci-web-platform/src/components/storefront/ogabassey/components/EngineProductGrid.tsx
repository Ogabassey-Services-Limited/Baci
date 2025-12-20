/**
 * @fileOverview Engine-Connected Product Grid for Ogabassey V2
 *
 * This component connects to the Baci e-commerce engine and fetches real
 * products from the database. No mock data fallbacks in production.
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
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

/** Product condition display labels */
type ConditionLabel = 'New' | 'Used' | 'Open Box' | 'New & Used';

const CONDITION_LABELS: Record<string, ConditionLabel> = {
  open_box: 'Open Box',
  new: 'New',
  used: 'Used',
};

const mapCondition = (condition?: string): ConditionLabel => {
  return CONDITION_LABELS[condition || ''] || 'New';
};

/**
 * Transform Baci products to template format (inline, no adapter needed)
 */
function toTemplateProducts(baciProducts: BaciProduct[]): Product[] {
  return baciProducts.map((p) => {
    // Format price - prices are stored in Naira (major units), not kobo
    const formattedPrice = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(p.price);

    // Robust image extraction: handle both string URLs and object wrappers (from API vs Raw DB)
    const mapImage = (img: any): string => {
      if (!img) return '';
      if (typeof img === 'string') return img;
      return img.url || '';
    };

    const images = p.images?.map(mapImage).filter(Boolean) || [];
    // Fallback for main image if not explicitly provided
    const mainImage = p.image || images[0];

    // Determine effective condition label
    // If product has multiple condition offers (New + Used), show "New & Used"
    const condition: ConditionLabel = p.has_condition_offers
      ? 'New & Used'
      : mapCondition(p.condition);

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: formattedPrice,
      rawPrice: p.price, // Already in Naira
      image: mainImage,
      description: p.description,
      rating: p.rating ?? 4.5,
      category: (p as any).categories?.name || p.category || 'General',
      category_id: p.category_id,
      categories: (p as any).categories, // Joined category object from Supabase
      categorySlug: p.category_slug,
      condition: condition,
      brand: p.brand,
      colors: p.colors,
      storage: p.storage_options?.[0],
      images: images,
      // Ensure we map any other needed fields
    };
  });
}

interface EngineProductGridProps {
  /** Store slug - if provided, fetches real products */
  storeSlug?: string;
  /** Use mock data for template previews only */
  useMockData?: boolean;
  /** External products to use (from parent component) */
  externalProducts?: BaciProduct[];
  /** Grid title */
  title?: string;
  /** Show view all link */
  showViewAll?: boolean;
  /** Max products to display */
  limit?: number;
}

export const EngineProductGrid: React.FC<EngineProductGridProps> = ({
  storeSlug,
  useMockData = false,
  externalProducts,
  title = 'Featured Products',
  showViewAll = true,
  limit,
}) => {
  const _merchantContext = useMerchantSafe();
  const { addToCart } = useCart();
  const { toggleSaved, isSaved } = useV2Saved();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedItems, setAddedItems] = useState<(number | string)[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);

  // Get filters from URL or default to 'All'
  const selectedCategory = searchParams.get('category') || 'All';
  const selectedBrand = searchParams.get('brand') || 'All';
  const selectedCondition = searchParams.get('condition') || 'All';
  const minPrice = searchParams.get('min_price') ? Number(searchParams.get('min_price')) : 0;
  const maxPrice = searchParams.get('max_price') ? Number(searchParams.get('max_price')) : 100000000;

  const [minRating, setMinRating] = useState(0); // Client-side only
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Helper to update URL with single or multiple params
  const updateFilters = (updates: Record<string, string | number | null>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));

    Object.entries(updates).forEach(([key, value]) => {
      if (value === 'All' || value === null || (value === 0 && key === 'min_price') || (value === 100000000 && key === 'max_price')) {
        current.delete(key);
      } else {
        current.set(key, String(value));
      }
    });

    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.push(`${pathname}${query}` as any, { scroll: false });
  };

  // Fetch products from API or use mock data for template previews
  useEffect(() => {
    async function fetchProducts() {
      // If external products provided, use those (SSR case)
      if (externalProducts) {
        setProducts(toTemplateProducts(externalProducts));
        setLoading(false);
        return;
      }

      // Template preview mode - use mock data
      if (useMockData) {
        setProducts(mockProducts);
        setLoading(false);
        return;
      }

      // No store slug means we can't fetch - show empty state
      if (!storeSlug) {
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // First, get merchant ID from slug (optimized to skip if context has it)
        let merchantId = _merchantContext?.merchant?.id;

        if (!merchantId) {
          const merchantRes = await fetch(`/api/merchants/by-slug?slug=${storeSlug}`);
          if (merchantRes.ok) {
            const merchantData = await merchantRes.json();
            merchantId = merchantData.merchant?.id;
          }
        }

        if (!merchantId) {
          console.warn('No merchant ID found, showing empty state');
          setProducts([]);
          setLoading(false);
          return;
        }

        // Build API URL with filters
        const apiParams = new URLSearchParams();
        apiParams.set('merchant_id', merchantId);

        if (selectedCategory !== 'All') apiParams.set('category', selectedCategory);
        if (selectedBrand !== 'All') apiParams.set('brand', selectedBrand);
        if (selectedCondition !== 'All') apiParams.set('condition', selectedCondition);
        if (minPrice > 0) apiParams.set('min_price', String(minPrice));
        if (maxPrice < 100000000) apiParams.set('max_price', String(maxPrice));

        const response = await fetch(`/api/storefront/products?${apiParams.toString()}`);

        if (!response.ok) throw new Error('Failed to fetch products');

        const data = await response.json();

        if (data.products && Array.isArray(data.products)) {
          // Map products - empty array is valid (no products match filters)
          const mappedProducts = toTemplateProducts(data.products);
          setProducts(mappedProducts);
        } else {
          // API error or unexpected response structure - show empty state, not mock data
          console.warn('Unexpected API response structure, showing empty state');
          setProducts([]);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
        // On error, show empty state instead of mock data in production
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [
    storeSlug,
    useMockData,
    externalProducts,
    _merchantContext?.merchant?.id,
    selectedCategory,
    selectedBrand,
    selectedCondition,
    minPrice,
    maxPrice
  ]);

  // Derive available categories and brands for the sidebar
  // Using products list to populate sidebar (Note: this causes options to shrink as you filter!)
  const categories = useMemo(() => {
    const categorySet = new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)));
    return ['All', ...Array.from(categorySet)];
  }, [products]);

  const brands = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.brand).filter(Boolean) as string[]));
  }, [products]);

  // Apply client-side filters
  const filteredProducts = useMemo(() => {
    let result = products;

    // Filter by Category
    if (selectedCategory && selectedCategory !== 'All') {
      result = result.filter((p) => p.category === selectedCategory);
    }

    // Filter by Brand
    if (selectedBrand && selectedBrand !== 'All') {
      result = result.filter((p) => p.brand === selectedBrand);
    }

    // Filter by Condition
    if (selectedCondition && selectedCondition !== 'All') {
      result = result.filter((p) => p.condition === selectedCondition);
    }

    // Filter by Price
    // Note: minPrice/maxPrice defaults are handled in searchParams logic
    if (minPrice > 0 || maxPrice < 100000000) {
      result = result.filter((p) => {
        const pPrice = p.rawPrice || 0;
        return pPrice >= minPrice && pPrice <= maxPrice;
      });
    }

    if (minRating > 0) {
      result = result.filter((p) => (p.rating || 0) >= minRating);
    }
    // Limit logic
    if (limit && limit > 0) {
      result = result.slice(0, limit);
    }
    return result;
  }, [
    products,
    minRating,
    limit,
    selectedCategory,
    selectedBrand,
    selectedCondition,
    minPrice,
    maxPrice
  ]);

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();

    addToCart(product as any, 1);

    // Particle animation
    const rect = e.currentTarget.getBoundingClientRect();
    const particleId = Date.now() + Math.random();
    setParticles((prev) => [
      ...prev,
      {
        id: particleId,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      },
    ]);

    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== particleId));
    }, 1000);

    // Visual feedback
    setAddedItems((prev) => [...prev, product.id]);
    setTimeout(() => {
      setAddedItems((prev) => prev.filter((id) => id !== product.id));
    }, 2000);
  };

  const handleResetFilters = () => {
    setMinRating(0);
    // Remove all query params except standard ones? Or clear specific ones.
    // simpler: clear known filters.
    updateFilters({
      category: 'All',
      brand: 'All',
      condition: 'All',
      min_price: 0,
      max_price: 100000000
    });
  };

  // Helper to get product ID as string
  const getProductIdString = (id: number | string): string => {
    return String(id);
  };

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-3 md:px-6 pt-6 md:pt-8 pb-20">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="bg-gray-200 rounded-xl aspect-square"
              />
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
        onSelectCategory={(val) => updateFilters({ category: val })}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onPriceChange={(min, max) => updateFilters({ min_price: min, max_price: max })}
        brands={brands}
        selectedBrand={selectedBrand}
        onSelectBrand={(val) => updateFilters({ brand: val })}
        selectedCondition={selectedCondition}
        onSelectCondition={(val) => updateFilters({ condition: val })}
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
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 mt-1">
              {title}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {showViewAll && (
              <a
                href="#"
                className="text-gray-500 hover:text-red-600 font-medium transition-colors text-xs md:text-base hidden sm:block"
              >
                View all products
              </a>
            )}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-gray-500 text-lg">
              No products found matching your filters.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-4 text-red-600 font-semibold hover:underline"
              type="button"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6'
                : 'flex flex-col gap-3 md:gap-4'
            }
          >
            {filteredProducts.map((product, index) => {
              const isAdded = addedItems.includes(product.id);
              const productIdStr = getProductIdString(product.id);
              const isWishlisted = isSaved(productIdStr);

              return (
                <React.Fragment key={product.id}>
                  {viewMode === 'grid' ? (
                    <ProductGridItem
                      product={product}
                      onAddToCart={handleAddToCart}
                      isAdded={isAdded}
                      viewMode="grid"
                      isWishlisted={isWishlisted}
                      onToggleWishlist={(e) => {
                        e.preventDefault();
                        toggleSaved(product as any);
                      }}
                      storeSlug={storeSlug}
                    />
                  ) : (
                    <>
                      <div className="block md:hidden">
                        <ProductGridItem
                          product={product}
                          onAddToCart={handleAddToCart}
                          isAdded={isAdded}
                          viewMode="list"
                          isWishlisted={isWishlisted}
                          onToggleWishlist={(e) => {
                            e.preventDefault();
                            toggleSaved(product as any);
                          }}
                          storeSlug={storeSlug}
                        />
                      </div>
                      <div className="hidden md:block">
                        <ProductListItem
                          product={product}
                          onAddToCart={handleAddToCart}
                          isAdded={isAdded}
                          isWishlisted={isWishlisted}
                          onToggleWishlist={(e) => {
                            e.preventDefault();
                            toggleSaved(product as any);
                          }}
                          storeSlug={storeSlug}
                        />
                      </div>
                    </>
                  )}

                  {/* Ad insertion */}
                  {(index + 1 === 4 || index + 1 === 8) && (
                    <div
                      className={`col-span-2 ${viewMode === 'grid' ? 'lg:col-span-4' : 'w-full'
                        } flex items-center justify-center my-2 md:my-4`}
                    >
                      <AdUnit placementKey="PRODUCT_GRID_MPU" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        <FloatingParticles particles={particles} />
      </section>
    </div>
  );
};
