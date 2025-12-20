import React from 'react';
import { ShoppingCart, Star, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (e: React.MouseEvent, product: Product) => void;
  isAdded: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, isAdded }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-xl hover:border-red-100 transition-all duration-300 group flex flex-col h-full relative">
      <Link to={`/product/${product.id}`} className="absolute inset-0 z-0"></Link>

      {/* Image Container */}
      <div className="relative aspect-[4/3] mb-4 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden z-10 pointer-events-none">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-3/4 h-3/4 object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-md" 
        />
        
        {/* Condition Badge */}
        {product.condition && (
          <div className={`absolute top-3 left-3 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${
             product.condition === 'New' ? 'bg-gray-900' : 
             product.condition === 'Open Box' ? 'bg-indigo-600' :
             'bg-stone-500'
          }`}>
            {product.condition}
          </div>
        )}
      </div>
      
      {/* Shopping Cart Button */}
      <button 
        onClick={(e) => onAddToCart(e, product)}
        className={`absolute top-[calc(50%-2rem)] right-7 z-20 p-2.5 rounded-full shadow-lg transition-all duration-300 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 ${
          isAdded 
            ? 'bg-red-600 text-white hover:bg-red-700' 
            : 'bg-white text-gray-900 hover:bg-red-600 hover:text-white'
        }`}
      >
        {isAdded ? <Check size={18} /> : <ShoppingCart size={18} />}
      </button>
      
      {/* Content */}
      <div className="flex flex-col flex-1 pointer-events-none">
        <div className="flex items-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <Star 
              key={i} 
              size={12} 
              className={`${i < Math.floor(product.rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} 
            />
          ))}
          <span className="text-xs text-gray-400 ml-1">({product.rating})</span>
        </div>
        <h3 className="font-bold text-lg text-gray-900 mb-1 truncate leading-tight group-hover:text-red-600 transition-colors">
          {product.name}
          {product.spec && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200 align-middle leading-none tracking-normal">
              {product.spec}
            </span>
          )}
        </h3>
        <p className="text-gray-500 text-sm mb-4 line-clamp-2 leading-relaxed">
          {product.description}
        </p>
        
        <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
          <span className="text-red-600 font-bold text-xl">{product.price}</span>
          <span className="text-sm font-medium text-gray-400 group-hover:text-gray-900 transition-colors">Details</span>
        </div>
      </div>
    </div>
  );
};