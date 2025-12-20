import React from 'react';
import { ShoppingCart, Star, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Product } from '../types';

interface ProductListCardProps {
  product: Product;
  onAddToCart: (e: React.MouseEvent, product: Product) => void;
  isAdded: boolean;
}

export const ProductListCard: React.FC<ProductListCardProps> = ({ product, onAddToCart, isAdded }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:border-red-100 transition-all duration-300 group flex flex-row gap-4 md:gap-6 relative">
      <Link to={`/product/${product.id}`} className="absolute inset-0 z-0"></Link>

      {/* Image (Left Side) */}
      <div className="w-28 md:w-48 aspect-square bg-gray-50 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden z-10 pointer-events-none relative">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-3/4 h-3/4 object-contain group-hover:scale-110 transition-transform duration-500 mix-blend-multiply" 
        />
        {product.condition && (
          <div className={`absolute top-2 left-2 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
             product.condition === 'New' ? 'bg-gray-900' : 
             product.condition === 'Open Box' ? 'bg-indigo-600' :
             'bg-stone-500'
          }`}>
            {product.condition}
          </div>
        )}
      </div>

      {/* Content (Right Side) */}
      <div className="flex flex-col flex-1 justify-center pointer-events-none">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-lg text-gray-900 group-hover:text-red-600 transition-colors line-clamp-1">
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
            className={`z-20 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              isAdded 
                ? 'bg-red-600 text-white pointer-events-none' 
                : 'bg-gray-900 text-white hover:bg-red-600 pointer-events-auto'
            }`}
          >
            {isAdded ? (
              <>Added <Check size={16} /></>
            ) : (
              <>Add to Cart <ShoppingCart size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};