
import React, { useEffect } from 'react';
import { Heart, X } from 'lucide-react';

interface SavedToastProps {
  isVisible: boolean;
  message: string;
  type: 'add' | 'remove';
  onClose: () => void;
}

export const SavedToast: React.FC<SavedToastProps> = ({ isVisible, message, type, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-20 right-4 md:top-24 md:right-6 z-[90] animate-in slide-in-from-right-5 fade-in duration-300">
      <div className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 p-4 flex items-center gap-3 pr-10 relative">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${type === 'add' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
           {type === 'add' ? <Heart size={16} fill="currentColor" /> : <Heart size={16} />}
        </div>
        <div>
           <p className="text-sm font-bold text-gray-900">{message}</p>
           <p className="text-xs text-gray-500">{type === 'add' ? 'Find it in your profile' : 'Removed from wishlist'}</p>
        </div>
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
