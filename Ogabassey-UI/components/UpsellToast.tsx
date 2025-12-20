import React, { useEffect, useState } from 'react';
import { Sparkles, Plus, X } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../contexts/CartContext';
import { products } from '../data/products';

// Mock upsell logic mapping categories to accessory recommendations
const UPSELL_MAPPING: Record<string, number[]> = {
  'Phones': [4, 7], // Watch, Mouse (just examples of accessories)
  'Laptops': [7, 8], // Mouse, Printer
  'Gaming': [7, 2], // Mouse, Laptop
  'Accessories': [1, 3] // Phone, Console
};

interface UpsellToastProps {
  isVisible: boolean;
  onClose: () => void;
  triggerProduct: Product | null;
}

export const UpsellToast: React.FC<UpsellToastProps> = ({ isVisible, onClose, triggerProduct }) => {
  const { addToCart } = useCart();
  const [suggestion, setSuggestion] = useState<Product | null>(null);

  useEffect(() => {
    if (isVisible && triggerProduct) {
      // Find a relevant accessory
      const category = triggerProduct.category;
      const potentialIds = UPSELL_MAPPING[category] || [7]; // Default to Mouse
      const randomId = potentialIds[Math.floor(Math.random() * potentialIds.length)];
      const foundProduct = products.find(p => p.id === randomId);
      
      setSuggestion(foundProduct || null);

      // Auto dismiss after 8 seconds
      const timer = setTimeout(onClose, 8000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, triggerProduct, onClose]);

  if (!isVisible || !suggestion) return null;

  const handleAddSuggestion = () => {
    addToCart(suggestion, 1);
    onClose();
  };

  return (
    <div className="fixed bottom-24 left-4 right-4 md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:w-auto md:min-w-[400px] z-[90] animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-red-100 p-4 relative overflow-hidden">
        {/* AI Background Effect */}
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <Sparkles className="text-red-600 w-16 h-16" />
        </div>

        <button 
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1 bg-white/50 rounded-full"
        >
          <X size={16} />
        </button>

        <div className="flex gap-4 items-start relative z-10">
           <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
              <Sparkles size={18} className="text-red-600" />
           </div>
           
           <div className="flex-1">
              <h4 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                 Great choice! Complete the set?
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                 Customers who bought <span className="font-medium text-gray-800">{triggerProduct?.name}</span> also added this:
              </p>

              <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-100">
                 <div className="w-10 h-10 bg-white rounded-lg p-1 flex items-center justify-center border border-gray-100 shrink-0">
                    <img src={suggestion.image} alt={suggestion.name} className="w-full h-full object-contain mix-blend-multiply" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{suggestion.name}</p>
                    <p className="text-[10px] text-red-600 font-bold">{suggestion.price}</p>
                 </div>
                 <button 
                   onClick={handleAddSuggestion}
                   className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors shadow-sm flex items-center gap-1 active:scale-95"
                 >
                   <Plus size={12} /> Add
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
