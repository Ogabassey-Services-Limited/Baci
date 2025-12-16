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

type ComparisonType = 'brand' | 'price' | 'specs';

interface ComparisonProductsProps {
  /** Current product to compare with */
  product: Product;
  /** Type of comparison: 'brand', 'price', or 'specs' */
  type: ComparisonType;
  /** Maximum number of products to show (default: 4) */
  maxProducts?: number;
  /** Custom class name for the container */
  className?: string;
}

/**
 * Comparison Products Component (Koray-aligned)
 *
 * A unified component that shows semantically related products based on:
 * - brand: Same brand, same category (builds brand entity)
 * - price: Same category, similar price (supports comparison intent)
 * - specs: Same category, similar key specs (e.g., storage, RAM)
 *
 * All comparisons stay within the SAME category to maintain topical focus.
 * Headings are contextual I-nodes with clear semantic purpose.
 */
export function ComparisonProducts({
  product,
  type,
  maxProducts = 4,
  className,
}: ComparisonProductsProps) {
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant ?? null;
  const { formatCurrency } = useCurrency();
  const { addToCart } = useCart();
  const { toast } = useToast();

  const [comparisonProducts, setComparisonProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Derive product attributes
  const productBrand = product.brand;
  const productCategory =
    (product as any).categories?.name || (product as any).category || '';
  const categorySlug =
    (product as any).categories?.slug ||
    (product as any).category_slug ||
    productCategory.toLowerCase();
  const productPrice = product.price;

  // Get specs from product for specs-based comparison
  const productSpecs = (product as any).specifications || {};

  useEffect(() => {
    if (!merchant?.id || !productCategory) {
      setComparisonProducts([]);
      setIsLoading(false);
      return;
    }

    // For brand comparison, we need a brand
    if (type === 'brand' && !productBrand) {
      setComparisonProducts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Build query params based on comparison type
    const params = new URLSearchParams({
      merchant_id: merchant.id,
      category: categorySlug,
    });

    // For price comparison, add price range
    if (type === 'price') {
      const tolerance = 0.15; // 15%
      params.set(
        'min_price',
        Math.floor(productPrice * (1 - tolerance)).toString()
      );
      params.set(
        'max_price',
        Math.ceil(productPrice * (1 + tolerance)).toString()
      );
    }

    apiGet<{ products: Product[] }>(`/api/storefront/products?${params}`)
      .then((data) => {
        if (data.products) {
          let filtered = data.products.filter(
            (p) => p.id !== product.id && p.status === 'active'
          );

          // Apply type-specific filtering
          switch (type) {
            case 'brand':
              filtered = filtered.filter(
                (p) =>
                  p.brand &&
                  p.brand.toLowerCase() === productBrand?.toLowerCase()
              );
              break;

            case 'price':
              // Already filtered by API, sort by price proximity
              filtered.sort(
                (a, b) =>
                  Math.abs(a.price - productPrice) -
                  Math.abs(b.price - productPrice)
              );
              break;

            case 'specs':
              // Filter by similar key specs (storage, RAM, etc.)
              // For now, we'll match on brand OR similar price as a proxy for specs
              // TODO: Implement proper spec matching when product_key_specs is populated
              filtered = filtered.filter((p) => {
                const pSpecs = (p as any).specifications || {};
                // Check if any common specs match
                const hasMatchingSpec = Object.keys(productSpecs).some(
                  (key) =>
                    pSpecs[key] !== undefined &&
                    pSpecs[key] === productSpecs[key]
                );
                // Fallback: same brand or similar price
                const sameBrand =
                  p.brand?.toLowerCase() === productBrand?.toLowerCase();
                const similarPrice =
                  Math.abs(p.price - productPrice) / productPrice < 0.3;
                return hasMatchingSpec || sameBrand || similarPrice;
              });
              break;
          }

          setComparisonProducts(filtered.slice(0, maxProducts));
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(`Failed to fetch ${type} comparison products:`, err);
        setComparisonProducts([]);
        setIsLoading(false);
      });
  }, [
    merchant?.id,
    product.id,
    type,
    productBrand,
    productCategory,
    categorySlug,
    productPrice,
    productSpecs,
    maxProducts,
  ]);

  const handleAddToCart = (p: Product) => {
    addToCart(p);
    toast({
      title: 'Added to cart',
      description: `${p.name} has been added to your cart.`,
    });
  };

  const scrollContainer = (direction: 'left' | 'right') => {
    const containerId = `comparison-products-${type}-scroll`;
    const container = document.getElementById(containerId);
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
  if (!isLoading && comparisonProducts.length === 0) {
    return null;
  }

  // Generate semantic title based on comparison type
  const getTitle = () => {
    switch (type) {
      case 'brand':
        return `More ${productBrand} ${productCategory}`;
      case 'price': {
        const minPrice = Math.floor(productPrice * 0.85);
        const maxPrice = Math.ceil(productPrice * 1.15);
        if (minPrice < 10000) {
          return `${productCategory} Under ${formatCurrency(maxPrice)}`;
        }
        return `${productCategory} ${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`;
      }
      case 'specs':
        return `Compare Similar ${productCategory}`;
      default:
        return `Related ${productCategory}`;
    }
  };

  const title = getTitle();
  const containerId = `comparison-products-${type}-scroll`;

  return (
    <section className={cn('w-full py-8 md:py-12', className)}>
      <div className="container px-4 md:px-6">
        {/* Header with semantic title */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {title}
          </h2>

          {comparisonProducts.length > 3 && (
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
            id={containerId}
            className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
          >
            {comparisonProducts
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
                    {type !== 'brand' && p.brand && (
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
