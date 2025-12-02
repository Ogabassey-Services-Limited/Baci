'use client';

import { Check, ExternalLink, Minus, Plus, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ThemedBadge, ThemedButton } from '@/components/themed';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/hooks/use-cart';
import { useCurrency } from '@/hooks/use-currency';
import { useToast } from '@/hooks/use-toast';
import type { Product, ProductVariant } from '@/lib/products';
import { getProductUrl } from '@/lib/seo-utils';
import { cn } from '@/lib/utils';

interface QuickViewModalProps {
  /** Product to display */
  product: Product | null;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
}

/**
 * Quick View Modal Component
 *
 * Allows customers to quickly preview product details and add to cart
 * without navigating to the full product page. Shows on desktop only.
 *
 * Features:
 * - Image gallery with thumbnails
 * - Variant selection (color, size, etc.)
 * - Quantity selector
 * - Add to cart functionality
 * - Link to full product page
 */
export function QuickViewModal({
  product,
  isOpen,
  onClose,
}: QuickViewModalProps) {
  const { formatCurrency } = useCurrency();
  const { addToCart } = useCart();
  const { toast } = useToast();

  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    null
  );
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >({});

  // Reset state when product changes
  useEffect(() => {
    if (product) {
      setQuantity(product.minimum_order_quantity || 1);
      setSelectedImage(product.imageLarge || product.image);
      setSelectedVariant(null);
      setSelectedAttributes({});

      // Auto-select first variant if product has variants
      if (
        product.has_variants &&
        product.variants &&
        product.variants.length > 0
      ) {
        const firstVariant = product.variants[0];
        setSelectedVariant(firstVariant);
        setSelectedAttributes(firstVariant.attributes);
        if (firstVariant.primary_image) {
          setSelectedImage(firstVariant.primary_image);
        }
      }
    }
  }, [product]);

  if (!product) return null;

  // Get all unique attribute types and values
  const attributeOptions = getAttributeOptions(product.variants || []);

  // Get current price (variant price override or base price)
  const currentPrice = selectedVariant?.price_override ?? product.price;
  const currentStock = selectedVariant?.stock_quantity ?? product.stock;
  const isOutOfStock = product.manage_stock && currentStock === 0;

  const handleAttributeChange = (attributeKey: string, value: string) => {
    const newAttributes = { ...selectedAttributes, [attributeKey]: value };
    setSelectedAttributes(newAttributes);

    // Find matching variant
    if (product.variants) {
      const matchingVariant = product.variants.find((v) =>
        Object.entries(newAttributes).every(
          ([key, val]) => v.attributes[key] === val
        )
      );

      if (matchingVariant) {
        setSelectedVariant(matchingVariant);
        if (matchingVariant.primary_image) {
          setSelectedImage(matchingVariant.primary_image);
        }
      }
    }
  };

  const handleQuantityChange = (newQuantity: number) => {
    const moq = product.minimum_order_quantity || 1;
    if (newQuantity >= moq) {
      setQuantity(newQuantity);
    } else {
      setQuantity(moq);
    }
  };

  const handleAddToCart = () => {
    // Create a product object with variant info if applicable
    const productToAdd = selectedVariant
      ? {
          ...product,
          price: currentPrice,
          variantId: selectedVariant.id,
          variantAttributes: selectedAttributes,
        }
      : product;

    addToCart(productToAdd as Product, quantity);
    toast({
      title: 'Added to cart',
      description: `${quantity} x ${product.name} has been added to your cart.`,
    });
    onClose();
  };

  // Get all images (main + additional)
  const allImages = [
    { url: product.imageLarge || product.image, alt: product.name },
    ...(product.images || []),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid md:grid-cols-2 gap-0">
          {/* Image Section */}
          <div className="p-6 bg-muted/30">
            <div className="aspect-square relative rounded-lg overflow-hidden bg-white">
              <Image
                src={selectedImage}
                alt={product.name}
                fill
                className="object-contain"
                priority
              />
              {product.compare_at_price &&
                product.compare_at_price > currentPrice && (
                  <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                    SALE
                  </span>
                )}
            </div>

            {/* Thumbnail Gallery */}
            {allImages.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {allImages.map((img, idx) => (
                  <button
                    type="button"
                    // biome-ignore lint/suspicious/noArrayIndexKey: Order doesn't matter for display
                    key={idx}
                    onClick={() => setSelectedImage(img.url)}
                    className={cn(
                      'relative w-16 h-16 rounded-md overflow-hidden border-2 flex-shrink-0',
                      selectedImage === img.url
                        ? 'border-[var(--store-primary)]'
                        : 'border-transparent hover:border-muted-foreground/30'
                    )}
                  >
                    <Image
                      src={img.url}
                      alt={img.alt || `Product image ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details Section */}
          <div className="p-6 flex flex-col">
            <DialogHeader className="text-left mb-4">
              <DialogTitle
                className="text-2xl font-bold"
                style={{ color: 'var(--store-primary)' }}
              >
                {product.name}
              </DialogTitle>
              {product.sku && (
                <p className="text-sm text-muted-foreground">
                  SKU: {product.sku}
                </p>
              )}
            </DialogHeader>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-4">
              <span
                className="text-2xl font-bold"
                style={{ color: 'var(--store-secondary)' }}
              >
                {formatCurrency(currentPrice)}
              </span>
              {product.compare_at_price &&
                product.compare_at_price > currentPrice && (
                  <span className="text-lg text-muted-foreground line-through">
                    {formatCurrency(product.compare_at_price)}
                  </span>
                )}
            </div>

            {/* Description */}
            <p className="text-muted-foreground mb-6 line-clamp-3">
              {product.description}
            </p>

            {/* Variant Selection */}
            {product.has_variants && attributeOptions.length > 0 && (
              <div className="space-y-4 mb-6">
                {attributeOptions.map(({ key, values }) => (
                  <div key={key}>
                    <Label className="text-sm font-medium mb-2 block capitalize">
                      {key}:{' '}
                      <span className="font-normal">
                        {selectedAttributes[key]}
                      </span>
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {values.map((value) => {
                        const isSelected = selectedAttributes[key] === value;
                        // Check if this option is available
                        const isAvailable = isVariantAvailable(
                          product.variants || [],
                          { ...selectedAttributes, [key]: value }
                        );

                        return (
                          <button
                            type="button"
                            key={value}
                            onClick={() => handleAttributeChange(key, value)}
                            disabled={!isAvailable}
                            className={cn(
                              'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                              isSelected
                                ? 'bg-[var(--store-primary)] text-[var(--store-primary-text)] ring-2 ring-[var(--store-primary)] ring-offset-2'
                                : isAvailable
                                  ? 'bg-muted hover:bg-muted/80'
                                  : 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed line-through'
                            )}
                          >
                            {isSelected && (
                              <Check className="w-3 h-3 inline mr-1" />
                            )}
                            {value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Stock Status */}
            <div className="mb-4">
              {isOutOfStock ? (
                <ThemedBadge colorRole="primary" variant="destructive">
                  Out of Stock
                </ThemedBadge>
              ) : (
                <ThemedBadge colorRole="primary" variant="outline">
                  In Stock
                </ThemedBadge>
              )}
              {product.manage_stock &&
                currentStock > 0 &&
                currentStock <= (product.low_stock_threshold || 5) && (
                  <span className="ml-2 text-sm text-amber-600">
                    Only {currentStock} left
                  </span>
                )}
            </div>

            {/* Quantity and Add to Cart */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center">
                <ThemedButton
                  colorRole="accent"
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 rounded-r-none"
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= (product.minimum_order_quantity || 1)}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </ThemedButton>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) =>
                    handleQuantityChange(
                      Number.parseInt(e.target.value, 10) || 1
                    )
                  }
                  className="h-10 w-16 text-center rounded-none border-x-0 remove-arrow"
                  min={product.minimum_order_quantity || 1}
                  aria-label="Quantity"
                />
                <ThemedButton
                  colorRole="accent"
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 rounded-l-none"
                  onClick={() => handleQuantityChange(quantity + 1)}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </ThemedButton>
              </div>
              <ThemedButton
                colorRole="primary"
                size="lg"
                className="flex-1"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
              >
                Add to Cart
              </ThemedButton>
            </div>

            {/* Link to Full Product Page */}
            <Link
              href={getProductUrl(product)}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={onClose}
            >
              View Full Details
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Extract unique attribute types and their values from variants
 */
function getAttributeOptions(
  variants: ProductVariant[]
): { key: string; values: string[] }[] {
  const attributeMap = new Map<string, Set<string>>();

  for (const variant of variants) {
    for (const [key, value] of Object.entries(variant.attributes)) {
      if (!attributeMap.has(key)) {
        attributeMap.set(key, new Set());
      }
      attributeMap.get(key)?.add(value);
    }
  }

  return Array.from(attributeMap.entries()).map(([key, values]) => ({
    key,
    values: Array.from(values).sort(),
  }));
}

/**
 * Check if a variant with given attributes exists and has stock
 */
function isVariantAvailable(
  variants: ProductVariant[],
  partialAttributes: Record<string, string>
): boolean {
  return variants.some((variant) => {
    const matches = Object.entries(partialAttributes).every(
      ([key, value]) => variant.attributes[key] === value
    );
    return matches && variant.stock_quantity > 0;
  });
}

/**
 * Hook to manage quick view state
 */
export function useQuickView() {
  const [product, setProduct] = useState<Product | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openQuickView = (p: Product) => {
    setProduct(p);
    setIsOpen(true);
  };

  const closeQuickView = () => {
    setIsOpen(false);
    // Delay clearing product to allow close animation
    setTimeout(() => setProduct(null), 300);
  };

  return {
    product,
    isOpen,
    openQuickView,
    closeQuickView,
  };
}
