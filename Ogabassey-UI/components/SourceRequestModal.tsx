import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Loader2, Search } from 'lucide-react';

interface SourceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery: string;
}

export const SourceRequestModal: React.FC<SourceRequestModalProps> = ({ isOpen, onClose, initialQuery }) => {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    productName: '',
    details: '',
    contact: ''
  });

  // Update product name when initialQuery changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({ ...prev, productName: initialQuery }));
      setStep('form');
    }
  }, [isOpen, initialQuery]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setStep('success');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
           <div className="flex items-center gap-2">
              <Search className="text-red-600" size={20} />
              <h3 className="font-bold text-gray-900">Request Product Sourcing</h3>
           </div>
           <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
             <X size={20} />
           </button>
        </div>

        <div className="p-6">
           {step === 'form' ? (
             <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-gray-500 mb-4">
                   Can't find what you're looking for? Tell us what it is, and we'll hunt it down for you.
                </p>

                <div>
                   <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Product Name</label>
                   <input 
                     type="text" 
                     required
                     value={formData.productName}
                     onChange={e => setFormData({...formData, productName: e.target.value})}
                     className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-600/20 focus:border-red-600 outline-none bg-gray-50 transition-all font-medium text-gray-900"
                     placeholder="e.g. iPhone 15 Pro Max 1TB"
                   />
                </div>
                
                <div>
                   <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Additional Details</label>
                   <textarea 
                     value={formData.details}
                     onChange={e => setFormData({...formData, details: e.target.value})}
                     className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-600/20 focus:border-red-600 outline-none bg-gray-50 min-h-[100px] transition-all text-sm resize-none"
                     placeholder="Specific color, specs, condition (New/Used), or your budget..."
                   />
                </div>
                
                <div>
                   <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Contact Info</label>
                   <input 
                     type="text" 
                     required
                     value={formData.contact}
                     onChange={e => setFormData({...formData, contact: e.target.value})}
                     className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-600/20 focus:border-red-600 outline-none bg-gray-50 transition-all text-sm"
                     placeholder="Email address or Phone number"
                   />
                </div>
                
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-red-200 flex items-center justify-center gap-2 mt-2 active:scale-[0.98]"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Submit Request'}
                </button>
             </form>
           ) : (
             <div className="text-center py-8 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
                <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-green-100">
                   <CheckCircle2 size={40} />
                </div>
                <h4 className="text-2xl font-bold text-gray-900 mb-2">Request Received!</h4>
                <p className="text-gray-500 mb-6 max-w-xs mx-auto leading-relaxed text-sm">
                   We've started the search for <strong>{formData.productName}</strong>. We will contact you at <strong>{formData.contact}</strong> as soon as we locate it. 
                </p>
                <p className="text-gray-400 text-xs mb-8 max-w-xs mx-auto bg-gray-50 p-2 rounded-lg border border-gray-100">
                   Note: We will also let you know if we are unable to source it.
                </p>
                <button 
                  onClick={onClose} 
                  className="bg-gray-900 hover:bg-black text-white font-bold py-3 px-12 rounded-xl transition-all shadow-lg active:scale-95"
                >
                  Done
                </button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};