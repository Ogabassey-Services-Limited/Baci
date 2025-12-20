'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingCart, Star, Check, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Product } from '@/types';

interface ProductListItemProps {
  product: Product;
  onAddToCart: (e: React.MouseEvent, product: Product) => void;
  isAdded: boolean;
  isWishlisted: boolean;
  onToggleWishlist: (e: React.MouseEvent) => void;
}

export const ProductListItem: React.FC<ProductListItemProps> = ({ 
  product, 
  onAddToCart, 
  isAdded,
  isWishlisted,
  onToggleWishlist
}) => {
  const [activeColorIndex, setActiveColorIndex] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const currentImage = product.images?.[activeColorIndex] || product.image;

  useEffect(() => {
    setIsImageLoaded(false);
  }, [currentImage]);

  const handlePrevColor = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.colors || product.colors.length === 0) return;
    setActiveColorIndex(prev => (prev === 0 ? product.colors!.length - 1 : prev - 1));
  };

  const handleNextColor = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.colors || product.colors.length === 0) return;
    setActiveColorIndex(prev => (prev === product.colors!.length - 1 ? 0 : prev + 1));
  };

  const handleColorSelect = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveColorIndex(index);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm md:hover:shadow-lg md:hover:border-red-100 active:scale-[0.99] transition-all duration-300 group flex flex-row gap-4 md:gap-6 relative">
      <Link href={`/product/${product.id}`} className="absolute inset-0 z-0"></Link>

      <div className="w-28 md:w-48 aspect-square bg-gray-50 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden z-10 pointer-events-none relative">
        {product.colors && product.colors.length > 1 && (
          <>
            <button 
              onClick={handlePrevColor}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-30 p-1 bg-white/40 backdrop-blur-md border border-white/50 rounded-full shadow-sm text-gray-700 opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 hover:bg-white/60 hover:text-gray-900 pointer-events-auto"
            >
              <ChevronLeft size={14} />
            </button>
            <button 
              onClick={handleNextColor}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-30 p-1 bg-white/40 backdrop-blur-md border border-white/50 rounded-full shadow-sm text-gray-700 opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 hover:bg-white/60 hover:text-gray-900 pointer-events-auto"
            >
              <ChevronRight size={14} />
            </button>
          </>
        )}

        {!isImageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center z-0">
             <div className="w-3/4 h-3/4 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        )}

        <img 
          src={currentImage} 
          alt={product.name} 
          loading="lazy"
          onLoad={() => setIsImageLoaded(true)}
          className={`w-3/4 h-3/4 object-contain md:group-hover:scale-110 transition-all duration-500 mix-blend-multiply z-10 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`} 
        />

        {product.condition && (
          <div className={`absolute top-2 left-2 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow-sm whitespace-nowrap z-20 ${
            product.condition === 'New' ? 'bg-gray-900' : 
            product.condition === 'Open Box' ? 'bg-indigo-600' :
            'bg-stone-500'
          }`}>
            {product.condition}
          </div>
        )}

        {product.colors && product.colors.length > 0 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center -space-x-1.5 z-20 pointer-events-auto">
             {product.colors.slice(0, 3).map((color, idx) => {
               const isSelected = idx === activeColorIndex;
               return (
                  <button 
                    key={idx} 
                    onClick={(e) => handleColorSelect(e, idx)}
                    className={`rounded-full border border-white shadow-sm transition-all duration-300 ease-out ${
                      isSelected 
                        ? 'w-3.5 h-3.5 ring-2 ring-gray-300 ring-offset-1 z-30 scale-110' 
                        : 'w-3 h-3 hover:scale-110 hover:z-20 opacity-90 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color }} 
                    title={color}
                  />
               );
             })}
          </div>
        )}

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleWishlist(e);
          }}
          className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-white/60 md:hover:bg-white active:bg-white backdrop-blur-sm shadow-sm transition-all duration-200 pointer-events-auto group/heart active:scale-90"
        >
          <Heart 
            size={16} 
            className={`transition-all duration-200 ${
              isWishlisted 
                ? 'fill-red-500 text-red-500 scale-110' 
                : 'text-gray-400 md:group-hover/heart:text-red-500'
            }`} 
          />
        </button>
      </div>

      <div className="flex flex-col flex-1 justify-center pointer-events-none">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-lg text-gray-900 md:group-hover:text-red-600 transition-colors line-clamp-1">
            {product.name}
            {product.spec && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200 align-middle leading-none tracking-normal">
                {product.spec}
              </span>
            )}
          </h3>
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  size={12} 
                  className={`${i < Math.floor(product.rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} 
                />
              ))}
            </div>
          </div>
        </div>
        
        <p className="text-gray-500 text-sm mb-3 line-clamp-2 md:line-clamp-none">
          {product.description}
        </p>
        
        <div className="mt-auto flex items-center justify-between">
          <span className="text-red-600 font-bold text-xl">{product.price}</span>
          
          <button 
            onClick={(e) => onAddToCart(e, product)}
            className={`z-20 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${
              isAdded 
                ? 'bg-red-600 text-white pointer-events-none' 
                : 'bg-gray-900 text-white md:hover:bg-red-600 active:bg-red-700 pointer-events-auto'
            }`}
          >
            {isAdded ? (
              <>Added <Check size={20} /></>
            ) : (
              <>Add to Cart <ShoppingCart size={20} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};