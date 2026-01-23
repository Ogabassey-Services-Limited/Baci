'use client';

import Fuse from 'fuse.js';
import { Eye, Minus, PackageOpen, Plus, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ProductCardImage } from '@/components/optimized-image';
import { ThemedButton, ThemedCard } from '@/components/themed';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
import { useStorefrontSafe } from '@/contexts/storefront-context';
import { useCart } from '@/hooks/use-cart';
import { useCurrency } from '@/hooks/use-currency';
import { useDebounce } from '@/hooks/use-debounce';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { apiGet } from '@/lib/api-client';
import { findDarkestColor } from '@/lib/color-utils';
import { type Product, sampleProductsByCategory } from '@/lib/products';
import { getProductUrl } from '@/lib/seo-utils';
import { DidYouMeanBanner } from './did-you-mean-banner';
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
  const { formatCurrency } = useCurrency();
  const storefrontContext = useStorefrontSafe();

  // Optimization: Memoize cart items map for O(1) lookup in render loop
  // Preserves existing behavior: if multiple items have same ID (legacy), use the first one found
  const cartItemsMap = useMemo(() => {
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
  }, [cart]);

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
  const [useServerSearch, setUseServerSearch] = useState(false);
  const [serverSearchResults, setServerSearchResults] = useState<Product[]>([]);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Check product count and determine search method

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

      // Check if we should use server search
      apiGet<{ count: number; recommendedMethod: 'client' | 'server' }>(
        `/api/products/count?merchant_id=${merchant.id}`
      )
        .then((data) => {
          setUseServerSearch(data.recommendedMethod === 'server');
        })
        .catch((err) => {
          console.error('Failed to check product count:', err);
          setUseServerSearch(false);
        });
    }
  }, [merchant?.id, isPreviewMode]);

  // Perform server-side search when needed
  // Note: We use refs to check current state without adding to dependencies
  useEffect(() => {
    if (!useServerSearch || !searchQuery || !merchant?.id || isPreviewMode) {
      // Clear previous search results when conditions change
      setServerSearchResults([]);
      setDidYouMean(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      setIsSearching(true);
      apiGet<{ results: Product[]; didYouMean: string | null }>(
        `/api/search?q=${encodeURIComponent(searchQuery)}&merchant_id=${merchant.id}`
      )
        .then((data) => {
          setServerSearchResults(data.results || []);
          setDidYouMean(data.didYouMean || null);
          setIsSearching(false);
        })
        .catch((err) => {
          console.error('Search error:', err);
          setServerSearchResults([]);
          setDidYouMean(null);
          setIsSearching(false);
        });
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [
    searchQuery,
    useServerSearch,
    merchant?.id,
    isPreviewMode,
    // Removed didYouMean and serverSearchResults.length - they're set by this effect
  ]);

  const { formatCurrencyCompact } = useCurrency();

  const priceRanges = useMemo(
    () => [
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
    ],
    [formatCurrencyCompact]
  );

  const filterOptions = useMemo(() => {
    if (filterType === 'category') {
      const cats = new Set(
        products.map((p) => p.category).filter((c): c is string => !!c)
      );
      return Array.from(cats);
    } else if (filterType === 'brand') {
      const brands = new Set(
        products.map((p) => p.brand).filter((b): b is string => !!b)
      );
      return Array.from(brands);
    } else if (filterType === 'price') {
      return priceRanges.map((r) => r.label);
    }
    return [];
  }, [products, filterType, priceRanges]);

  const fuse = useMemo(() => {
    if (products.length > 0) {
      return new Fuse(products, {
        keys: ['name', 'description', 'brand'],
        includeScore: true,
        threshold: 0.4,
      });
    }
    return null;
  }, [products]);

  const categories = useMemo(() => {
    const cats = new Set(
      products.map((p) => p.category).filter((c): c is string => !!c)
    );
    const availableCategories = Array.from(cats);

    // Get priority list from navigation categories if available
    const priorityList =
      merchantContext?.navigationCategories?.map((c) => c.name.toLowerCase()) ||
      [];

    console.log('[ProductGrid] Debug Priority:', {
      priorityList,
      availableCategories,
      merchantContextCats: merchantContext?.navigationCategories,
    });

    // Sort logic: All -> Smartphones -> Navigation Priority Order -> Remaining Alphabetical
    const sorted = availableCategories.sort((a, b) => {
      const aName = a.toLowerCase().trim();
      const bName = b.toLowerCase().trim();

      // 1. Force 'Smartphones' (singular or plural) OR any phone related to the top
      const isASmartphone =
        aName === 'smartphone' ||
        aName === 'smartphones' ||
        aName.includes('phone') ||
        aName.includes('mobile');
      const isBSmartphone =
        bName === 'smartphone' ||
        bName === 'smartphones' ||
        bName.includes('phone') ||
        bName.includes('mobile');

      if (isASmartphone && !isBSmartphone) return -1;
      if (!isASmartphone && isBSmartphone) return 1;
      if (isASmartphone && isBSmartphone) return a.localeCompare(b);

      // 2. Navigation Priority List
      const aIndex = priorityList.findIndex(
        (p) => aName === p || aName.includes(p)
      );
      const bIndex = priorityList.findIndex(
        (p) => bName === p || bName.includes(p)
      );

      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // 3. Alphabetical
      return a.localeCompare(b);
    });

    console.log('[ProductGrid] Debug Categories:', {
      availableCategories,
      sorted,
      priorityList,
    });

    return ['All', ...sorted];
  }, [products, merchantContext?.navigationCategories]);

  const searchResults = useMemo(() => {
    // Use server search results if available and search is active
    if (
      useServerSearch &&
      debouncedSearchQuery &&
      serverSearchResults.length > 0
    ) {
      let filtered = serverSearchResults;

      // Apply category/brand/price filters
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

    // Fall back to client-side search
    let filtered = products;

    if (debouncedSearchQuery && fuse) {
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
  }, [
    debouncedSearchQuery,
    fuse,
    products,
    selectedCategory,
    limit,
    filterType,
    useServerSearch,
    serverSearchResults,
    priceRanges,
  ]);

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
              const productCategory =
                // biome-ignore lint/suspicious/noExplicitAny: Product type lacks categories join
                (product as any).categories?.name ||
                product.category ||
                'General';

              return (
                <ThemedCard
                  key={product.id}
                  className={`glass-themed overflow-hidden hover-lift flex flex-col group/card animate-fade-in-up ${staggerClass}`}
                  accentPosition="top"
                >
                  <Link
                    href={getProductUrl(product)}
                    className="block relative group"
                  >
                    <ProductCardImage
                      src={product.imageLarge}
                      alt={product.name}
                      data-ai-hint={product.imageHint}
                      width={600}
                      height={400}
                      className="object-cover w-full h-auto aspect-video"
                      category={productCategory}
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {product.compare_at_price &&
                        product.compare_at_price > product.price && (
                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                            SALE
                          </span>
                        )}
                      {product.manage_stock &&
                        product.stock <= (product.low_stock_threshold || 5) &&
                        product.stock > 0 && (
                          <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                            LOW STOCK
                          </span>
                        )}
                      {product.manage_stock && product.stock === 0 && (
                        <span className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                          OUT OF STOCK
                        </span>
                      )}
                    </div>
                    {/* Quick View Button - Desktop Only */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openQuickView(product);
                      }}
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1.5 bg-white/95 backdrop-blur-sm text-gray-900 px-4 py-2 rounded-full text-sm font-medium shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white hover:scale-105"
                      aria-label={`Quick view ${product.name}`}
                    >
                      <Eye className="w-4 h-4" />
                      Quick View
                    </button>
                  </Link>
                  <CardContent className="p-4 flex flex-col flex-1">
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    <p className="text-muted-foreground text-sm mt-1 truncate flex-1">
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between mt-4">
                      <p
                        className="text-lg font-bold"
                        style={{ color: 'var(--store-primary)' }}
                      >
                        {formatCurrency(product.price)}
                      </p>
                      {cartItem ? (
                        <div className="flex items-center gap-1">
                          <ThemedButton
                            colorRole="primary"
                            size="icon"
                            variant="outline"
                            className="h-10 w-10 min-w-[44px] min-h-[44px]"
                            onClick={() =>
                              updateQuantity(product.id, cartItem.quantity - 1)
                            }
                            aria-label={`Decrease quantity of ${product.name}`}
                          >
                            <Minus className="h-4 w-4" aria-hidden="true" />
                          </ThemedButton>
                          <Input
                            type="number"
                            value={cartItem.quantity}
                            onChange={(e) =>
                              updateQuantity(
                                product.id,
                                Number.parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="h-10 w-12 text-center remove-arrow"
                            min="0"
                            aria-label={`Quantity for ${product.name}`}
                          />
                          <ThemedButton
                            colorRole="primary"
                            size="icon"
                            className="h-10 w-10 min-w-[44px] min-h-[44px]"
                            onClick={() =>
                              updateQuantity(product.id, cartItem.quantity + 1)
                            }
                            aria-label={`Increase quantity of ${product.name}`}
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                          </ThemedButton>
                        </div>
                      ) : (
                        <ThemedButton
                          colorRole="primary"
                          size="sm"
                          onClick={() => handleAddToCart(product)}
                        >
                          Add to Cart
                        </ThemedButton>
                      )}
                    </div>
                  </CardContent>
                </ThemedCard>
              );
            })}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in"
            role="status"
            aria-live="polite"
          >
            {searchQuery || selectedCategory !== 'All' ? (
              <>
                {/* Search Results Empty State */}
                <div className="rounded-full bg-muted/50 p-6 mb-6">
                  <SearchX
                    className="w-16 h-16 text-muted-foreground/50"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-3">
                  No matches found
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md text-center">
                  {searchQuery ? (
                    <>
                      Your search for <strong>&quot;{searchQuery}&quot;</strong>{' '}
                      did not match any products.
                    </>
                  ) : (
                    <>
                      No products found in the{' '}
                      <strong>&quot;{selectedCategory}&quot;</strong> category.
                    </>
                  )}
                </p>
                <ThemedButton
                  colorRole="primary"
                  onClick={() => {
                    handleSetSearchQuery('');
                    handleSetSelectedCategory('All');
                  }}
                  aria-label="Clear search filters and show all products"
                >
                  Clear Search
                </ThemedButton>
              </>
            ) : (
              <>
                {/* General Empty State */}
                <div className="rounded-full bg-muted/50 p-6 mb-6">
                  <PackageOpen
                    className="w-16 h-16 text-muted-foreground/50"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-3">
                  No products available
                </h3>
                <p className="text-muted-foreground max-w-md text-center">
                  This store doesn&apos;t have any products yet. Check back
                  soon!
                </p>
              </>
            )}
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
