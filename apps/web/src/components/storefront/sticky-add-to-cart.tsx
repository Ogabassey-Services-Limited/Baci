'use client';

import { ChevronUp, ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ThemedButton } from '@/components/themed';
import { QuantityButton } from '@/components/ui/animated-icons';
import { useCart } from '@/hooks/use-cart';
import { useCurrency } from '@/hooks/use-currency';
import { useToast } from '@/hooks/use-toast';
import type { Product, ProductVariant } from '@/lib/products';
import { cn } from '@/lib/utils';

interface StickyAddToCartProps {
  /** Product to add to cart */
  product: Product;
  /** Selected variant (for products with variants) */
  selectedVariant?: ProductVariant | null;
  /** Selected variant attributes */
  selectedAttributes?: Record<string, string>;
  /** Selected condition for offer-driven or conditioned variant products */
  selectedCondition?: string;
  /** Selected display price for the current condition / variant */
  selectedPrice?: number;
  /** Minimum distance from top before showing (default: 400px) */
  showAfterScroll?: number;
  /** Custom class name */
  className?: string;
}

/**
 * Sticky Add-to-Cart Component (Mobile Only)
 *
 * Shows a fixed bottom bar on mobile devices when the user scrolls
 * past the main add-to-cart button, allowing them to add the product
 * to cart from anywhere on the page.
 *
 * Features:
 * - Only shows on mobile (< 768px)
 * - Appears after scrolling past threshold
 * - Shows product name, price, and quantity controls
 * - Animates in/out smoothly
 * - Includes scroll-to-top button
 */
export function StickyAddToCart({
  product,
  selectedVariant,
  selectedAttributes,
  selectedCondition,
  selectedPrice,
  showAfterScroll = 400,
  className,
}: StickyAddToCartProps) {
  const { formatCurrency } = useCurrency();
  const { cart, addToCart, updateQuantity } = useCart();
  const { toast } = useToast();

  const [isVisible, setIsVisible] = useState(false);
  const [quantity, setQuantity] = useState(product.minimum_order_quantity || 1);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile and handle scroll
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    const handleScroll = () => {
      if (window.innerWidth < 768) {
        setIsVisible(window.scrollY > showAfterScroll);
      }
    };

    // Initial check
    checkMobile();
    handleScroll();

    window.addEventListener('resize', checkMobile);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [showAfterScroll]);

  // Don't render on desktop
  if (!isMobile) return null;

  // Find cart item matching product and variant
  const cartItem = cart.find((item) => {
    if (selectedVariant) {
      return item.id === product.id && item.variantId === selectedVariant.id;
    }
    return (
      item.id === product.id &&
      !item.variantId &&
      (item.condition ?? undefined) === (selectedCondition ?? undefined)
    );
  });

  // Get current price and stock based on variant selection
  const currentPrice =
    selectedPrice ?? selectedVariant?.price_override ?? product.price;
  const currentStock = selectedVariant?.stock_quantity ?? product.stock;
  const isOutOfStock = product.manage_stock && currentStock === 0;

  const handleQuantityChange = (newQuantity: number) => {
    const moq = product.minimum_order_quantity || 1;
    if (newQuantity >= moq) {
      setQuantity(newQuantity);
    }
  };

  const handleAddToCart = () => {
    const productToAdd =
      selectedVariant || selectedCondition
        ? { ...product, price: currentPrice }
        : product;

    addToCart(
      productToAdd,
      quantity,
      selectedVariant
        ? {
            condition: selectedCondition,
            variantId: selectedVariant.id,
            variantAttributes: selectedAttributes || {},
          }
        : selectedCondition
          ? { condition: selectedCondition }
          : undefined
    );

    const variantInfo = selectedVariant
      ? ` (${Object.values(selectedAttributes || {}).join(', ')})`
      : '';

    toast({
      title: 'Added to cart',
      description: `${quantity} x ${product.name}${variantInfo} has been added to your cart.`,
    });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 md:hidden',
        'transform transition-transform duration-300 ease-in-out',
        isVisible ? 'translate-y-0' : 'translate-y-full',
        className
      )}
    >
      {/* Scroll to top button */}
      <button
        type="button"
        onClick={scrollToTop}
        className={cn(
          'absolute -top-12 right-4 w-10 h-10 rounded-full',
          'bg-white shadow-lg border flex items-center justify-center',
          'transition-opacity duration-200',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-5 h-5" />
      </button>

      {/* Sticky bar */}
      <div className="bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] safe-area-bottom">
        <div className="container px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{product.name}</p>
              <p
                className="font-bold text-lg"
                style={{ color: 'var(--store-primary)' }}
              >
                {formatCurrency(currentPrice)}
              </p>
            </div>

            {/* Cart Controls */}
            {cartItem ? (
              <div className="flex items-center gap-2">
                <QuantityButton
                  type="minus"
                  onClick={() =>
                    updateQuantity(
                      cartItem.cartItemId ?? product.id,
                      cartItem.quantity - 1,
                      selectedVariant?.id
                    )
                  }
                  disabled={cartItem.quantity <= 1}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full"
                />
                <span className="w-8 text-center font-medium">
                  {cartItem.quantity}
                </span>
                <QuantityButton
                  type="plus"
                  onClick={() =>
                    updateQuantity(
                      cartItem.cartItemId ?? product.id,
                      cartItem.quantity + 1,
                      selectedVariant?.id
                    )
                  }
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Quantity selector */}
                <div className="flex items-center gap-1">
                  <QuantityButton
                    type="minus"
                    onClick={() => handleQuantityChange(quantity - 1)}
                    disabled={quantity <= (product.minimum_order_quantity || 1)}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full"
                  />
                  <span className="w-6 text-center text-sm font-medium">
                    {quantity}
                  </span>
                  <QuantityButton
                    type="plus"
                    onClick={() => handleQuantityChange(quantity + 1)}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full"
                  />
                </div>

                {/* Add to Cart button */}
                <ThemedButton
                  colorRole="primary"
                  size="sm"
                  className="gap-1.5 px-4"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                >
                  <ShoppingCart className="w-4 h-4" />
                  {isOutOfStock ? 'Out of Stock' : 'Add'}
                </ThemedButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
