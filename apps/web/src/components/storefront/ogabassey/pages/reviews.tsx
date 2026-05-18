'use client';

import { Loader2, Star, X } from 'lucide-react';
import Image from 'next/image';
import type React from 'react';
import { useState, useEffect } from 'react';
import { EmptyState } from '../components/empty-state';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import type { StorefrontTransformedOrder, StorefrontTransformedOrderItem } from '@baci/shared';

interface Product {
  id: string;
  name: string;
  image: string;
  price: string;
}



interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSubmit: (rating: number) => void;
}

const RatingModal: React.FC<RatingModalProps> = ({
  isOpen,
  onClose,
  product,
  onSubmit,
}) => {
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
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl relative z-10 p-6 animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gray-50 rounded-xl border border-gray-100 p-2 mx-auto mb-4 flex items-center justify-center relative">
            <Image
              src={product.image}
              alt={product.name}
              fill sizes="64px"
              className="object-contain mix-blend-multiply p-2"
            />
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-1">
            {product.name}
          </h3>
          <p className="text-sm text-gray-500">
            How would you rate this product?
          </p>
        </div>

        {/* Star Rating Interaction */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              className="transition-transform hover:scale-110 active:scale-95 focus:outline-hidden"
            >
              <Star
                size={32}
                className={`transition-colors duration-200 ${(hoverRating || rating) >= star
                  ? 'fill-yellow-400 text-yellow-400 drop-shadow-xs'
                  : 'text-gray-200 fill-gray-50'
                  }`}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>

        {/* Feedback Text */}
        <div className="text-center text-sm font-bold text-gray-900 h-6 mb-6">
          {(hoverRating || rating) === 1 && 'Poor 😞'}
          {(hoverRating || rating) === 2 && 'Fair 😐'}
          {(hoverRating || rating) === 3 && 'Good 🙂'}
          {(hoverRating || rating) === 4 && 'Very Good 😄'}
          {(hoverRating || rating) === 5 && 'Excellent! 🤩'}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={rating === 0 || isSubmitting}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-red-200 active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            'Submit Review'
          )}
        </button>
      </div>
    </div>
  );
};

export const OgabasseyV2Reviews: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { customer, isAuthenticated } = useCustomerAuth();
  const { merchant } = useMerchantSafe() || {};

  const [orders, setOrders] = useState<StorefrontTransformedOrder[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated || !merchant?.slug || !customer?.email) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 1. Fetch Orders to find pending reviews
        const ordersRes = await fetch(
          `/api/storefront/orders?merchantSlug=${merchant.slug}`
        );
        const ordersData = await ordersRes.json();

        // 2. Fetch User's History of Reviews
        const reviewsRes = await fetch(
          `/api/reviews?merchantId=${merchant.id}&customerEmail=${encodeURIComponent(customer.email)}`
        );
        const reviewsData = await reviewsRes.json();

        if (ordersData.orders) setOrders(ordersData.orders);
        if (reviewsData.reviews) setReviews(reviewsData.reviews);
      } catch (err) {
        console.error('Failed to fetch review data', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, merchant?.slug, merchant?.id, customer?.email]);

  // Derive "Pending" items from Delivered orders
  // Flatten orders into items, filter only delivered, exclude items already reviewed
  const pendingItems = orders
    .filter((o) => o.shipping_status === 'delivered' || o.status === 'Delivered') // Support both status fields
    .flatMap((order) =>
      (order.items ?? []).map((item) => ({
        ...item,
        orderDate: order.created_at,
        orderId: order.id,
        // Ensure image structure matches Product interface
        image: item.image || item.product_image || '/placeholder.png',
        price: item.price,
      }))
    )
    .filter((item) => {
      // Check if this product has already been reviewed by the user
      // Note: This check is simple; robust systems might allow re-reviewing different instances
      return !reviews.some((r) => r.product_id === item.id || r.product_id === item.product_id);
    });

  const handleOpenRate = (item: StorefrontTransformedOrderItem) => {
    // Map item to Product interface expected by modal
    const productToRate: Product = {
      id: item.id || item.product_id, // fallback
      name: item.name,
      image: item.image || item.image_url || '/placeholder.png',
      price: item.price?.toString() || '0',
    };
    setSelectedProduct(productToRate);
    setIsModalOpen(true);
  };

  const handleRateSubmit = async (rating: number) => {
    if (!selectedProduct || !merchant || !customer) return;

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          merchantId: merchant.id,
          customerEmail: customer.email,
          customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Anonymous',
          rating,
          body: 'Rated via Quick Rate', // Simple default or expand modal to capture text
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Optimistically update UI
        const newReview = {
          ...data.review,
          products: {
            name: selectedProduct.name,
            images: [selectedProduct.image],
          },
        };

        setReviews((prev) => [newReview, ...prev]);
        setActiveTab('history');
      }
    } catch (err) {
      console.error('Failed to submit review', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Star className="text-red-600 fill-red-600" />
          My Reviews
        </h1>

        <div className="flex border-b border-gray-200 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`pb-3 px-6 font-medium text-sm transition-colors relative ${activeTab === 'pending' ? 'text-red-600' : 'text-gray-500 hover:text-gray-800'}`}
          >
            To Review ({pendingItems.length})
            {activeTab === 'pending' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-6 font-medium text-sm transition-colors relative ${activeTab === 'history' ? 'text-red-600' : 'text-gray-500 hover:text-gray-800'}`}
          >
            History ({reviews.length})
            {activeTab === 'history' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
            )}
          </button>
        </div>

        {activeTab === 'pending' ? (
          <div className="space-y-4">
            {pendingItems.length > 0 ? (
              pendingItems.map((item, idx) => (
                <div
                  // Use composite key if needed, or fallback
                  key={`${item.id}-${idx}`}
                  className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="w-16 h-16 bg-gray-50 rounded-lg p-2 shrink-0 border border-gray-100 relative">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill sizes="64px"
                      className="object-contain mix-blend-multiply p-1"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-sm mb-1">
                      {item.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Purchased on {new Date(item.orderDate).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenRate(item)}
                    className="bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm active:scale-95"
                  >
                    Rate Now
                  </button>
                </div>
              ))
            ) : (
              <EmptyState
                variant="reviews"
                title="No Pending Reviews"
                description="You have reviewed all your purchases."
                compact
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white p-6 rounded-xl border border-gray-100 space-y-4 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-50 rounded-lg p-1 shrink-0 border border-gray-100 relative">
                      <Image
                        // Handle joined product data structure
                        src={review.products?.images?.[0] || '/placeholder.png'}
                        alt={review.products?.name || 'Product'}
                        fill sizes="48px"
                        className="object-contain mix-blend-multiply p-1"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-gray-900 text-sm">
                          {review.products?.name || 'Product Name'}
                        </h3>
                        <span className="text-xs text-gray-400">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 my-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            fill={i < review.rating ? '#FACC15' : 'none'}
                            className={
                              i < review.rating
                                ? 'text-yellow-400'
                                : 'text-gray-300'
                            }
                          />
                        ))}
                      </div>
                      {review.body && (
                        <p className="text-sm text-gray-600 mt-2">
                          &quot;{review.body}&quot;
                        </p>
                      )}

                      {/* Status Badge */}
                      <div className='mt-2'>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${review.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : review.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                          }`}>
                          {review.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                variant="history"
                title="No Review History"
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
