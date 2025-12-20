import React, { useState, useEffect } from 'react';
import { X, HandCoins, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface NegotiationModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  currentPrice: number;
  onSuccess: (finalPrice: number) => void;
}

type NegotiationState = 'input' | 'processing' | 'success' | 'failed';

export const NegotiationModal: React.FC<NegotiationModalProps> = ({ 
  isOpen, 
  onClose, 
  productName, 
  currentPrice, 
  onSuccess 
}) => {
  const [offer, setOffer] = useState('');
  const [status, setStatus] = useState<NegotiationState>('input');
  const [message, setMessage] = useState('');

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setOffer('');
      setStatus('input');
      setMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offer) return;

    setStatus('processing');
    const offerAmount = parseFloat(offer);

    // Simulate AI thinking delay
    setTimeout(() => {
      const discountPercentage = 1 - (offerAmount / currentPrice);
      
      // Logic: 
      // Accept if offer is within 20% discount (0.2)
      // Reject if offer is too low (> 20% discount)
      
      if (discountPercentage <= 0.20 && offerAmount < currentPrice) {
        setStatus('success');
        onSuccess(offerAmount);
      } else if (offerAmount >= currentPrice) {
        setStatus('failed');
        setMessage("Your offer is higher than the price! Just buy it normally.");
      } else {
        setStatus('failed');
        setMessage("That's a bit too low for us. Can you make a better offer?");
      }
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#1a1a1a] p-4 flex justify-between items-center">
           <div className="flex items-center gap-2 text-white">
              <HandCoins size={20} className="text-red-600" />
              <h3 className="font-bold text-sm uppercase tracking-wider">Negotiate Price</h3>
           </div>
           <button onClick={onClose} className="text-gray-400 hover:text-white">
             <X size={20} />
           </button>
        </div>

        {/* Content */}
        <div className="p-6">
           <div className="mb-6">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Product</span>
              <p className="font-bold text-gray-900 line-clamp-1">{productName}</p>
              <p className="text-sm text-gray-500 mt-1">Current Price: <span className="text-gray-900 font-semibold">₦{currentPrice.toLocaleString()}</span></p>
           </div>

           {status === 'input' && (
             <form onSubmit={handleSubmit}>
               <label className="block text-sm font-medium text-gray-700 mb-2">Your Offer (₦)</label>
               <div className="relative mb-6">
                 <input 
                   type="number" 
                   value={offer}
                   onChange={(e) => setOffer(e.target.value)}
                   className="w-full pl-4 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all text-lg font-bold text-gray-900 placeholder:font-normal"
                   placeholder="Enter amount..."
                   autoFocus
                 />
               </div>
               <button 
                 type="submit" 
                 className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all shadow-md"
               >
                 Submit Offer
               </button>
             </form>
           )}

           {status === 'processing' && (
             <div className="flex flex-col items-center justify-center py-4">
               <Loader2 size={40} className="text-red-600 animate-spin mb-4" />
               <p className="font-medium text-gray-600">Reviewing your offer...</p>
               <p className="text-xs text-gray-400 mt-2">Checking with sales manager</p>
             </div>
           )}

           {status === 'success' && (
             <div className="flex flex-col items-center justify-center py-2 text-center animate-in fade-in slide-in-from-bottom-2">
               <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                 <CheckCircle2 size={28} className="text-green-600" />
               </div>
               <h4 className="text-xl font-bold text-gray-900 mb-1">Offer Accepted!</h4>
               <p className="text-sm text-gray-500 mb-4">Price has been updated in your cart.</p>
               <button 
                 onClick={onClose} 
                 className="bg-gray-900 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-black transition-colors"
               >
                 Done
               </button>
             </div>
           )}

           {status === 'failed' && (
             <div className="flex flex-col items-center justify-center py-2 text-center animate-in shake duration-300">
               <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                 <AlertCircle size={28} className="text-red-600" />
               </div>
               <h4 className="text-lg font-bold text-gray-900 mb-1">Offer Rejected</h4>
               <p className="text-sm text-gray-500 mb-6">{message}</p>
               <button 
                 onClick={() => setStatus('input')} 
                 className="w-full bg-gray-100 text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
               >
                 Try Another Amount
               </button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
