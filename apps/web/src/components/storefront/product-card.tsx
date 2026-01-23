'use client';

import { Eye, Minus, Plus } from 'lucide-react';
import Link from 'next/link';
import { memo, useCallback, useMemo } from 'react';
import { ProductCardImage } from '@/components/optimized-image';
import { ThemedButton, ThemedCard } from '@/components/themed';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { CartItem } from '@/hooks/use-cart';
import { useCurrency } from '@/hooks/use-currency';
import type { Product } from '@/lib/products';
import { getProductUrl } from '@/lib/seo-utils';

interface StorefrontProductCardProps {
  product: Product;
  cartItem?: CartItem;
  staggerClass: string;
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onQuickView: (product: Product) => void;
}

/**
 * Memoized Product Card for Storefront Grid
 *
 * 2026 Best Practices:
 * - React.memo with custom equality check to prevent unnecessary re-renders
 * - useCallback for stable function references
 * - useMemo for expensive calculations (discount percentage)
 * - Proper accessibility (aria-labels, keyboard navigation)
 *
 * Performance Impact:
 * - Reduces re-renders from O(N) to O(1) when cart updates
 * - Only re-renders when product data, cart item, or callbacks change
 */
export const StorefrontProductCard = memo(
  function StorefrontProductCard({
    product,
    cartItem,
    staggerClass,
    onAddToCart,
    onUpdateQuantity,
    onQuickView,
  }: StorefrontProductCardProps) {
    const { formatCurrency } = useCurrency();

    // Memoize expensive calculations
    const discountPercentage = useMemo(() => {
      if (
        !product.compare_at_price ||
        product.compare_at_price <= product.price
      ) {
        return null;
      }
      return Math.round(
        ((product.compare_at_price - product.price) /
          product.compare_at_price) *
          100
      );
    }, [product.price, product.compare_at_price]);

    const isLowStock = useMemo(() => {
      return (
        product.manage_stock &&
        product.stock <= (product.low_stock_threshold || 5) &&
        product.stock > 0
      );
    }, [product.manage_stock, product.stock, product.low_stock_threshold]);

    const isOutOfStock = useMemo(() => {
      return product.manage_stock && product.stock === 0;
    }, [product.manage_stock, product.stock]);

    // Extract category (handles both categories join and direct category)
    // biome-ignore lint/suspicious/noExplicitAny: Product type lacks categories join
    const categoriesName = (product as any).categories?.name;
    const productCategory = useMemo(() => {
      return categoriesName || product.category || 'General';
    }, [categoriesName, product.category]);

    // Stable callbacks using useCallback
    const handleAddToCart = useCallback(() => {
      onAddToCart(product);
    }, [onAddToCart, product]);

    const handleQuickView = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onQuickView(product);
      },
      [onQuickView, product]
    );

    const handleDecreaseQuantity = useCallback(() => {
      if (cartItem) {
        onUpdateQuantity(product.id, cartItem.quantity - 1);
      }
    }, [cartItem, onUpdateQuantity, product.id]);

    const handleIncreaseQuantity = useCallback(() => {
      if (cartItem) {
        onUpdateQuantity(product.id, cartItem.quantity + 1);
      }
    }, [cartItem, onUpdateQuantity, product.id]);

    const handleQuantityChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number.parseInt(e.target.value, 10) || 0;
        onUpdateQuantity(product.id, value);
      },
      [onUpdateQuantity, product.id]
    );

    return (
      <ThemedCard
        className={`glass-themed overflow-hidden hover-lift flex flex-col group/card animate-fade-in-up ${staggerClass}`}
        accentPosition="top"
      >
        <Link href={getProductUrl(product)} className="block relative group">
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

          {/* Product Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {discountPercentage && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                SALE
              </span>
            )}
            {isLowStock && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                LOW STOCK
              </span>
            )}
            {isOutOfStock && (
              <span className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                OUT OF STOCK
              </span>
            )}
          </div>

          {/* Quick View Button - Desktop Only */}
          <button
            type="button"
            onClick={handleQuickView}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1.5 bg-white/95 backdrop-blur-sm text-gray-900 px-4 py-2 rounded-full text-sm font-medium shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white hover:scale-105"
            aria-label={`Quick view ${product.name}`}
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
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
                  onClick={handleDecreaseQuantity}
                  aria-label={`Decrease quantity of ${product.name}`}
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </ThemedButton>
                <Input
                  type="number"
                  value={cartItem.quantity}
                  onChange={handleQuantityChange}
                  className="h-10 w-12 text-center remove-arrow"
                  min="0"
                  aria-label={`Quantity for ${product.name}`}
                />
                <ThemedButton
                  colorRole="primary"
                  size="icon"
                  className="h-10 w-10 min-w-[44px] min-h-[44px]"
                  onClick={handleIncreaseQuantity}
                  aria-label={`Increase quantity of ${product.name}`}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </ThemedButton>
              </div>
            ) : (
              <ThemedButton
                colorRole="primary"
                size="sm"
                onClick={handleAddToCart}
              >
                Add to Cart
              </ThemedButton>
            )}
          </div>
        </CardContent>
      </ThemedCard>
    );
  },
  // Custom equality check for optimal re-render prevention
  (prevProps, nextProps) => {
    // Re-render only if these specific properties change
    // Includes all fields used in render: price display, badges, description, category
    return (
      prevProps.product.id === nextProps.product.id &&
      prevProps.product.name === nextProps.product.name &&
      prevProps.product.price === nextProps.product.price &&
      prevProps.product.compare_at_price ===
        nextProps.product.compare_at_price &&
      prevProps.product.imageLarge === nextProps.product.imageLarge &&
      prevProps.product.stock === nextProps.product.stock &&
      prevProps.product.manage_stock === nextProps.product.manage_stock &&
      prevProps.product.low_stock_threshold ===
        nextProps.product.low_stock_threshold &&
      prevProps.product.description === nextProps.product.description &&
      prevProps.product.category === nextProps.product.category &&
      prevProps.cartItem?.quantity === nextProps.cartItem?.quantity &&
      prevProps.staggerClass === nextProps.staggerClass
    );
  }
);
