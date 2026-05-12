'use client';
// Migrated from temp-source/components/CategoryPage.tsx
import { ChevronRight, Filter, LayoutGrid, List, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useCart } from '@/hooks/cart';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { asRoute } from '@/lib/routes';
import type { CategoryHubModel } from '@/lib/storefront-category/category-hub-types';
import { STOREFRONT_PRODUCTS_PER_PAGE } from '@/lib/storefront-pagination';
import { AdUnit } from '../components/AdUnit';
import { BannerCarousel } from '../components/BannerCarousel';
import {
  CategoryFiltersSidebar,
  type FilterState,
} from '../components/CategoryFiltersSidebar';
import { ProductCard } from '../components/ProductCard';
import { StorefrontPagination } from '../components/StorefrontPagination';
import { CategoryHubSections } from '../seo/category-hub-sections';
import type { Product } from '../types';
import { toRelatedProductsProduct } from './product-details-page/related-product';

export interface CategorySEOProps {
  seoHeading?: string;
  seoDescription?: string;
  seoFeatures?: string[];
  seoFaqs?: { question: string; answer: string }[];
  hubContent?: CategoryHubModel;
  /** Products fetched from Supabase by the server page */
  products?: Product[];
  /** Optional category image URL from database */
  categoryImage?: string | null;
  currentPage?: number;
  itemsPerPage?: number;
}

type CategoryPageColor =
  | string
  | {
      name?: string | null;
    };

function getColorName(color: CategoryPageColor): string | null {
  return typeof color === 'string' ? color : color.name || null;
}

const INITIAL_FILTER_STATE: FilterState = {
  brand: [],
  condition: [],
  storage: [],
  ram: [],
  colors: [],
  simType: [],
  displayType: [],
  displaySize: [],
  minPrice: 0,
  maxPrice: 3000000,
};

