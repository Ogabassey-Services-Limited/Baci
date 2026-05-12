'use client';

import { orderRecordsByIds } from '@baci/shared';
import Fuse from 'fuse.js';
import { useEffect, useState } from 'react';
import { ThemedButton } from '@/components/themed';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
import { useStorefrontSafe } from '@/contexts/storefront-context';
import { useCart } from '@/hooks/use-cart';
import { useCurrency } from '@/hooks/use-currency';
import { useDebounce } from '@/hooks/use-debounce';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import { apiGet } from '@/lib/api-client';
import { sortCategories } from '@/lib/category-sorting';
import { findDarkestColor } from '@/lib/color-utils';
import { type Product, sampleProductsByCategory } from '@/lib/products';
import { DidYouMeanBanner } from './did-you-mean-banner';
import { StorefrontProductCard } from './product-card';
import { QuickViewModal, useQuickView } from './quick-view-modal';

interface StorefrontProductGridProps {
  title?: string;
  columns?: number;
  limit?: number;
  showFilters?: boolean;
}

// Static Tailwind class mappings to ensure classes are included in the build
const GRID_COLUMN_CLASSES: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
};

const STAGGER_CLASSES = [
  'stagger-1',
  'stagger-2',
  'stagger-3',
  'stagger-4',
  'stagger-5',
  'stagger-6',
  'stagger-7',
  'stagger-8',
];

