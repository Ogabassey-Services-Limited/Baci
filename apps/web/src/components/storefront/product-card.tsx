'use client';

import { Eye, Minus, Plus } from 'lucide-react';
import Link from 'next/link';
import { memo } from 'react';
import { ProductCardImage } from '@/components/optimized-image';
import { ThemedButton, ThemedCard } from '@/components/themed';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { CartItem } from '@/hooks/use-cart';
import type { Product } from '@/lib/products';
import { getProductUrl } from '@/lib/seo-utils';

interface StorefrontProductCardProps {
  product: Product;
  cartItem?: CartItem;
  staggerClass?: string;
  formatCurrency: (amount: number) => string;
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onOpenQuickView: (product: Product) => void;
}

export const StorefrontProductCard = memo(
  ({
    product,
    cartItem,
    staggerClass = '',
    formatCurrency,
    onAddToCart,
    onUpdateQuantity,
    onOpenQuickView,
  }: StorefrontProductCardProps) => {
    const productCategory =
      // biome-ignore lint/suspicious/noExplicitAny: Product type lacks categories join
      (product as any).categories?.name || product.category || 'General';

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
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenQuickView(product);
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
                  colorRole="primary"
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 min-w-[44px] min-h-[44px]"
                  onClick={() =>
                    onUpdateQuantity(product.id, cartItem.quantity - 1)
                  }
                  aria-label={`Decrease quantity of ${product.name}`}
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </ThemedButton>
                <Input
                  type="number"
                  value={cartItem.quantity}
                  onChange={(e) =>
                    onUpdateQuantity(
                      product.id,
                      Number.parseInt(e.target.value, 10) || 0
                    )
                  }
                  className="h-10 w-12 text-center remove-arrow"
                  min="0"
                  aria-label={`Quantity for ${product.name}`}
                />
                <ThemedButton
                  colorRole="primary"
                  size="icon"
                  className="h-10 w-10 min-w-[44px] min-h-[44px]"
                  onClick={() =>
                    onUpdateQuantity(product.id, cartItem.quantity + 1)
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
                onClick={() => onAddToCart(product)}
              >
                Add to Cart
              </ThemedButton>
            )}
          </div>
        </CardContent>
      </ThemedCard>
    );
  }
);

StorefrontProductCard.displayName = 'StorefrontProductCard';