export const CategoryPage: React.FC<CategorySEOProps> = ({
  seoHeading,
  seoDescription,
  seoFeatures = [],
  seoFaqs = [],
  hubContent,
  products = [],
  categoryImage,
  currentPage = 1,
  itemsPerPage = STOREFRONT_PRODUCTS_PER_PAGE,
}) => {
  const [_showMobileIntro, _setShowMobileIntro] = useState(false);
  const params = useParams();
  const categoryName = (params?.category || 'All') as string;
  const _router = useRouter();
  const { addToCart } = useCart();
  const [addedItems, setAddedItems] = useState<string[]>([]);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [showDesktopBanner, setShowDesktopBanner] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath ?? '';
  const safeItemsPerPage =
    Number.isInteger(itemsPerPage) && itemsPerPage > 0
      ? itemsPerPage
      : STOREFRONT_PRODUCTS_PER_PAGE;
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTER_STATE);

  // Scroll to top when category changes & Reset filters
  useEffect(() => {
    if (categoryName) {
      window.scrollTo(0, 0);
      setFilters(INITIAL_FILTER_STATE);
    }
  }, [categoryName]); // Add categoryName dependency for proper reset

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const updateBannerVisibility = () => {
      setShowDesktopBanner(mediaQuery.matches);
    };

    updateBannerVisibility();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateBannerVisibility);
      return () => {
        mediaQuery.removeEventListener('change', updateBannerVisibility);
      };
    }

    mediaQuery.addListener(updateBannerVisibility);
    return () => {
      mediaQuery.removeListener(updateBannerVisibility);
    };
  }, []);

  useEffect(() => {
    if (!isMobileFilterOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileFilterOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileFilterOpen]);

  // Derived Data: Products in the current Category (from props)
  const categoryProducts = (() => {
    // Use server-provided products directly - no additional filtering needed
    // since server already filters by category_id or category TEXT field
    return products;
  })();

  // Derived Data: Available Options based on products in category
  const availableOptions = (() => {
    const options = {
      brand: new Set<string>(),
      condition: new Set<string>(),
      storage: new Set<string>(),
      ram: new Set<string>(),
      colors: new Set<string>(),
      simType: new Set<string>(),
      displayType: new Set<string>(),
      displaySize: new Set<string>(),
    };

    categoryProducts.forEach((p) => {
      if (p.brand) options.brand.add(p.brand);
      if (p.condition) options.condition.add(p.condition);
      if (p.storage) {
        if (Array.isArray(p.storage)) {
          p.storage.forEach((s) => {
            options.storage.add(s);
          });
        } else {
          options.storage.add(p.storage);
        }
      }
      if (p.ram) options.ram.add(p.ram);
      if (p.colors) {
        p.colors.forEach((color: CategoryPageColor) => {
          const colorName = getColorName(color);
          if (colorName) {
            options.colors.add(colorName);
          }
        });
      }
      if (p.simType) options.simType.add(p.simType);
      if (p.displayType) options.displayType.add(p.displayType);
      if (p.displaySize) options.displaySize.add(p.displaySize);
    });

    return {
      brand: Array.from(options.brand).sort(),
      condition: Array.from(options.condition).sort(),
      storage: Array.from(options.storage).sort(),
      ram: Array.from(options.ram).sort(),
      colors: Array.from(options.colors).sort(),
      simType: Array.from(options.simType).sort(),
      displayType: Array.from(options.displayType).sort(),
      displaySize: Array.from(options.displaySize).sort(),
    };
  })();

  // Derived Data: Filtered Products based on user selection
  const filteredProducts = (() => {
    return categoryProducts.filter((p) => {
      // Price
      if (
        p.rawPrice &&
        (p.rawPrice < filters.minPrice || p.rawPrice > filters.maxPrice)
      )
        return false;

      // Checkbox Filters (OR logic within category, AND logic between categories)
      if (
        filters.brand.length > 0 &&
        (!p.brand || !filters.brand.includes(p.brand))
      )
        return false;
      if (
        filters.condition.length > 0 &&
        (!p.condition || !filters.condition.includes(p.condition))
      )
        return false;
      if (filters.storage.length > 0) {
        const productStorage = (
          Array.isArray(p.storage) ? p.storage : [p.storage]
        ).filter((s): s is string => !!s);
        if (!productStorage.some((s) => filters.storage.includes(s)))
          return false;
      }
      if (filters.ram.length > 0 && (!p.ram || !filters.ram.includes(p.ram)))
        return false;
      if (
        filters.simType.length > 0 &&
        (!p.simType || !filters.simType.includes(p.simType))
      )
        return false;
      if (
        filters.displayType.length > 0 &&
        (!p.displayType || !filters.displayType.includes(p.displayType))
      )
        return false;
      if (
        filters.displaySize.length > 0 &&
        (!p.displaySize || !filters.displaySize.includes(p.displaySize))
      )
        return false;

      // Colors: If product has ANY of the selected colors
      if (filters.colors.length > 0) {
        if (
          !p.colors?.some((color: CategoryPageColor) => {
            const colorName = getColorName(color);
            return colorName ? filters.colors.includes(colorName) : false;
          })
        )
          return false;
      }

      return true;
    });
  })();
  const hasActiveFilters =
    filters.brand.length > 0 ||
    filters.condition.length > 0 ||
    filters.storage.length > 0 ||
    filters.ram.length > 0 ||
    filters.colors.length > 0 ||
    filters.simType.length > 0 ||
    filters.displayType.length > 0 ||
    filters.displaySize.length > 0 ||
    filters.minPrice !== INITIAL_FILTER_STATE.minPrice ||
    filters.maxPrice !== INITIAL_FILTER_STATE.maxPrice;

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / safeItemsPerPage)
  );
  const currentPageNumber = hasActiveFilters
    ? 1
    : Math.min(Math.max(currentPage, 1), totalPages);
  const pageStartIndex = (currentPageNumber - 1) * safeItemsPerPage;
  const pageEndIndex = pageStartIndex + safeItemsPerPage;
  const visibleProducts = hasActiveFilters
    ? filteredProducts
    : filteredProducts.slice(pageStartIndex, pageEndIndex);

  const handleFilterChange = (
    section: keyof FilterState,
    value: string | number
  ) => {
    if (section === 'minPrice' || section === 'maxPrice') {
      setFilters((prev) => ({ ...prev, [section]: value }));
    } else {
      // Checkbox logic
      setFilters((prev) => {
        const list = prev[section] as string[];
        const valStr = value as string;
        if (list.includes(valStr)) {
          return { ...prev, [section]: list.filter((item) => item !== valStr) };
        } else {
          return { ...prev, [section]: [...list, valStr] };
        }
      });
    }
  };

  const handleAddToCart = (_e: React.MouseEvent, product: Product) => {
    // e.preventDefault(); // handled in ProductCard
    // e.stopPropagation();

    addToCart(toRelatedProductsProduct(product), 1);

    const productId = String(product.id);
    setAddedItems((prev) => [...prev, productId]);
    setTimeout(() => {
      setAddedItems((prev) => prev.filter((id) => id !== productId));
    }, 2000);
  };

  // Clean display title for H1 and Breadcrumb (Koray-approved: no keyword stuffing)
  const displayTitle = (() => {
    if (categoryName === 'All') return 'All Products';

    return decodeURIComponent(categoryName)
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  })();

  // SEO heading is only for the SEO content block at the bottom, not the H1
  const pageTitle = displayTitle;
  const categoryPath = asRoute(`${basePath}/${categoryName}`);
  const legacyHubModel: CategoryHubModel = {
    intro: {
      heading:
        seoHeading || (seoDescription ? `Buy ${pageTitle} in Nigeria` : ''),
      description: seoDescription || '',
      source: seoHeading || seoDescription ? 'merchant' : 'fallback',
    },
    trustFeatures: seoFeatures,
    bestForCards: [],
    brandCards: [],
    priceBandCards: [],
    comparisonLinks: [],
    guideLinks: [],
    faqItems: seoFaqs,
  };
  const hubModel = hubContent ?? legacyHubModel;

  return (
    <div className="min-h-screen bg-[color:color-mix(in_srgb,var(--store-background,#ffffff)_94%,var(--store-background-text,#111827)_6%)] pb-20 pt-4">
      {/* Header Ad replaced with Banner Carousel */}
      <section className="mx-auto mb-4 hidden min-h-[208px] max-w-[1400px] px-4 md:block md:px-6">
        {showDesktopBanner && (
          <section
            data-testid="category-banner-carousel"
            aria-label="Category banner carousel"
          >
            <BannerCarousel
              className="h-40 md:h-52"
              categoryImage={categoryImage}
              title={displayTitle}
              description={seoDescription}
            />
          </section>
        )}
      </section>

      {/* Breadcrumb & Header */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 mb-6">
        <nav className="flex items-center overflow-x-auto whitespace-nowrap pb-2 text-sm text-[color:color-mix(in_srgb,var(--store-background-text,#111827)_65%,transparent)]">
          <Link
            href={asRoute(basePath || '')}
            className="transition-colors hover:text-[var(--store-primary)]"
          >
            Home
          </Link>
          <ChevronRight size={16} className="mx-2" />
          <span className="font-medium text-[var(--store-background-text,#111827)]">
            {displayTitle}
          </span>
        </nav>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--store-background-text,#111827)]">
              {displayTitle}
            </h1>
            <p className="text-[var(--store-background-text,#111827)]/50 text-sm mt-1">
              {filteredProducts.length} results found
            </p>
          </div>

          {/* View Mode & Mobile Filter Toggle */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center bg-[var(--store-background,#ffffff)] rounded-lg p-1 border border-[var(--store-background-text,#111827)]/15">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-[var(--store-background-text,#111827)]/10 text-[var(--store-background-text,#111827)] shadow-sm' : 'text-[var(--store-background-text,#111827)]/40 hover:text-[var(--store-background-text,#111827)]/70'}`}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-[var(--store-background-text,#111827)]/10 text-[var(--store-background-text,#111827)] shadow-sm' : 'text-[var(--store-background-text,#111827)]/40 hover:text-[var(--store-background-text,#111827)]/70'}`}
              >
                <List size={18} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[var(--store-primary)] px-4 py-2.5 text-sm font-bold text-[var(--store-primary-text,#ffffff)] shadow-md active:scale-95 md:hidden"
            >
              <Filter size={16} /> Filters
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Filters (Desktop) */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24">
              <CategoryFiltersSidebar
                filters={filters}
                availableOptions={availableOptions}
                onFilterChange={handleFilterChange}
                onClearFilters={() => setFilters(INITIAL_FILTER_STATE)}
              />
              <div className="mt-6">
                <AdUnit placementKey="PRODUCT_SIDEBAR" />
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="lg:col-span-3">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-[var(--store-background,#ffffff)] rounded-2xl border border-[var(--store-background-text,#111827)]/10 shadow-sm">
                <div className="w-16 h-16 bg-[var(--store-background-text,#111827)]/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter
                    className="text-[var(--store-background-text,#111827)]/40"
                    size={32}
                  />
                </div>
                <h3 className="text-lg font-bold text-[var(--store-background-text,#111827)] mb-1">
                  No products found
                </h3>
                <p className="text-[var(--store-background-text,#111827)]/50 text-sm mb-6">
                  Try adjusting your filters to find what you're looking for.
                </p>
                <button
                  type="button"
                  onClick={() => setFilters(INITIAL_FILTER_STATE)}
                  className="font-bold text-[var(--store-primary)] hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6'
                    : 'flex flex-col gap-4'
                }
              >
                {visibleProducts.map((product, index) => {
                  const isAdded = addedItems.includes(String(product.id));
                  return (
                    <React.Fragment key={product.id}>
                      <ProductCard
                        product={product}
                        onAddToCart={handleAddToCart}
                        isAdded={isAdded}
                        viewMode={viewMode}
                      />
                      {/* Ad insertion logic */}
                      {viewMode === 'grid' && (index === 5 || index === 11) && (
                        <div className="col-span-2 md:col-span-3 my-4">
                          <AdUnit placementKey="PRODUCT_GRID_IN_FEED" />
                        </div>
                      )}
                      {viewMode === 'list' && (index === 3 || index === 7) && (
                        <div className="w-full my-4">
                          <AdUnit placementKey="PRODUCT_GRID_IN_FEED" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {filteredProducts.length > 0 && (
              <div className="mt-8 space-y-3">
                {!hasActiveFilters && (
                  <p className="text-center text-sm text-[var(--store-background-text,#111827)]/50">
                    Showing {pageStartIndex + 1}-
                    {Math.min(pageEndIndex, filteredProducts.length)} of{' '}
                    {filteredProducts.length} products
                  </p>
                )}

                {hasActiveFilters ? (
                  <p className="text-center text-sm text-[var(--store-background-text,#111827)]/50">
                    Filtered results show all {filteredProducts.length} matching
                    products on one page.
                  </p>
                ) : (
                  <StorefrontPagination
                    ariaLabel={`${pageTitle} pagination`}
                    basePath={categoryPath}
                    currentPage={currentPageNumber}
                    totalPages={totalPages}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <CategoryHubSections hub={hubModel} />

      {/* Mobile Filter Drawer */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileFilterOpen(false)}
          />
          <div
            className="relative w-full max-w-xs bg-[var(--store-background,#ffffff)] h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filter-heading"
          >
            <div className="sticky top-0 bg-[var(--store-background,#ffffff)] z-10 px-5 py-4 border-b border-[var(--store-background-text,#111827)]/10 flex items-center justify-between">
              <h3
                id="mobile-filter-heading"
                className="font-bold text-lg text-[var(--store-background-text,#111827)]"
              >
                Filters
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="p-1 hover:bg-[var(--store-background-text,#111827)]/10 rounded-full"
                aria-label="Close filters"
              >
                <X
                  size={24}
                  className="text-[var(--store-background-text,#111827)]/50"
                />
              </button>
            </div>
            <div className="p-5 pb-24">
              <CategoryFiltersSidebar
                filters={filters}
                availableOptions={availableOptions}
                onFilterChange={handleFilterChange}
                onClearFilters={() => setFilters(INITIAL_FILTER_STATE)}
                className="border-none shadow-none p-0"
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-[var(--store-background,#ffffff)] border-t border-[var(--store-background-text,#111827)]/10">
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-full rounded-xl bg-[var(--store-primary)] py-3 font-bold text-[var(--store-primary-text,#ffffff)] shadow-lg active:scale-95"
              >
                Show {filteredProducts.length} Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
