'use client';

import { ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ThemedButton, ThemedCard } from '@/components/themed';
import { CardContent } from '@/components/ui/card';
import { useCart } from '@/hooks/use-cart';
import { useCurrency } from '@/hooks/use-currency';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { useRecentlyViewed } from '@/hooks/use-recently-viewed';
import { useToast } from '@/hooks/use-toast';
import { apiGet } from '@/lib/api-client';
import { getEffectiveStock } from '@/lib/product-stock';
import type { Product } from '@/lib/products';
import { getProductUrl } from '@/lib/seo-utils';
import { cn } from '@/lib/utils';

interface RecentlyViewedProductsProps {
  /** Current product ID to exclude from the list */
  excludeProductId?: string;
  /** Maximum number of products to show (default: 6) */
  maxProducts?: number;
  /** Section title (default: "Recently Viewed") */
  title?: string;
  /** Show navigation arrows (default: true) */
  showNavigation?: boolean;
  /** Custom class name for the container */
  className?: string;
}

export function RecentlyViewedProducts({
  excludeProductId,
  maxProducts = 6,
  title = 'Recently Viewed',
  showNavigation = true,
  className,
}: RecentlyViewedProductsProps) {
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant ?? null;
  const { recentlyViewedIds } = useRecentlyViewed({
    excludeProductId,
    maxItems: maxProducts + 1, // +1 to account for possible exclusion
  });

  const { formatCurrency } = useCurrency();
  const { addToCart } = useCart();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Fetch products by IDs
  useEffect(() => {
    if (!merchant?.id || recentlyViewedIds.length === 0) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Fetch products by IDs
    const idsParam = recentlyViewedIds.slice(0, maxProducts).join(',');
    apiGet<{ products: Product[] }>(
      `/api/storefront/products?merchant_id=${merchant.id}&ids=${idsParam}`
    )
      .then((data) => {
        if (data.products) {
          // Sort products to match the order in recentlyViewedIds
          const productMap = new Map(data.products.map((p) => [p.id, p]));
          const orderedProducts = recentlyViewedIds
            .map((id) => productMap.get(id))
            .filter((p): p is Product => !!p && p.status === 'active')
            .slice(0, maxProducts);
          setProducts(orderedProducts);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch recently viewed products:', err);
        setProducts([]);
        setIsLoading(false);
      });
  }, [merchant?.id, recentlyViewedIds, maxProducts]);

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    toast({
      title: 'Added to cart',
      description: `${product.name} has been added to your cart.`,
    });
  };

  const scrollContainer = (direction: 'left' | 'right') => {
    const container = document.getElementById('recently-viewed-scroll');
    if (!container) return;

    const scrollAmount = 300; // px to scroll
    const newPosition =
      direction === 'left'
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;

    container.scrollTo({ left: newPosition, behavior: 'smooth' });
    setScrollPosition(newPosition);
  };

  // Don't render if no recently viewed products
  if (!isLoading && products.length === 0) {
    return null;
  }

  const isOutOfStock = (product: Product) =>
    product.manage_stock !== false && getEffectiveStock(product) <= 0;

  return (
    <section className={cn('w-full py-8 md:py-12', className)}>
      <div className="container px-4 md:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Clock
              className="w-5 h-5 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              {title}
            </h2>
          </div>

          {showNavigation && products.length > 3 && (
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
            id="recently-viewed-scroll"
            className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
          >
            {products.map((product) => (
              <ThemedCard
                key={product.id}
                className="flex-shrink-0 w-[200px] sm:w-[240px] overflow-hidden hover:shadow-lg transition-shadow snap-start"
                accentPosition="top"
              >
                <Link href={getProductUrl(product)} className="block relative">
                  <Image
                    src={product.imageLarge || product.image}
                    alt={product.name}
                    data-ai-hint={product.imageHint}
                    width={240}
                    height={240}
                    className="object-cover w-full aspect-square"
                  />
                  {product.compare_at_price &&
                    product.compare_at_price > product.price && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                        SALE
                      </span>
                    )}
                </Link>
                <CardContent className="p-3">
                  <Link href={getProductUrl(product)}>
                    <h3 className="font-medium text-sm line-clamp-2 hover:text-[var(--store-primary)] transition-colors">
                      {product.name}
                    </h3>
                  </Link>
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <p
                        className="font-bold text-sm"
                        style={{ color: 'var(--store-primary)' }}
                      >
                        {formatCurrency(product.price)}
                      </p>
                      {product.compare_at_price &&
                        product.compare_at_price > product.price && (
                          <p className="text-xs text-muted-foreground line-through">
                            {formatCurrency(product.compare_at_price)}
                          </p>
                        )}
                    </div>
                    <ThemedButton
                      colorRole="primary"
                      size="sm"
                      className="text-xs px-2 py-1 h-7"
                      onClick={() => handleAddToCart(product)}
                      disabled={isOutOfStock(product)}
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
