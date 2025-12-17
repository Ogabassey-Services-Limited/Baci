'use client';

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ThemedButton, ThemedCard } from '@/components/themed';
import { CardContent } from '@/components/ui/card';
import { useCart } from '@/hooks/use-cart';
import { useCurrency } from '@/hooks/use-currency';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { apiGet } from '@/lib/api-client';
import type { Product } from '@/lib/products';
import { getProductUrl } from '@/lib/seo-utils';
import { cn } from '@/lib/utils';

interface PriceRangeProductsProps {
  /** Current product to find similar-priced products for */
  product: Product;
  /** Maximum number of products to show (default: 4) */
  maxProducts?: number;
  /** Price tolerance percentage (default: 0.15 = 15%) */
  priceTolerance?: number;
  /** Custom class name for the container */
  className?: string;
}

/**
 * Price Range Products Component (Koray-aligned)
 *
 * Shows products from the SAME category within a similar price range.
 * This follows Koray's comparison intent pattern:
 * - Same category maintains topical focus
 * - Similar price supports commercial comparison intent
 * - Clear anchor text: "[Category] Under ₦X" or "[Category] ₦X-₦Y"
 */
export function PriceRangeProducts({
  product,
  maxProducts = 4,
  priceTolerance = 0.15,
  className,
}: PriceRangeProductsProps) {
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant ?? null;
  const { formatCurrency } = useCurrency();
  const { addToCart } = useCart();
  const { toast } = useToast();

  const [priceRangeProducts, setPriceRangeProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Derive category from current product
  // biome-ignore lint/suspicious/noExplicitAny: Legacy Product type lacks categories join
  const categoriesName = (product as any).categories?.name;
  // biome-ignore lint/suspicious/noExplicitAny: Legacy Product type lacks categories join
  const categoryFallback = (product as any).category;
  const productCategory = categoriesName || categoryFallback || '';
  // biome-ignore lint/suspicious/noExplicitAny: Legacy Product type lacks categories join
  const categoriesSlug = (product as any).categories?.slug;
  // biome-ignore lint/suspicious/noExplicitAny: Legacy Product type lacks categories join
  const categorySlugFallback = (product as any).category_slug;
  const categorySlug =
    categoriesSlug || categorySlugFallback || productCategory.toLowerCase();

  // Calculate price range safely
  const rawPrice = Number(product.price);
  const isValidPrice = Number.isFinite(rawPrice) && rawPrice > 0;
  const minPrice = isValidPrice
    ? Math.floor(rawPrice * (1 - priceTolerance))
    : 0;
  const maxPrice = isValidPrice
    ? Math.floor(rawPrice * (1 + priceTolerance))
    : 0;

  useEffect(() => {
    // Skip if no merchant, no category, or invalid price
    if (!merchant?.id || !productCategory || !isValidPrice) {
      setPriceRangeProducts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Fetch products from same category with price range filter
    const params = new URLSearchParams({
      merchant_id: merchant.id,
      category: categorySlug,
      min_price: minPrice.toString(),
      max_price: maxPrice.toString(),
    });

    apiGet<{ products: Product[] }>(`/api/storefront/products?${params}`)
      .then((data) => {
        if (data.products) {
          // Exclude current product and filter for active status
          const filtered = data.products.filter(
            (p) => p.id !== product.id && p.status === 'active'
          );
          // Sort by price proximity to current product
          filtered.sort(
            (a, b) =>
              Math.abs(a.price - product.price) -
              Math.abs(b.price - product.price)
          );
          setPriceRangeProducts(filtered.slice(0, maxProducts));
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch price range products:', err);
        setPriceRangeProducts([]);
        setIsLoading(false);
      });
  }, [
    merchant?.id,
    product.id,
    product.price,
    categorySlug,
    productCategory,
    minPrice,
    maxPrice,
    maxProducts,
    isValidPrice,
  ]);

  const handleAddToCart = (p: Product) => {
    addToCart(p);
    toast({
      title: 'Added to cart',
      description: `${p.name} has been added to your cart.`,
    });
  };

  const scrollContainer = (direction: 'left' | 'right') => {
    const container = document.getElementById('price-range-products-scroll');
    if (!container) return;

    const scrollAmount = 300;
    const newPosition =
      direction === 'left'
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;

    container.scrollTo({ left: newPosition, behavior: 'smooth' });
    setScrollPosition(newPosition);
  };

  // Don't render if no products found
  if (!isLoading && priceRangeProducts.length === 0) {
    return null;
  }

  // Generate semantic title based on price range
  // Format: "[Category] Under ₦X" for low prices, "[Category] ₦X-₦Y" for ranges
  const formatPriceRange = () => {
    const formattedMax = formatCurrency(maxPrice);
    const formattedMin = formatCurrency(minPrice);

    // If min price is very low (< 10000), just say "Under X"
    if (minPrice < 10000) {
      return `${productCategory} Under ${formattedMax}`;
    }

    // Round to nearest convenient number for display
    return `${productCategory} ${formattedMin} - ${formattedMax}`;
  };

  const title = formatPriceRange();

  return (
    <section className={cn('w-full py-8 md:py-12', className)}>
      <div className="container px-4 md:px-6">
        {/* Header with semantic title */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {title}
          </h2>

          {priceRangeProducts.length > 3 && (
            <div className="hidden sm:flex items-center gap-2">
              <ThemedButton
                variant="outline"
                size="icon"
                colorRole="accent"
                className="h-8 w-8"
                onClick={() => scrollContainer('left')}
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-4 w-4" />
              </ThemedButton>
              <ThemedButton
                variant="outline"
                size="icon"
                colorRole="accent"
                className="h-8 w-8"
                onClick={() => scrollContainer('right')}
                aria-label="Scroll right"
              >
                <ChevronRight className="h-4 w-4" />
              </ThemedButton>
            </div>
          )}
        </div>

        {/* Products */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div
            id="price-range-products-scroll"
            className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
          >
            {priceRangeProducts
              .filter((p) => p.imageLarge || p.image)
              .map((p) => (
                <ThemedCard
                  key={p.id}
                  className="flex-shrink-0 w-[200px] sm:w-[260px] overflow-hidden hover:shadow-lg transition-shadow snap-start"
                  accentPosition="top"
                >
                  <Link href={getProductUrl(p)} className="block relative">
                    <Image
                      src={p.imageLarge || p.image || '/placeholder.svg'}
                      alt={p.name}
                      data-ai-hint={p.imageHint}
                      width={260}
                      height={260}
                      className="object-cover w-full aspect-square"
                    />
                    {p.compare_at_price && p.compare_at_price > p.price && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                        SALE
                      </span>
                    )}
                  </Link>
                  <CardContent className="p-3">
                    <Link href={getProductUrl(p)}>
                      <h3 className="font-medium text-sm line-clamp-2 hover:text-[var(--store-primary)] transition-colors">
                        {p.name}
                      </h3>
                    </Link>
                    {p.brand && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.brand}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div>
                        <p
                          className="font-bold text-sm"
                          style={{ color: 'var(--store-primary)' }}
                        >
                          {formatCurrency(p.price)}
                        </p>
                        {p.compare_at_price && p.compare_at_price > p.price && (
                          <p className="text-xs text-muted-foreground line-through">
                            {formatCurrency(p.compare_at_price)}
                          </p>
                        )}
                      </div>
                      <ThemedButton
                        colorRole="primary"
                        size="sm"
                        className="text-xs px-2 py-1 h-7"
                        onClick={() => handleAddToCart(p)}
                        disabled={p.manage_stock && p.stock === 0}
                      >
                        Add
                      </ThemedButton>
                    </div>
                  </CardContent>
                </ThemedCard>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
