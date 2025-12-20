import React, { useEffect, useState } from 'react';
import { Sparkles, Plus, X } from 'lucide-react';
import { Product } from '../types';
import { products } from '../data/products';
import { useCart } from '../contexts/CartContext';

interface UpsellToastProps {
  product: Product | null;
  anchorRect?: { top: number; left: number; width: number; height: number } | null;
  onClose: () => void;
}

// Simple category-based upsell mapping logic
const UPSELL_MAPPING: Record<string, number> = {
  'Phones': 4,       // Buy Phone -> Recommend Apple Watch
  'Laptops': 7,      // Buy Laptop -> Recommend Gaming Mouse
  'Gaming': 7,       // Buy Console -> Recommend Gaming Mouse
  'Accessories': 1,  // Buy Accessory -> Recommend iPhone
  'Printers': 2      // Buy Printer -> Recommend MacBook
};

export const UpsellToast: React.FC<UpsellToastProps> = ({ product, anchorRect, onClose }) => {
  const { addToCart } = useCart();
  const [isVisible, setIsVisible] = useState(false);
  const [suggestedProduct, setSuggestedProduct] = useState<Product | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (product) {
      const suggestedId = UPSELL_MAPPING[product.category];
      const suggestion = products.find(p => p.id === suggestedId);

      if (suggestion && suggestion.id !== product.id) {
        setSuggestedProduct(suggestion);
        
        // Calculate Position
        if (anchorRect) {
          const scrollY = window.scrollY;
          const toastWidth = 380;
          const toastHeight = 160; // Approximate
          const gap = 12;

          let top = anchorRect.top + scrollY - toastHeight - gap;
          let left = anchorRect.left + (anchorRect.width / 2) - (toastWidth / 2);

          // Bounds checking
          const padding = 16;
          const windowWidth = window.innerWidth;

          // Clamp Horizontal
          if (left < padding) left = padding;
          if (left + toastWidth > windowWidth - padding) {
             left = windowWidth - toastWidth - padding;
          }

          // Check top overflow - if offscreen top, flip to bottom
          if (top < scrollY + 80) { // 80px buffer for navbar
             top = anchorRect.top + scrollY + anchorRect.height + gap;
          }

          setCoords({ top, left });
        } else {
          setCoords(null);
        }

        setIsVisible(true);
        
        const timer = setTimeout(() => {
          handleDismiss();
        }, 8000);
        return () => clearTimeout(timer);
      } else {
        onClose();
      }
    }
  }, [product, anchorRect, onClose]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleAddUpsell = () => {
    if (suggestedProduct) {
      addToCart(suggestedProduct);
      handleDismiss();
    }
  };

  if (!suggestedProduct) return null;

  const isAnchored = !!coords;

  return (
    <div 
      className={`z-[90] w-[95%] max-w-[380px] transition-all duration-500 ease-out transform ${
        isAnchored ? 'absolute' : 'fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2'
      } ${
        isVisible 
          ? 'opacity-100 translate-y-0 scale-100' 
          : 'opacity-0 translate-y-8 scale-95 pointer-events-none'
      }`}
      style={isAnchored ? { top: coords.top, left: coords.left } : {}}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-red-100 overflow-hidden relative">
        
        {/* Progress Bar */}
        <div className={`absolute top-0 left-0 h-1 bg-red-600 transition-all duration-[8000ms] ease-linear z-10 ${isVisible ? 'w-full' : 'w-0'}`} />

        {/* Close Button */}
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors z-20"
        >
          <X size={16} />
        </button>

        <div className="p-4 pt-5">
          <div className="flex items-center gap-2 mb-1">
             <Sparkles size={16} className="text-red-500 fill-red-100" />
             <h3 className="font-bold text-gray-900 text-sm">Great choice!</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3 pl-6">Complete the set with this offer.</p>
          
          {/* Product Card */}
          <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100 transition-colors hover:border-red-100 group">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center p-1 border border-gray-100 flex-shrink-0">
               <img 
                 src={suggestedProduct.image} 
                 alt={suggestedProduct.name} 
                 className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-300" 
               />
            </div>
            
            <div className="flex-1 min-w-0">
               <h4 className="font-bold text-gray-900 text-sm truncate">{suggestedProduct.name}</h4>
               <p className="text-red-600 font-bold text-sm">{suggestedProduct.price}</p>
            </div>

            <button 
              onClick={handleAddUpsell}
              className="bg-gray-900 text-white px-3 py-1.5 rounded-full flex items-center gap-1 text-xs font-bold shadow-lg shadow-gray-200 hover:bg-red-600 hover:shadow-red-200 hover:scale-105 active:scale-95 transition-all flex-shrink-0"
              title="Add to Cart"
            >
              Add <Plus size={14} strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};