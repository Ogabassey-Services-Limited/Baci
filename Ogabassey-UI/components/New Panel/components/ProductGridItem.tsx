import React from 'react';
import { ShoppingCart, Star, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Product } from '../types';

interface ProductGridItemProps {
  product: Product;
  onAddToCart: (e: React.MouseEvent, product: Product) => void;
  isAdded: boolean;
  viewMode?: 'grid' | 'list';
}

export const ProductGridItem: React.FC<ProductGridItemProps> = ({ product, onAddToCart, isAdded, viewMode = 'grid' }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-3 md:p-4 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col h-full relative">
      <Link to={`/product/${product.id}`} className="absolute inset-0 z-0"></Link>

      {/* Image Container - Gray Box with Overlapping Button */}
      {/* overflow-visible needed for the button to hang off the edge */}
      <div className="relative aspect-square mb-3 md:mb-4 bg-gray-50 rounded-2xl flex items-center justify-center overflow-visible z-10 pointer-events-none">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-2/3 h-2/3 object-contain mix-blend-multiply" 
        />
        
        {/* Badge */}
        {product.condition && (
          <div className={`absolute top-3 left-3 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shadow-sm ${
             product.condition === 'New' ? 'bg-gray-900' : 
             product.condition === 'Open Box' ? 'bg-indigo-600' :
             'bg-stone-500'
          }`}>
            {product.condition}
          </div>
        )}

        {/* Floating Cart Button - Overlapping Bottom Right */}
        <button 
          onClick={(e) => onAddToCart(e, product)}
          className={`absolute -bottom-3 -right-3 z-20 h-10 w-10 flex items-center justify-center rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-gray-50 transition-all duration-200 pointer-events-auto ${
            isAdded 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-white text-gray-900 hover:text-red-600 hover:border-red-100'
          }`}
        >
          {isAdded ? <Check size={18} /> : <ShoppingCart size={18} />}
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
        <h3 className="font-bold text-base text-red-600 mb-1 leading-tight line-clamp-2 group-hover:underline decoration-red-600/30 underline-offset-2">
          {product.name}
        </h3>
        
        {/* Description: 
            - Grid Mode (Mobile): Hidden
            - List Mode (Mobile): Visible
            - Desktop: Always Visible
        */}
        <p className={`text-gray-500 text-xs mb-3 line-clamp-2 leading-relaxed ${viewMode === 'list' ? 'block' : 'hidden md:block'}`}>
          {product.description}
        </p>
        
        {/* Price & Details */}
        <div className="mt-auto flex items-end justify-between border-t border-dashed border-gray-100 pt-3">
          <span className="text-red-600 font-extrabold text-lg tracking-tight">{product.price}</span>
          <span className="text-xs font-semibold text-gray-900 mb-0.5 hover:text-red-600 pointer-events-auto cursor-pointer">Details</span>
        </div>
      </div>
    </div>
  );
};