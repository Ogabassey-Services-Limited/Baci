'use client';
// Template preview

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  ShoppingCart,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { Product } from '../types';
import { getProductUrl } from '@/lib/seo-utils';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';

/**
 * Safely strips HTML tags from a string using iterative approach
 * to prevent bypass via nested tags like <<script>script>
 */
function stripHtml(html: string): string {
  if (!html) return '';
  let result = html;
  let prev = '';
  while (result !== prev) {
    prev = result;
    result = result.replace(/<[^>]*>/g, '');
  }
  return result;
}

interface ProductGridItemProps {
  product: Product;
  onAddToCart: (e: React.MouseEvent, product: Product) => void;
  isAdded: boolean;
  cartQuantity?: number;
  viewMode?: 'grid' | 'list';
  isWishlisted: boolean;
  onToggleWishlist: (e: React.MouseEvent) => void;
  storeSlug?: string;
}

export const ProductGridItem: React.FC<ProductGridItemProps> = ({
  product,
  onAddToCart,
  isAdded,
  cartQuantity = 0,
  viewMode = 'grid',
  isWishlisted,
  onToggleWishlist,
  storeSlug,
}) => {
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath || '';

  // Use slightly larger icons in the mobile list feed
  const iconSize = viewMode === 'list' ? 22 : 18;

  // State to track selected color
  const [activeColorIndex, setActiveColorIndex] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Fallback placeholder for products without images
  const PLACEHOLDER_IMAGE =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"%3E%3Crect fill="%23f3f4f6" width="400" height="400"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="48" fill="%239ca3af"%3ENo Image%3C/text%3E%3C/svg%3E';

  // Determine current image: use the specific color image if available, otherwise fallback to main image or placeholder
  const currentImage =
    product.images?.[activeColorIndex] || product.image || PLACEHOLDER_IMAGE;

  // Reset loading state when image source changes
  useEffect(() => {
    setIsImageLoaded(false);
  }, []);

  const handlePrevColor = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.colors || product.colors.length === 0) return;
    const colorsLength = product.colors.length;
    setActiveColorIndex((prev) => (prev === 0 ? colorsLength - 1 : prev - 1));
  };

  const handleNextColor = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.colors || product.colors.length === 0) return;
    const colorsLength = product.colors.length;
    setActiveColorIndex((prev) => (prev === colorsLength - 1 ? 0 : prev + 1));
  };

  const handleColorSelect = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveColorIndex(index);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-3 md:p-4 shadow-sm md:hover:shadow-xl active:shadow-md active:scale-[0.99] transition-all duration-300 group flex flex-col h-full relative">
      <Link
        href={asRoute(`${basePath}${getProductUrl({ ...product, id: String(product.id) })}`)}
        className="absolute inset-0 z-0"
      >
        <span className="sr-only">
          {product.name} - {product.price}
        </span>
      </Link>

      {/* Image Container - Gray Box with Overlapping Button */}
      {/* overflow-visible needed for the button to hang off the edge */}
      <div className="relative aspect-square mb-3 md:mb-4 bg-gray-50 rounded-2xl flex items-center justify-center overflow-visible z-10 pointer-events-none">
        {/* Navigation Arrows (Transparent on Mobile, Glassy on Desktop) */}
        {product.colors && product.colors.length > 1 && (
          <>
            <button
              onClick={handlePrevColor}
              className="absolute -left-2 md:left-2 top-1/2 -translate-y-1/2 z-30 p-2 md:p-1.5 bg-transparent md:bg-white/40 md:backdrop-blur-md border-0 md:border md:border-white/50 rounded-full shadow-none md:shadow-sm text-gray-500 md:text-gray-700 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 md:hover:bg-white/60 hover:text-gray-900 pointer-events-auto active:scale-95 touch-manipulation"
              aria-label="Previous color"
            >
              <ChevronLeft size={24} className="md:w-[18px] md:h-[18px]" />
            </button>
            <button
              onClick={handleNextColor}
              className="absolute -right-2 md:right-2 top-1/2 -translate-y-1/2 z-30 p-2 md:p-1.5 bg-transparent md:bg-white/40 md:backdrop-blur-md border-0 md:border md:border-white/50 rounded-full shadow-none md:shadow-sm text-gray-500 md:text-gray-700 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 md:hover:bg-white/60 hover:text-gray-900 pointer-events-auto active:scale-95 touch-manipulation"
              aria-label="Next color"
            >
              <ChevronRight size={24} className="md:w-[18px] md:h-[18px]" />
            </button>
          </>
        )}

        {/* Skeleton Loader */}
        {!isImageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center z-0">
            <div className="w-2/3 h-2/3 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        )}

        <Image
          src={currentImage}
          alt={product.name}
          fill
          sizes="(max-width: 480px) 40vw, (max-width: 768px) 33vw, (max-width: 1200px) 25vw, 20vw"
          onLoad={() => setIsImageLoaded(true)}
          onError={(e) => {
            // Note: `next/image` handles fallbacks differently, usually via `blurDataURL` or state.
            // For now, simpler error handling or ensuring data is good is preferred.
            // If strictly needed, we'd switch src state. However, next/image validates src.
            setIsImageLoaded(true);
          }}
          className={`object-contain p-4 transition-all duration-500 z-10 ${isImageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        />

        {/* Condition Badge - Top Left */}
        {product.condition && (
          <div
            className={`absolute top-3 left-3 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shadow-sm z-10 whitespace-nowrap ${product.condition === 'New'
              ? 'bg-gray-900'
              : product.condition === 'Open Box'
                ? 'bg-indigo-600'
                : product.condition === 'New & Used'
                  ? 'bg-purple-600'
                  : product.condition === 'Multiple Conditions'
                    ? 'bg-[var(--store-primary)]'
                  : 'bg-stone-500'
              }`}
          >
            {product.condition}
          </div>
        )}

        {/* Platform Badging (Sony Style) - Bottom Left of Image */}
        {product.variant_attributes?.Platform && product.variant_attributes.Platform.length > 0 && (
          <div className="absolute bottom-2 left-3 flex gap-1 z-10 flex-wrap max-w-[70%]">
            {product.variant_attributes.Platform.slice(0, 3).map((platform) => (
              <span
                key={platform}
                className="bg-white/90 backdrop-blur-sm text-gray-900 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-gray-100 uppercase tracking-tighter"
              >
                {platform.replace('PlayStation ', 'PS').replace('Nintendo Switch', 'Switch')}
              </span>
            ))}
            {product.variant_attributes.Platform.length > 3 && (
              <span className="bg-white/90 backdrop-blur-sm text-gray-500 text-[9px] px-1 py-0.5 rounded">+</span>
            )}
          </div>
        )}

        {/* Colors Swatches - Bottom Middle - INTERACTIVE */}
        {product.colors && product.colors.length > 0 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center -space-x-1.5 z-20 pointer-events-auto">
            {product.colors.slice(0, 4).map((color, idx) => {
              const hexColor = typeof color === 'string'
                ? (color.startsWith('#') ? color : '#cccccc')
                : color.value;
              const isSelected = idx === activeColorIndex;
              return (
                <button
                  key={idx}
                  onClick={(e) => handleColorSelect(e, idx)}
                  className={`rounded-full border border-white shadow-sm transition-all duration-300 ease-out ${isSelected
                    ? 'w-4 h-4 ring-2 ring-gray-300 ring-offset-1 z-30 scale-110'
                    : 'w-3.5 h-3.5 hover:scale-110 hover:z-20 opacity-90 hover:opacity-100'
                    }`}
                  style={{ backgroundColor: hexColor }}
                  title={typeof color === 'string' ? color : color.name}
                  aria-label={`Select color ${typeof color === 'string' ? color : color.name}`}
                />
              );
            })}
            {product.colors.length > 4 && (
              <div className="w-3.5 h-3.5 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[8px] font-bold text-gray-500 shadow-sm ml-0.5">
                +
              </div>
            )}
          </div>
        )}

        {/* Wishlist Button - Top Right */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleWishlist(e);
          }}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute top-2 right-2 z-20 p-2 rounded-full bg-white/50 md:hover:bg-white active:bg-white backdrop-blur-sm shadow-sm transition-all duration-200 pointer-events-auto group/heart active:scale-90"
        >
          <Heart
            size={18}
            className={`transition-all duration-200 ${isWishlisted
              ? 'fill-primary text-primary scale-110'
              : 'text-gray-400 md:group-hover/heart:text-primary'
              }`}
          />
        </button>

        {/* Floating Cart Button - Inside Bottom Right */}
        <button
          onClick={(e) => onAddToCart(e, product)}
          aria-label={isAdded ? `${product.name} added to cart` : `Add ${product.name} to cart`}
          className={`absolute bottom-3 right-3 z-20 h-10 w-10 flex items-center justify-center rounded-full shadow-md border border-gray-100 transition-all duration-200 pointer-events-auto active:scale-90 ${isAdded
            ? 'bg-primary text-white md:hover:bg-primary/90'
            : 'bg-white text-gray-900 md:hover:text-primary md:hover:border-primary/10'
            }`}
        >
          {isAdded ? (
            <Check size={iconSize} />
          ) : (
            <ShoppingCart size={iconSize} />
          )}
          {/* Quantity Badge */}
          {cartQuantity > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center bg-primary text-white text-[10px] font-bold rounded-full border-2 border-white shadow-sm">
              {cartQuantity > 99 ? '99+' : cartQuantity}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 pointer-events-none px-1 pt-1">
        {/* Ratings */}
        <div className="flex items-center mb-1.5 flex-wrap gap-y-1">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                size={12}
                className={`${i < Math.floor(product.rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
              />
            ))}
            <span className="text-[10px] text-gray-400 ml-1">
              ({product.rating})
            </span>
          </div>
        </div>

        {/* Title - Dark Gray (Standard) with Red Hover */}
        <h3 className="font-bold text-base text-gray-900 mb-1 leading-tight line-clamp-2 md:group-hover:text-primary transition-colors">
          {product.name}
          {product.spec && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200 align-middle leading-none tracking-normal">
              {product.spec}
            </span>
          )}
        </h3>

        {/* Short Teaser - Single line */}
        <p
          className={`text-gray-400 text-[11px] mb-2 line-clamp-1 ${viewMode === 'list' ? 'block' : 'hidden md:block'}`}
        >
          {stripHtml(product.description || '').replace(/What is the .*? Price in Nigeria\??/i, '').trim().slice(0, 60)}
          {stripHtml(product.description || '').replace(/What is the .*? Price in Nigeria\??/i, '').trim().length > 60 ? '...' : ''}
          <span className="text-primary font-medium ml-1">View specs →</span>
        </p>

        {/* Price & Details */}
        <div className="mt-auto flex items-end justify-between border-t border-dashed border-gray-100 pt-3">
          <span className="text-primary font-extrabold text-lg tracking-tight">
            {product.price}
          </span>
          <span className="text-xs font-semibold text-gray-900 mb-0.5 md:hover:text-primary pointer-events-auto cursor-pointer active:text-primary">
            Details
          </span>
        </div>

        {/* View Cart Button - Desktop only, shown after adding to cart */}
        {(cartQuantity > 0 || isAdded) && (
          <Link
            href={asRoute(`${basePath}/cart`)}
            className="hidden md:flex items-center justify-center gap-2 mt-3 py-2.5 px-4 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl transition-all duration-200 pointer-events-auto relative z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <ShoppingCart size={16} />
            View Cart{cartQuantity > 0 ? ` (${cartQuantity})` : ''}
          </Link>
        )}
      </div>
    </div>
  );
};
