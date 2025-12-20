
import React, { useState } from 'react';
import { Star, MessageSquare, ThumbsUp, ChevronRight, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { products } from '../data/products';
import { EmptyState } from './EmptyState';
import { Product } from '../types';

interface RatingModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onSubmit: (rating: number) => void;
}

const RatingModal: React.FC<RatingModalProps> = ({ isOpen, onClose, product, onSubmit }) => {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !product) return null;

    const handleSubmit = () => {
        if (rating === 0) return;
        setIsSubmitting(true);
        // Simulate network request
        setTimeout(() => {
            setIsSubmitting(false);
            onSubmit(rating);
            onClose();
            setRating(0); // Reset for next time
        }, 1500);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl relative z-10 p-6 animate-in zoom-in-95 duration-200">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gray-50 rounded-xl border border-gray-100 p-2 mx-auto mb-4 flex items-center justify-center">
                        <img src={product.image} alt={product.name} className="w-full h-full object-contain mix-blend-multiply" />
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">{product.name}</h3>
                    <p className="text-sm text-gray-500">How would you rate this product?</p>
                </div>

                {/* Star Rating Interaction */}
                <div className="flex justify-center gap-2 mb-8">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setRating(star)}
                            className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                        >
                            <Star 
                                size={32} 
                                className={`transition-colors duration-200 ${
                                    (hoverRating || rating) >= star 
                                    ? 'fill-yellow-400 text-yellow-400 drop-shadow-sm' 
                                    : 'text-gray-200 fill-gray-50'
                                }`} 
                                strokeWidth={1.5}
                            />
                        </button>
                    ))}
                </div>
                
                {/* Feedback Text */}
                <div className="text-center text-sm font-bold text-gray-900 h-6 mb-6">
                    {(hoverRating || rating) === 1 && "Poor 😞"}
                    {(hoverRating || rating) === 2 && "Fair 😐"}
                    {(hoverRating || rating) === 3 && "Good 🙂"}
                    {(hoverRating || rating) === 4 && "Very Good 😄"}
                    {(hoverRating || rating) === 5 && "Excellent! 🤩"}
                </div>

                <button 
                    onClick={handleSubmit}
                    disabled={rating === 0 || isSubmitting}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-red-200 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Submit Review'}
                </button>
            </div>
        </div>
    );
};

export const ReviewsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // State for reviews to allow moving items between tabs
  const [pendingReviews, setPendingReviews] = useState([products[0], products[2]]);
  const [historyReviews, setHistoryReviews] = useState([
    { ...products[1], userRating: 5, userComment: "Amazing laptop, super fast!", date: "Oct 12, 2023" },
    { ...products[6], userRating: 4, userComment: "Good mouse but a bit small for my hands.", date: "Sep 05, 2023" }
  ]);

  const handleOpenRate = (product: Product) => {
      setSelectedProduct(product);
      setIsModalOpen(true);
  };

  const handleRateSubmit = (rating: number) => {
      if (!selectedProduct) return;

      // Create new review entry
      const newReview = {
          ...selectedProduct,
          userRating: rating,
          userComment: "Rated via Quick Rate",
          date: "Just now"
      };

      // Update state: Add to history, remove from pending
      setHistoryReviews(prev => [newReview, ...prev]);
      setPendingReviews(prev => prev.filter(p => p.id !== selectedProduct.id));
      
      // Switch tab to history to show the user their new review
      setActiveTab('history');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Star className="text-red-600 fill-red-600" />
          My Reviews
        </h1>

        <div className="flex border-b border-gray-200 mb-6">
           <button 
             onClick={() => setActiveTab('pending')}
             className={`pb-3 px-6 font-medium text-sm transition-colors relative ${activeTab === 'pending' ? 'text-red-600' : 'text-gray-500 hover:text-gray-800'}`}
           >
             To Review ({pendingReviews.length})
             {activeTab === 'pending' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600"></div>}
           </button>
           <button 
             onClick={() => setActiveTab('history')}
             className={`pb-3 px-6 font-medium text-sm transition-colors relative ${activeTab === 'history' ? 'text-red-600' : 'text-gray-500 hover:text-gray-800'}`}
           >
             History ({historyReviews.length})
             {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600"></div>}
           </button>
        </div>

        {activeTab === 'pending' ? (
           <div className="space-y-4">
              {pendingReviews.length > 0 ? (
                  pendingReviews.map(product => (
                      <div key={product.id} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                          <div className="w-16 h-16 bg-gray-50 rounded-lg p-2 shrink-0 border border-gray-100">
                             <img src={product.image} alt={product.name} className="w-full h-full object-contain mix-blend-multiply" />
                          </div>
                          <div className="flex-1">
                             <h3 className="font-bold text-gray-900 text-sm mb-1">{product.name}</h3>
                             <p className="text-xs text-gray-500">Purchased on Jan 15, 2024</p>
                          </div>
                          <button 
                            onClick={() => handleOpenRate(product)}
                            className="bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm active:scale-95"
                          >
                             Rate Now
                          </button>
                      </div>
                  ))
              ) : (
                  <EmptyState 
                    title="No pending reviews" 
                    description="You have reviewed all your purchases." 
                    compact 
                  />
              )}
           </div>
        ) : (
           <div className="space-y-4">
               {historyReviews.length > 0 ? (
                   historyReviews.map((review, idx) => (
                       <div key={idx} className="bg-white p-6 rounded-xl border border-gray-100 space-y-4 shadow-sm">
                           <div className="flex items-start gap-4">
                              <div className="w-12 h-12 bg-gray-50 rounded-lg p-1 shrink-0 border border-gray-100">
                                 <img src={review.image} alt={review.name} className="w-full h-full object-contain mix-blend-multiply" />
                              </div>
                              <div className="flex-1">
                                 <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-gray-900 text-sm">{review.name}</h3>
                                    <span className="text-xs text-gray-400">{review.date}</span>
                                 </div>
                                 <div className="flex items-center gap-1 my-1">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} size={14} fill={i < review.userRating ? "#FACC15" : "none"} className={i < review.userRating ? "text-yellow-400" : "text-gray-300"} />
                                    ))}
                                 </div>
                                 <p className="text-sm text-gray-600 mt-2">"{review.userComment}"</p>
                              </div>
                           </div>
                       </div>
                   ))
               ) : (
                   <EmptyState 
                        title="No review history" 
                        description="Your past reviews will appear here." 
                        compact 
                   />
               )}
           </div>
        )}

      </div>

      {/* Rating Modal */}
      <RatingModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        product={selectedProduct} 
        onSubmit={handleRateSubmit} 
      />
    </div>
  );
};
