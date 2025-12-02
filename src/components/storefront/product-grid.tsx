'use client';

import Fuse from 'fuse.js';
import { Eye, Minus, Plus } from 'lucide-react';
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

export function StorefrontProductGrid({
  title = 'Shop By',
  columns = 4,
  limit = 12,
  showFilters = false,
}: StorefrontProductGridProps) {
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant || null;
  const { cart, addToCart, updateQuantity } = useCart();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const storefrontContext = useStorefrontSafe();
  const searchQuery = storefrontContext?.searchQuery || '';
  const selectedCategory = storefrontContext?.selectedCategory || 'All';
  const setSelectedCategory =
    storefrontContext?.setSelectedCategory || (() => {});

  const isPreviewMode = !merchantContext;
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
    if (merchant?.id) {
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
  }, [merchant?.id]);

  // Perform server-side search when needed
  useEffect(() => {
    if (!useServerSearch || !searchQuery || !merchant?.id || isPreviewMode) {
      // Avoid synchronous state updates in effect
      if (serverSearchResults.length > 0 || didYouMean !== null) {
        const timer = setTimeout(() => {
          setServerSearchResults([]);
          setDidYouMean(null);
        }, 0);
        return () => clearTimeout(timer);
      }
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
    didYouMean,
    serverSearchResults.length,
  ]);

  const filterOptions = useMemo(() => {
    if (filterType === 'category') {
      const cats = new Set(
        products
          .map((p) => p.category)
          .filter((c): c is string => !!c && c !== 'General')
      );
      return Array.from(cats);
    } else if (filterType === 'brand') {
      const brands = new Set(
        products.map((p) => p.brand).filter((b): b is string => !!b)
      );
      return Array.from(brands);
    } else if (filterType === 'price') {
      return ['Under $50', '$50 - $100', '$100 - $200', 'Over $200'];
    }
    return [];
  }, [products, filterType]);

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
    return ['All', ...Array.from(cats)];
  }, [products]);

  const searchResults = useMemo(() => {
    // Use server search results if available and search is active
    if (useServerSearch && searchQuery && serverSearchResults.length > 0) {
      let filtered = serverSearchResults;

      // Apply category/brand/price filters
      if (selectedCategory !== 'All') {
        if (filterType === 'category') {
          filtered = filtered.filter((p) => p.category === selectedCategory);
        } else if (filterType === 'brand') {
          filtered = filtered.filter((p) => p.brand === selectedCategory);
        } else if (filterType === 'price') {
          filtered = filtered.filter((p) => {
            const price = p.price || 0;
            switch (selectedCategory) {
              case 'Under $50':
                return price < 50;
              case '$50 - $100':
                return price >= 50 && price <= 100;
              case '$100 - $200':
                return price >= 100 && price <= 200;
              case 'Over $200':
                return price > 200;
              default:
                return true;
            }
          });
        }
      }

      return filtered.slice(0, limit);
    }

    // Fall back to client-side search
    let filtered = products;

    if (searchQuery && fuse) {
      filtered = fuse.search(searchQuery).map((result) => result.item);
    }

    if (selectedCategory !== 'All') {
      if (filterType === 'category') {
        filtered = filtered.filter((p) => p.category === selectedCategory);
      } else if (filterType === 'brand') {
        filtered = filtered.filter((p) => p.brand === selectedCategory);
      } else if (filterType === 'price') {
        filtered = filtered.filter((p) => {
          const price = p.price || 0;
          switch (selectedCategory) {
            case 'Under $50':
              return price < 50;
            case '$50 - $100':
              return price >= 50 && price <= 100;
            case '$100 - $200':
              return price >= 100 && price <= 200;
            case 'Over $200':
              return price > 200;
            default:
              return true;
          }
        });
      }
    }

    return filtered.filter((p) => p.status === 'active').slice(0, limit);
  }, [
    searchQuery,
    fuse,
    products,
    selectedCategory,
    limit,
    filterType,
    useServerSearch,
    serverSearchResults,
  ]);

  const handleAddToCart = (product: Product) => {
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
    <section className="w-full py-12 md:py-24 lg:py-32" id="products">
      <div className="container px-4 md:px-6">
        {showFilters ? (
          <div className="max-w-4xl mx-auto mb-12">
            <div className="bg-card border rounded-xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                      setSelectedCategory('All'); // Reset active filter when type changes
                    }}
                  >
                    <option value="category">Shop by Category</option>
                    <option value="brand">Shop by Brand</option>
                    <option value="price">Shop by Price</option>
                  </select>
                </div>
                {filterOptions.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {filterOptions.map((option) => (
                      <button
                        key={option}
                        onClick={() =>
                          setSelectedCategory(
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
                    variant={
                      selectedCategory === category ? 'default' : 'outline'
                    }
                    colorRole={
                      selectedCategory === category ? 'primary' : 'accent'
                    }
                    onClick={() => setSelectedCategory(category)}
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
              storefrontContext?.setSearchQuery?.(suggestion);
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
            className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${columns} gap-6`}
          >
            {searchResults.map((product, index) => {
              const cartItem = cart.find((item) => item.id === product.id);
              // Stagger animation class (1-8, then loops)
              const staggerClass = `stagger-${(index % 8) + 1}`;

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
                      category={product.category}
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
                            colorRole="accent"
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
                            colorRole="accent"
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
          <div className="text-center text-muted-foreground py-16">
            <h3 className="text-xl font-semibold">No products found</h3>
            <p>
              Your search for &quot;{searchQuery}&quot; did not match any
              products.
            </p>
          </div>
        )}
      </div>

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickViewProduct}
        isOpen={isQuickViewOpen}
        onClose={closeQuickView}
      />
    </section>
  );
}