export function StorefrontProductGrid({
  title = 'Shop By',
  columns = 4,
  limit = 12,
  showFilters = false,
}: StorefrontProductGridProps) {
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant || null;
  const { cart, addToCart, updateQuantity, setMerchantSlug } = useCart();
  const { toast } = useToast();
  const storefrontContext = useStorefrontSafe();

  // Optimization: Cart items map for O(1) lookup in render loop
  // Preserves existing behavior: if multiple items have same ID (legacy), use the first one found
  const cartItemsMap = (() => {
    const map = new Map();
    // Loop through cart to populate map. If duplicates exist, we keep the first one
    // to match .find() behavior which returns the first match.
    // However, Map.set overwrites, so we need to check if it exists first.
    for (const item of cart) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return map;
  })();

  // Local state fallbacks for when context is missing (e.g. in builder)
  const [localSelectedCategory, setLocalSelectedCategory] = useState('All');
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  const searchQuery = storefrontContext?.searchQuery ?? localSearchQuery;
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const selectedCategory =
    storefrontContext?.selectedCategory ?? localSelectedCategory;

  const handleSetSelectedCategory = (category: string) => {
    if (storefrontContext?.setSelectedCategory) {
      storefrontContext.setSelectedCategory(category);
    } else {
      setLocalSelectedCategory(category);
    }
  };

  const handleSetSearchQuery = (query: string) => {
    if (storefrontContext?.setSearchQuery) {
      storefrontContext.setSearchQuery(query);
    } else {
      setLocalSearchQuery(query);
    }
  };

  const isPreviewMode =
    !merchantContext ||
    merchant?.id?.endsWith('-preview') ||
    merchant?.id?.startsWith('demo-');
  const [products, setProducts] = useState<Product[]>(() => {
    if (isPreviewMode) {
      return sampleProductsByCategory.fashion || sampleProductsByCategory.other;
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(!isPreviewMode);
  const [filterType, setFilterType] = useState<'category' | 'brand' | 'price'>(
    'category'
  );
  const [serverSearchProductIds, setServerSearchProductIds] = useState<
    string[]
  >([]);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (merchant?.id && !isPreviewMode) {
      // Fetch products
      apiGet<{ products: Product[] }>(
        `/api/storefront/products?merchant_id=${merchant.id}`
      )
        .then((data) => {
          if (data.products) {
            setProducts(data.products);
          }
          setIsLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setIsLoading(false);
        });
    }
  }, [merchant?.id, isPreviewMode]);

  useEffect(() => {
    if (!debouncedSearchQuery || !merchant?.id || isPreviewMode) {
      setServerSearchProductIds([]);
      setDidYouMean(null);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchError(null);
    apiGet<{ didYouMean: string | null; productIds: string[] }>(
      `/api/search?q=${encodeURIComponent(debouncedSearchQuery)}&merchant_id=${merchant.id}`
    )
      .then((data) => {
        if (cancelled) return;
        setServerSearchProductIds(data.productIds || []);
        setDidYouMean(data.didYouMean || null);
        setSearchError(null);
        setIsSearching(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Search error:', err);
        setSearchError(
          err instanceof Error
            ? err.message
            : 'We could not refresh search results right now.'
        );
        setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery, merchant?.id, isPreviewMode]);

  const { formatCurrencyCompact } = useCurrency();

  const priceRanges = [
    { label: `Under ${formatCurrencyCompact(50)}`, min: 0, max: 50 },
    {
      label: `${formatCurrencyCompact(50)} - ${formatCurrencyCompact(100)}`,
      min: 50,
      max: 100,
    },
    {
      label: `${formatCurrencyCompact(100)} - ${formatCurrencyCompact(200)}`,
      min: 100,
      max: 200,
    },
    {
      label: `Over ${formatCurrencyCompact(200)}`,
      min: 200,
      max: Number.POSITIVE_INFINITY,
    },
  ];

  // Single-pass category extraction — reused by filterOptions and categories
  const uniqueCategories = (() => {
    const cats = new Set<string>();
    for (const p of products) {
      if (p.category) cats.add(p.category);
    }
    return Array.from(cats);
  })();

  const filterOptions = (() => {
    if (filterType === 'category') {
      return uniqueCategories;
    } else if (filterType === 'brand') {
      const brands = new Set<string>();
      for (const p of products) {
        if (p.brand) brands.add(p.brand);
      }
      return Array.from(brands);
    } else if (filterType === 'price') {
      return priceRanges.map((r) => r.label);
    }
    return [];
  })();

  const fuse = (() => {
    if (products.length > 0) {
      return new Fuse(products, {
        keys: ['name', 'description', 'brand'],
        includeScore: true,
        threshold: 0.4,
      });
    }
    return null;
  })();

  const categories = (() => {
    const priorityList: string[] = [];
    if (merchantContext?.navigationCategories) {
      for (const c of merchantContext.navigationCategories) {
        const name = c.name?.toLowerCase().trim();
        if (name) priorityList.push(name);
      }
    }

    const sorted = sortCategories({
      categories: uniqueCategories,
      priorityList,
    });

    return ['All', ...sorted];
  })();

  const searchResults = (() => {
    if (debouncedSearchQuery && !isPreviewMode) {
      let filtered = orderRecordsByIds(products, serverSearchProductIds);

      if (selectedCategory !== 'All') {
        if (filterType === 'category') {
          filtered = filtered.filter((p) => p.category === selectedCategory);
        } else if (filterType === 'brand') {
          filtered = filtered.filter((p) => p.brand === selectedCategory);
        } else if (filterType === 'price') {
          const range = priceRanges.find((r) => r.label === selectedCategory);
          if (range) {
            filtered = filtered.filter((p) => {
              const price = p.price || 0;
              if (range.max === Number.POSITIVE_INFINITY)
                return price > range.min;
              if (range.min === 0) return price < range.max;
              return price >= range.min && price <= range.max;
            });
          }
        }
      }

      return filtered.slice(0, limit);
    }

    let filtered = products;

    if (debouncedSearchQuery && fuse && isPreviewMode) {
      filtered = fuse.search(debouncedSearchQuery).map((result) => result.item);
    }

    if (selectedCategory !== 'All') {
      if (filterType === 'category') {
        filtered = filtered.filter((p) => p.category === selectedCategory);
      } else if (filterType === 'brand') {
        filtered = filtered.filter((p) => p.brand === selectedCategory);
      } else if (filterType === 'price') {
        const range = priceRanges.find((r) => r.label === selectedCategory);
        if (range) {
          filtered = filtered.filter((p) => {
            const price = p.price || 0;
            if (range.max === Number.POSITIVE_INFINITY)
              return price > range.min;
            if (range.min === 0) return price < range.max;
            return price >= range.min && price <= range.max;
          });
        }
      }
    }

    return filtered.filter((p) => p.status === 'active').slice(0, limit);
  })();

  const handleAddToCart = (product: Product) => {
    // Store merchant slug for checkout
    if (merchant?.slug) {
      setMerchantSlug(merchant.slug);
    }
    addToCart(product);
    toast({
      title: 'Added to cart',
      description: `${product.name} has been added to your cart.`,
    });
  };

  const brandColors = merchant?.brand_colors
    ? [
        merchant.brand_colors.primary,
        merchant.brand_colors.background,
        merchant.brand_colors.accent,
      ].filter(Boolean)
    : ['#3F51B5'];
  const darkestColor = findDarkestColor(brandColors as string[]);

  // Quick view modal state
  const {
    product: quickViewProduct,
    isOpen: isQuickViewOpen,
    openQuickView,
    closeQuickView,
  } = useQuickView();

  return (
    <section className="w-full py-8 md:py-12" id="products">
      <div className="container px-4 md:px-6">
        {showFilters ? (
          <div className="w-full mb-6">
            <div className="bg-card border rounded-xl p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-start gap-6">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                  </svg>
                  <select
                    className="text-base font-medium border-0 bg-transparent focus:ring-0 cursor-pointer pr-8"
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(
                        e.target.value as 'category' | 'brand' | 'price'
                      );
                      handleSetSelectedCategory('All'); // Reset active filter when type changes
                    }}
                  >
                    <option value="category">Shop by Category</option>
                    <option value="brand">Shop by Brand</option>
                    <option value="price">Shop by Price</option>
                  </select>
                </div>
                {filterOptions.length > 0 ? (
                  <div className="flex gap-2 flex-wrap">
                    {filterOptions.map((option) => (
                      <button
                        type="button"
                        key={option}
                        aria-pressed={selectedCategory === option}
                        onClick={() =>
                          handleSetSelectedCategory(
                            selectedCategory === option ? 'All' : option
                          )
                        }
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          selectedCategory === option
                            ? 'bg-[var(--store-primary)] text-[var(--store-primary-text)] shadow-md scale-105'
                            : 'bg-muted/50 hover:bg-muted text-foreground hover:shadow-sm'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    No {filterType === 'category' ? 'categories' : 'brands'}{' '}
                    found.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <h2
              className="text-2xl font-bold tracking-tighter sm:text-3xl text-center mb-10"
              style={{ color: darkestColor }}
            >
              {title}
            </h2>
            {categories.length > 1 && (
              <div className="flex justify-center gap-2 mb-8 flex-wrap">
                {categories.map((category) => (
                  <ThemedButton
                    key={category}
                    type="button"
                    aria-pressed={selectedCategory === category}
                    variant={
                      selectedCategory === category ? 'default' : 'outline'
                    }
                    colorRole={
                      selectedCategory === category ? 'primary' : 'accent'
                    }
                    onClick={() => handleSetSelectedCategory(category)}
                    size="sm"
                    className="capitalize"
                  >
                    {category}
                  </ThemedButton>
                ))}
              </div>
            )}
          </>
        )}
        {searchError && debouncedSearchQuery && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Search is temporarily unavailable. Showing the last available
            results. {searchError}
          </div>
        )}
        {/* Did you mean banner */}
        {didYouMean && searchQuery && (
          <DidYouMeanBanner
            originalQuery={searchQuery}
            suggestion={didYouMean}
            onSuggestionClick={(suggestion) => {
              handleSetSearchQuery(suggestion);
            }}
          />
        )}

        {/* Live region for screen reader announcements */}
        <output className="sr-only" aria-live="polite">
          {isLoading || isSearching
            ? 'Loading products...'
            : `${searchResults.length} product${searchResults.length !== 1 ? 's' : ''} found${
                selectedCategory !== 'All' ? ` in ${selectedCategory}` : ''
              }`}
        </output>

        {isLoading || isSearching ? (
          <ProductGridSkeleton
            count={limit}
            columns={columns as 2 | 3 | 4 | 5 | 6}
          />
        ) : searchResults.length > 0 ? (
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${GRID_COLUMN_CLASSES[columns] || GRID_COLUMN_CLASSES[4]} gap-6`}
          >
            {searchResults.map((product, index) => {
              const cartItem = cartItemsMap.get(product.id);
              // Stagger animation class (1-8, then loops)
              const staggerClass =
                STAGGER_CLASSES[index % STAGGER_CLASSES.length];

              return (
                <StorefrontProductCard
                  key={product.id}
                  product={product}
                  cartItem={cartItem}
                  staggerClass={staggerClass}
                  onAddToCart={handleAddToCart}
                  onUpdateQuantity={updateQuantity}
                  onQuickView={openQuickView}
                  priority={index < 4}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-16">
            <h3 className="text-xl font-semibold">No products found</h3>
            <p>
              {searchQuery
                ? `Your search for "${searchQuery}" did not match any products.`
                : selectedCategory !== 'All'
                  ? `No products found ${filterType === 'price' ? 'in this price range' : filterType === 'brand' ? 'for this brand' : 'in this category'}.`
                  : 'No products are currently available.'}
            </p>
          </div>
        )}
      </div>

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickViewProduct}
        isOpen={isQuickViewOpen}
        onClose={closeQuickView}
        merchantSlug={merchant?.slug}
      />
    </section>
  );
}
