'use client';

import { Plus, Sparkles, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import {
  normalizeProductCondition,
  type Product,
} from '@/components/storefront/ogabassey/types';

interface UpsellToastProps {
  isVisible: boolean;
  onClose: () => void;
  triggerProduct: Product | null;
  merchantId?: string;
  storeSlug?: string;
}

const PRICE_FORMATTER = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
});

/**
 * Fetch a semantically relevant product from the SAME category (Koray SEO
 * aligned). Module-scope helper so the component body stays free of
 * try/finally (React Compiler cannot lower try statements with finalizers).
 */
async function fetchUpsellSuggestion(
  triggerProduct: Product,
  merchantId: string | undefined
): Promise<Product | null> {
  try {
    const category = triggerProduct.categorySlug || triggerProduct.category;
    const params = new URLSearchParams({
      limit: '4',
      compact: 'true',
      has_images: 'true',
    });

    // Filter to same category for semantic relevance
    if (category) {
      params.append('category', category);
    }

    if (merchantId) {
      params.append('merchant_id', merchantId);
    }

    const res = await fetch(`/api/storefront/products?${params.toString()}`);
    const data = await res.json();

    // Filter out the trigger product and pick a random suggestion
    const candidates = (data.products || []).filter(
      (p: any) => String(p.id) !== String(triggerProduct.id)
    );

    if (candidates.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * candidates.length);
    const rawProduct = candidates[randomIndex];

    // Transform to Product type
    return {
      id: rawProduct.id,
      name: rawProduct.name,
      slug: rawProduct.slug,
      price: PRICE_FORMATTER.format(rawProduct.price),
      rawPrice: rawProduct.price,
      image: rawProduct.imageLarge || rawProduct.image,
      images: [rawProduct.imageLarge || rawProduct.image],
      description: rawProduct.description,
      rating: rawProduct.rating || 0,
      category: rawProduct.category,
      categorySlug: rawProduct.categorySlug,
      condition: normalizeProductCondition(rawProduct.condition) || 'new',
      brand: rawProduct.brand,
      merchantId: rawProduct.merchantId,
    };
  } catch (err) {
    console.error('Failed to fetch upsell suggestion:', err);
    return null;
  }
}

export const UpsellToast: React.FC<UpsellToastProps> = ({
  isVisible,
  onClose,
  triggerProduct,
  merchantId,
  storeSlug,
}) => {
  const { addToCart } = useCart();
  const [suggestion, setSuggestion] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVisible && triggerProduct) {
      const loadSuggestion = async () => {
        setLoading(true);
        const product = await fetchUpsellSuggestion(triggerProduct, merchantId);
        setSuggestion(product);
        setLoading(false);
      };

      loadSuggestion();

      // Auto dismiss after 8 seconds
      const timer = setTimeout(onClose, 8000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, triggerProduct, merchantId, onClose]);

  if (!isVisible || loading || !suggestion) return null;

  const handleAddSuggestion = () => {
    addToCart(suggestion as any, 1);
    onClose();
  };

  return (
    <div className="fixed bottom-24 left-4 right-4 md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:w-auto md:min-w-[400px] z-90 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-red-100 p-4 relative overflow-hidden">
        {/* AI Background Effect */}
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <Sparkles className="text-red-600 size-16" />
        </div>

        <button type="button"
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1 bg-white/50 rounded-full"
        >
          <X size={16} />
        </button>

        <div className="flex gap-4 items-start relative z-10">
          <div className="size-10 rounded-full bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
            <Sparkles size={18} className="text-red-600" />
          </div>

          <div className="flex-1">
            <h4 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
              Great choice! Complete the set?
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              Customers who bought{' '}
              <span className="font-medium text-gray-800">
                {triggerProduct?.name}
              </span>{' '}
              also added this:
            </p>

            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-100">
              <div className="ogabassey-product-card-image-surface size-10 bg-white rounded-lg p-1 flex items-center justify-center border border-gray-100 shrink-0">
                <img
                  src={suggestion.image}
                  alt={suggestion.name}
                  className="w-full h-full object-contain mix-blend-multiply"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {suggestion.name}
                </p>
                <p className="text-[10px] text-red-600 font-bold">
                  {suggestion.price}
                </p>
              </div>
              <button type="button"
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
