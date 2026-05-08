'use client';

/**
 * @deprecated Use BrandProducts or PriceRangeProducts instead.
 *
 * This component is deprecated in favor of Koray-aligned semantic alternatives:
 * - BrandProducts: Same brand, same category (builds brand entity)
 * - PriceRangeProducts: Same category, similar price (supports comparison intent)
 * - ComparisonProducts: Unified component for different comparison types
 *
 * The new components follow Koray GÜBÜR's holistic SEO framework:
 * - Contextual I-node links with clear semantic purpose
 * - Same category focus to maintain topical authority
 * - Clear anchor text patterns: "More [Brand] [Category]", "[Category] ₦X-₦Y"
 *
 * @see src/components/storefront/brand-products.tsx
 * @see src/components/storefront/price-range-products.tsx
 * @see src/components/storefront/comparison-products.tsx
 */

import { ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';
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
import { getEffectiveStock } from '@/lib/product-stock';
import type { Product } from '@/lib/products';
import { getProductUrl } from '@/lib/seo-utils';
import { cn } from '@/lib/utils';

interface RelatedProductsProps {
  /** Current product to find related products for */
  product: Product;
  /** Maximum number of products to show (default: 4) */
  maxProducts?: number;
  /** Section title (default: "You Might Also Like") */
  title?: string;
  /** Show navigation arrows (default: true) */
  showNavigation?: boolean;
  /** Custom class name for the container */
  className?: string;
}

/**
 * Related Products Component
 *
 * Shows products related to the current product based on:
 * 1. Same category (primary match)
 * 2. Same brand (secondary match)
 * 3. Similar price range (tertiary match)
 *
 * Architecture is ready for future vector-based similarity search.
 */
export function RelatedProducts({
  product,
  maxProducts = 4,
  title = 'You Might Also Like',
  showNavigation = true,
  className,
}: RelatedProductsProps) {
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant ?? null;
  const { formatCurrency } = useCurrency();
  const { addToCart } = useCart();
  const { toast } = useToast();

  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    if (!merchant?.id || !product) {
      setRelatedProducts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Fetch all products, then filter client-side for related ones
    // In future, this could be replaced with a dedicated /api/products/related endpoint
    // that uses vector similarity search
    apiGet<{ products: Product[] }>(
      `/api/storefront/products?merchant_id=${merchant.id}`
    )
      .then((data) => {
        if (data.products) {
          const related = findRelatedProducts(
            product,
            data.products,
            maxProducts
          );
          setRelatedProducts(related);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch related products:', err);
        setRelatedProducts([]);
        setIsLoading(false);
      });
  }, [merchant?.id, product, maxProducts]);

  const handleAddToCart = (p: Product) => {
    addToCart(p);
    toast({
      title: 'Added to cart',
      description: `${p.name} has been added to your cart.`,
    });
  };

  const scrollContainer = (direction: 'left' | 'right') => {
    const container = document.getElementById('related-products-scroll');
    if (!container) return;

    const scrollAmount = 300;
    const newPosition =
      direction === 'left'
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;

    container.scrollTo({ left: newPosition, behavior: 'smooth' });
    setScrollPosition(newPosition);
  };

  // Don't render if no related products
  if (!isLoading && relatedProducts.length === 0) {
    return null;
  }

  const isOutOfStock = (p: Product) =>
    p.manage_stock !== false && getEffectiveStock(p) <= 0;

  return (
    <section className={cn('w-full py-8 md:py-12', className)}>
      <div className="container px-4 md:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles
              className="w-5 h-5 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              {title}
            </h2>
          </div>

          {showNavigation && relatedProducts.length > 3 && (
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
            id="related-products-scroll"
            className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
          >
            {relatedProducts
              .filter((p) => p.imageLarge || p.image)
              .map((p) => (
                <ThemedCard
                  key={p.id}
                  className="shrink-0 w-[200px] sm:w-[260px] overflow-hidden hover:shadow-lg transition-shadow snap-start"
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
                      <h3 className="font-medium text-sm line-clamp-2 hover:text-(--store-primary) transition-colors">
                        {p.name}
                      </h3>
                    </Link>
                    {(p.categories?.name || p.category) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.categories?.name || p.category}
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
                        disabled={isOutOfStock(p)}
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

/**
 * Find related products based on category, brand, and price similarity
 *
 * Scoring algorithm:
 * - Same category: +10 points
 * - Same brand: +5 points
 * - Similar price (within 30%): +3 points
 * - Similar price (within 50%): +1 point
 *
 * This is a simple algorithm that can be replaced with vector similarity
 * search in the future by calling a dedicated API endpoint.
 */
function findRelatedProducts(
  currentProduct: Product,
  allProducts: Product[],
  maxResults: number
): Product[] {
  // Filter out the current product and inactive products
  const candidates = allProducts.filter(
    (p) => p.id !== currentProduct.id && p.status === 'active'
  );

  if (candidates.length === 0) return [];

  // Score each product
  const scored = candidates.map((p) => {
    let score = 0;

    // Category match (highest priority)
    if (
      p.category &&
      currentProduct.category &&
      p.category === currentProduct.category
    ) {
      score += 10;
    }

    // Brand match
    if (p.brand && currentProduct.brand && p.brand === currentProduct.brand) {
      score += 5;
    }

    // Price similarity
    const priceDiff =
      Math.abs(p.price - currentProduct.price) / currentProduct.price;
    if (priceDiff <= 0.3) {
      score += 3;
    } else if (priceDiff <= 0.5) {
      score += 1;
    }

    return { product: p, score };
  });

  // Sort by score (highest first), then by name for consistency
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.product.name.localeCompare(b.product.name);
  });

  // Return top results (only those with score > 0, fallback to random if none)
  const withScore = scored.filter((s) => s.score > 0);

  if (withScore.length > 0) {
    return withScore.slice(0, maxResults).map((s) => s.product);
  }

  // Fallback: return random products if no good matches
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, maxResults);
}
