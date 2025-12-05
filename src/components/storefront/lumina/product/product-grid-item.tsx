'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, Star, Check, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/products';

interface LuminaProductGridItemProps {
  product: Product;
  storeSlug?: string;
  viewMode?: 'grid' | 'list';
  isAdded?: boolean;
  isWishlisted?: boolean;
  onAddToCart?: (e: React.MouseEvent, product: Product) => void;
  onToggleWishlist?: (e: React.MouseEvent) => void;
}

export function LuminaProductGridItem({
  product,
  storeSlug = '',
  viewMode = 'grid',
  isAdded = false,
  isWishlisted = false,
  onAddToCart,
  onToggleWishlist,
}: LuminaProductGridItemProps) {
  const baseUrl = storeSlug ? `/storefront/${storeSlug}` : '';
  const iconSize = viewMode === 'list' ? 22 : 18;

  // State to track selected color/variant
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Get variant colors from attributes
  const variantColors = product.variants
    ?.map((v) => v.attributes?.color)
    .filter(Boolean) as string[] || [];

  // Get all images (from variants or product images)
  const allImages = product.images?.map((img) => img.url) || [];
  const variantImages = product.variants?.flatMap((v) => v.images || []) || [];
  const images = allImages.length > 0 ? allImages : variantImages.length > 0 ? variantImages : [product.image];

  // Determine current image based on active variant
  const currentImage = images[activeVariantIndex] || product.image || '';

  // Reset loading state when image source changes
  useEffect(() => {
    setIsImageLoaded(false);
  }, [currentImage]);

  const handlePrevVariant = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (variantColors.length === 0) return;
    setActiveVariantIndex((prev) => (prev === 0 ? variantColors.length - 1 : prev - 1));
  };

  const handleNextVariant = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (variantColors.length === 0) return;
    setActiveVariantIndex((prev) => (prev === variantColors.length - 1 ? 0 : prev + 1));
  };

  const handleColorSelect = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveVariantIndex(index);
  };

  const handleCartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAddToCart?.(e, product);
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleWishlist?.(e);
  };

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Get rating from schema_markup if available
  const rating = product.schema_markup?.aggregateRating?.ratingValue;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-3 md:p-4 shadow-sm md:hover:shadow-xl active:shadow-md active:scale-[0.99] transition-all duration-300 group flex flex-col h-full relative">
      <Link href={`${baseUrl}/product/${product.slug || product.id}` as Route} className="absolute inset-0 z-0" />

      {/* Image Container */}
      <div className="relative aspect-square mb-3 md:mb-4 bg-gray-50 rounded-2xl flex items-center justify-center overflow-visible z-10 pointer-events-none">
        {/* Navigation Arrows */}
        {variantColors.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrevVariant}
              className="absolute -left-2 md:left-2 top-1/2 -translate-y-1/2 z-30 p-2 md:p-1.5 bg-transparent md:bg-white/40 md:backdrop-blur-md border-0 md:border md:border-white/50 rounded-full shadow-none md:shadow-sm text-gray-500 md:text-gray-700 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 md:hover:bg-white/60 hover:text-gray-900 pointer-events-auto active:scale-95 touch-manipulation"
              aria-label="Previous color"
            >
              <ChevronLeft size={24} className="md:w-[18px] md:h-[18px]" />
            </button>
            <button
              type="button"
              onClick={handleNextVariant}
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

        {/* Product Image */}
        {currentImage && (
          <Image
            src={currentImage}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className={cn(
              'object-contain p-4 transition-all duration-500 z-10',
              isImageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            )}
            onLoad={() => setIsImageLoaded(true)}
          />
        )}

        {/* Condition Badge - Top Left */}
        {product.condition && (
          <div
            className={cn(
              'absolute top-3 left-3 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shadow-sm z-10 whitespace-nowrap',
              product.condition === 'new' ? 'bg-gray-900' : 'bg-stone-500'
            )}
          >
            {product.condition_detail || (product.condition === 'new' ? 'New' : 'Used')}
          </div>
        )}

        {/* Colors Swatches - Bottom Middle */}
        {variantColors.length > 0 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center -space-x-1.5 z-20 pointer-events-auto">
            {variantColors.slice(0, 4).map((color, idx) => {
              const isSelected = idx === activeVariantIndex;
              return (
                <button
                  type="button"
                  key={`${color}-${idx}`}
                  onClick={(e) => handleColorSelect(e, idx)}
                  className={cn(
                    'rounded-full border border-white shadow-sm transition-all duration-300 ease-out',
                    isSelected
                      ? 'w-4 h-4 ring-2 ring-gray-300 ring-offset-1 z-30 scale-110'
                      : 'w-3.5 h-3.5 hover:scale-110 hover:z-20 opacity-90 hover:opacity-100'
                  )}
                  style={{ backgroundColor: color }}
                  title={color}
                  aria-label={`Select color ${color}`}
                />
              );
            })}
            {variantColors.length > 4 && (
              <div className="w-3.5 h-3.5 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[8px] font-bold text-gray-500 shadow-sm ml-0.5">
                +
              </div>
            )}
          </div>
        )}

        {/* Wishlist Button - Top Right */}
        <button
          type="button"
          onClick={handleWishlistClick}
          className="absolute top-2 right-2 z-20 p-2 rounded-full bg-white/50 md:hover:bg-white active:bg-white backdrop-blur-sm shadow-sm transition-all duration-200 pointer-events-auto group/heart active:scale-90"
        >
          <Heart
            size={18}
            className={cn(
              'transition-all duration-200',
              isWishlisted
                ? 'fill-red-500 text-red-500 scale-110'
                : 'text-gray-400 md:group-hover/heart:text-red-500'
            )}
          />
        </button>

        {/* Floating Cart Button - Inside Bottom Right */}
        <button
          type="button"
          onClick={handleCartClick}
          className={cn(
            'absolute bottom-3 right-3 z-20 h-10 w-10 flex items-center justify-center rounded-full shadow-md border border-gray-100 transition-all duration-200 pointer-events-auto active:scale-90',
            isAdded
              ? 'bg-red-600 text-white md:hover:bg-red-700'
              : 'bg-white text-gray-900 md:hover:text-red-600 md:hover:border-red-100'
          )}
        >
          {isAdded ? <Check size={iconSize} /> : <ShoppingCart size={iconSize} />}
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 pointer-events-none px-1 pt-1">
        {/* Ratings */}
        {rating !== undefined && (
          <div className="flex items-center mb-1.5 flex-wrap gap-y-1">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  className={cn(
                    i < Math.floor(rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-300'
                  )}
                />
              ))}
              <span className="text-[10px] text-gray-400 ml-1">({rating})</span>
            </div>
          </div>
        )}

        {/* Title */}
        <h3 className="font-bold text-base text-gray-900 mb-1 leading-tight line-clamp-2 md:group-hover:text-red-600 transition-colors">
          {product.name}
          {product.sku && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200 align-middle leading-none tracking-normal">
              {product.sku}
            </span>
          )}
        </h3>

        {/* Description */}
        <p
          className={cn(
            'text-gray-500 text-xs mb-3 line-clamp-2 leading-relaxed',
            viewMode === 'list' ? 'block' : 'hidden md:block'
          )}
        >
          {product.description}
        </p>

        {/* Price & Details */}
        <div className="mt-auto flex items-end justify-between border-t border-dashed border-gray-100 pt-3">
          <span className="text-red-600 font-extrabold text-lg tracking-tight">
            {formatPrice(product.price)}
          </span>
          <span className="text-xs font-semibold text-gray-900 mb-0.5 md:hover:text-red-600 pointer-events-auto cursor-pointer active:text-red-600">
            Details
          </span>
        </div>
      </div>
    </div>
  );
}
