'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/hooks/use-currency';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/lib/products';
import { ThemedButton } from '@/components/themed';
import { ShoppingCart, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuantityButton } from '@/components/ui/animated-icons';

interface StickyAddToCartProps {
  /** Product to add to cart */
  product: Product;
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

  const cartItem = cart.find((item) => item.id === product.id);
  const isOutOfStock = product.manage_stock && product.stock === 0;

  const handleQuantityChange = (newQuantity: number) => {
    const moq = product.minimum_order_quantity || 1;
    if (newQuantity >= moq) {
      setQuantity(newQuantity);
    }
  };

  const handleAddToCart = () => {
    addToCart(product, quantity);
    toast({
      title: 'Added to cart',
      description: `${quantity} x ${product.name} has been added to your cart.`,
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
                {formatCurrency(product.price)}
              </p>
            </div>

            {/* Cart Controls */}
            {cartItem ? (
              <div className="flex items-center gap-2">
                <QuantityButton
                  type="minus"
                  onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                  disabled={cartItem.quantity <= 1}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full"
                />
                <span className="w-8 text-center font-medium">{cartItem.quantity}</span>
                <QuantityButton
                  type="plus"
                  onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
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
                  <span className="w-6 text-center text-sm font-medium">{quantity}</span>
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
