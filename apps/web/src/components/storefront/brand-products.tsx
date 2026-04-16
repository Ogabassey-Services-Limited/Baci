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
import { getEffectiveStock } from '@/lib/product-stock';
import type { Product } from '@/lib/products';
import { getProductUrl } from '@/lib/seo-utils';
import { cn } from '@/lib/utils';

interface BrandProductsProps {
  /** Current product to find same-brand products for */
  product: Product;
  /** Maximum number of products to show (default: 4) */
  maxProducts?: number;
  /** Custom class name for the container */
  className?: string;
}

/**
 * Brand Products Component (Koray-aligned)
 *
 * Shows products from the SAME brand AND SAME category as the current product.
 * This follows Koray's semantic internal linking principle:
 * - Same category maintains topical focus
 * - Same brand builds brand entity authority
 * - Clear anchor text: "More [Brand] [Category]"
 */
export function BrandProducts({
  product,
  maxProducts = 4,
  className,
}: BrandProductsProps) {
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant ?? null;
  const basePath = merchantContext?.basePath || '';
  const { formatCurrency } = useCurrency();
  const { addToCart } = useCart();
  const { toast } = useToast();

  // Helper to prepend merchant basePath to product URL
  const getFullProductUrl = (p: Product): string => {
    const productUrl = getProductUrl(p);
    return basePath ? `${basePath}${productUrl}` : productUrl;
  };

  const [brandProducts, setBrandProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Derive brand and category from current product
  const productBrand = product.brand;
  const categoriesName = product.categories?.name;
  const categoryFallback = product.category;
  const productCategory = categoriesName || categoryFallback || '';
  const categoriesSlug = product.categories?.slug;
  const categorySlugFallback = product.category_slug;
  const categorySlug =
    categoriesSlug || categorySlugFallback || productCategory.toLowerCase();

  useEffect(() => {
    // Skip if no merchant, no brand, or no category
    if (!merchant?.id || !productBrand || !productCategory) {
      setBrandProducts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Fetch products from the same category and brand using the storefront
    // API so web behavior matches the mobile filter path.
    apiGet<{ products: Product[] }>(
      `/api/storefront/products?merchant_id=${merchant.id}&category=${encodeURIComponent(categorySlug)}&brand=${encodeURIComponent(productBrand)}`
    )
      .then((data) => {
        if (data.products) {
          const sameBrand = data.products.filter(
            (p) => p.id !== product.id && p.status === 'active'
          );
          setBrandProducts(sameBrand.slice(0, maxProducts));
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch brand products:', err);
        setBrandProducts([]);
        setIsLoading(false);
      });
  }, [
    merchant?.id,
    product.id,
    productBrand,
    categorySlug,
    productCategory,
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
    const container = document.getElementById('brand-products-scroll');
    if (!container) return;

    const scrollAmount = 300;
    const newPosition =
      direction === 'left'
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;

    container.scrollTo({ left: newPosition, behavior: 'smooth' });
    setScrollPosition(newPosition);
  };

  // Don't render if no brand products found
  if (!isLoading && brandProducts.length === 0) {
    return null;
  }

  // Don't render if product has no brand
  if (!productBrand) {
    return null;
  }

  const isOutOfStock = (p: Product) =>
    (p.manage_stock ?? true) && getEffectiveStock(p) <= 0;

  // Semantic heading: "More [Brand] [Category]"
  const title = `More ${productBrand} ${productCategory}`;

  return (
    <section className={cn('w-full py-8 md:py-12', className)}>
      <div className="container px-4 md:px-6">
        {/* Header with semantic title */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {title}
          </h2>

          {brandProducts.length > 3 && (
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
            id="brand-products-scroll"
            className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
          >
            {brandProducts
              .filter((p) => p.imageLarge || p.image)
              .map((p) => (
                <ThemedCard
                  key={p.id}
                  className="flex-shrink-0 w-[200px] sm:w-[260px] overflow-hidden hover:shadow-lg transition-shadow snap-start"
                  accentPosition="top"
                >
                  <Link
                    href={getFullProductUrl(p) as '/'}
                    className="block relative"
                  >
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
                    <Link href={getFullProductUrl(p) as '/'}>
                      <h3 className="font-medium text-sm line-clamp-2 hover:text-[var(--store-primary)] transition-colors">
                        {p.name}
                      </h3>
                    </Link>
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
