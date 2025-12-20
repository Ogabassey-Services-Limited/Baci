
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Star, Heart, ArrowRightLeft } from 'lucide-react';
import { Product } from '../types';
import { useSaved } from '../contexts/SavedContext';
import { useComparison } from '../contexts/ComparisonContext';

interface ProductCardProps {
  product: Product;
  onAddToCart: (e: React.MouseEvent, product: Product) => void;
  isAdded: boolean;
  viewMode?: 'grid' | 'list';
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onAddToCart, 
  isAdded, 
  viewMode = 'grid' 
}) => {
  const { toggleSaved, isSaved } = useSaved();
  const { addToCompare, removeFromCompare, isInCompare } = useComparison();
  const [showPlusOne, setShowPlusOne] = useState(false);

  const isLiked = isSaved(product.id);
  const isComparing = isInCompare(product.id);

  const toggleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSaved(product);
  };

  const toggleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isComparing) {
        removeFromCompare(product.id);
    } else {
        addToCompare(product);
    }
  };

  const handleCartClick = (e: React.MouseEvent) => {
      onAddToCart(e, product);
      
      // Trigger animation
      setShowPlusOne(true);
      setTimeout(() => setShowPlusOne(false), 1000); // Hide after animation
  };
  
  if (viewMode === 'grid') {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-3 md:p-4 shadow-sm md:hover:shadow-xl transition-all duration-300 group flex flex-col h-full relative active:scale-[0.98] md:active:scale-100 touch-manipulation">
        <Link to={`/product/${product.id}`} className="absolute inset-0 z-0"></Link>

        {/* Image Container */}
        <div className="relative aspect-square mb-3 md:mb-4 bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden z-10 pointer-events-none">
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-full object-cover transition-transform duration-500 md:group-hover:scale-105" 
          />
          
          {/* Badge */}
          {product.condition && (
            <div className={`absolute top-3 left-3 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shadow-sm z-10 ${
              product.condition === 'New' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}>
              {product.condition}
            </div>
          )}

          {/* Action Buttons - Top Right */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
              <button 
                onClick={toggleLike}
                className={`h-8 w-8 flex items-center justify-center rounded-full shadow-sm border transition-all duration-200 pointer-events-auto active:scale-90 ${
                  isLiked 
                    ? 'bg-white border-red-100 text-red-600' 
                    : 'bg-white/80 backdrop-blur-sm border-transparent text-gray-400 md:hover:text-red-600 md:hover:bg-white'
                }`}
                title="Add to Wishlist"
              >
                <Heart size={16} fill={isLiked ? "currentColor" : "none"} strokeWidth={2} />
              </button>

              <button 
                onClick={toggleCompare}
                className={`h-8 w-8 flex items-center justify-center rounded-full shadow-sm border transition-all duration-200 pointer-events-auto active:scale-90 ${
                  isComparing 
                    ? 'bg-red-50 border-red-100 text-red-600' 
                    : 'bg-white/80 backdrop-blur-sm border-transparent text-gray-400 md:hover:text-blue-600 md:hover:bg-white'
                }`}
                title="Compare"
              >
                <ArrowRightLeft size={16} strokeWidth={2} />
              </button>
          </div>

          {/* Floating Cart Button - Inside Image Container for balance */}
          <button 
            onClick={handleCartClick}
            className={`absolute bottom-3 right-3 z-20 h-10 w-10 flex items-center justify-center rounded-full shadow-lg border border-gray-100 transition-all duration-300 pointer-events-auto active:scale-90 bg-white text-gray-900 md:hover:bg-red-600 md:hover:text-white md:hover:border-red-600 overflow-visible`}
          >
             <ShoppingCart size={18} className={`transition-transform ${showPlusOne ? 'scale-90' : ''}`} strokeWidth={2} />
             
             {/* +1 Animation */}
             {showPlusOne && (
                 <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-red-600 font-bold text-sm animate-out fade-out slide-out-to-top-4 duration-1000 fill-mode-forwards z-30 pointer-events-none shadow-sm bg-white px-1.5 rounded-full border border-red-50">
                     +1
                 </span>
             )}
          </button>
        </div>
        
        {/* Content */}
        <div className="flex flex-col flex-1 pointer-events-none px-1 pt-1">
          {/* Ratings */}
          <div className="flex items-center gap-1 mb-1.5">
            {[...Array(5)].map((_, i) => (
              <Star 
                key={i} 
                size={12} 
                className={`${i < Math.floor(product.rating) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} 
              />
            ))}
            <span className="text-[10px] text-gray-400 ml-1">({product.rating})</span>
          </div>

          {/* Title - Red to match screenshot */}
          <h3 className="font-bold text-base text-gray-900 mb-1 leading-tight line-clamp-2 md:group-hover:text-red-600 transition-colors">
            {product.name}
          </h3>
          
          {/* Description */}
          <p className="text-gray-500 text-xs mb-3 line-clamp-2 leading-relaxed hidden md:block">
            {product.description}
          </p>
          
          {/* Price */}
          <div className="mt-auto pt-2">
            <span className="text-red-600 font-extrabold text-lg tracking-tight">{product.price}</span>
          </div>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm md:hover:shadow-lg md:hover:border-red-100 transition-all duration-300 group flex flex-row gap-4 md:gap-6 relative active:scale-[0.99] md:active:scale-100 touch-manipulation">
      <Link to={`/product/${product.id}`} className="absolute inset-0 z-0"></Link>

      {/* Image (Left Side) */}
      <div className="w-28 md:w-48 aspect-square bg-gray-50 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden z-10 pointer-events-none relative">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full h-full object-cover md:group-hover:scale-110 transition-transform duration-500" 
        />
        <div className={`absolute top-2 left-2 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide z-10 ${
          product.condition === 'New' ? 'bg-emerald-500' : 'bg-amber-500'
        }`}>
          {product.condition}
        </div>
      </div>

      {/* Content (Right Side) */}
      <div className="flex flex-col flex-1 justify-center pointer-events-none pr-8">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-lg text-gray-900 md:group-hover:text-red-600 transition-colors line-clamp-1">{product.name}</h3>
          <div className="hidden md:flex items-center gap-0.5" title={`${product.rating} out of 5 stars`}>
            {[...Array(5)].map((_, i) => (
              <Star 
                key={i} 
                size={12} 
                className={`${i < Math.floor(product.rating) ? "fill-yellow-400 text-yellow-400" : "fill-gray-100 text-gray-300"}`} 
              />
            ))}
            <span className="text-xs text-gray-500 ml-1">({product.rating})</span>
          </div>
        </div>
        
        <p className="text-gray-500 text-sm mb-3 line-clamp-2 md:line-clamp-none">{product.description}</p>
        
        <div className="mt-auto flex items-center justify-between">
          <span className="text-red-600 font-bold text-xl">{product.price}</span>
          
          <div className="flex items-center gap-2 z-20 pointer-events-auto">
             {/* Compare Button (List View) */}
             <button 
                onClick={toggleCompare}
                className={`p-2 rounded-lg transition-all duration-200 border ${
                  isComparing 
                    ? 'bg-red-50 border-red-100 text-red-600' 
                    : 'bg-white border-gray-200 text-gray-400 md:hover:border-red-200 md:hover:text-blue-600'
                }`}
                title="Compare"
              >
                <ArrowRightLeft size={18} strokeWidth={2} />
              </button>

             <button 
                onClick={handleCartClick}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 bg-gray-900 text-white md:hover:bg-red-600 relative overflow-visible`}
            >
                {showPlusOne && (
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-red-600 font-bold text-lg animate-out fade-out slide-out-to-top-4 duration-1000 fill-mode-forwards z-30 pointer-events-none">
                        +1
                    </span>
                )}
                Add to Cart <ShoppingCart size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Wishlist Button - Absolute Top Right of Card in List View */}
      <button 
        onClick={toggleLike}
        className={`absolute top-4 right-4 z-20 p-2 rounded-full transition-all duration-200 pointer-events-auto active:scale-90 ${
             isLiked 
                ? 'bg-red-50 text-red-600' 
                : 'bg-white/80 backdrop-blur-sm text-gray-400 md:hover:bg-red-50 md:hover:text-red-600'
        }`}
      >
        <Heart size={18} fill={isLiked ? "currentColor" : "none"} strokeWidth={2} />
      </button>

    </div>
  );
};
