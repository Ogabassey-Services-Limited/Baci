'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { CartPage } from './cart-page';

interface CartPageWrapperProps {
  merchantId: string;
  vatEnabled?: boolean;
  vatRate?: number;
}

/**
 * Cart page wrapper that handles item_id query parameter for direct add-to-cart links.
 * Supports URLs like: /cart?item_id=123 or /cart?item_id=123,456,789
 * Used by ChatGPT MCP integration and Google Shopping.
 */
export function CartPageWrapper({ merchantId, vatEnabled = false, vatRate = 7.5 }: CartPageWrapperProps) {
  const searchParams = useSearchParams();
  const { addToCart, cart } = useCart();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const processedRef = useRef(false);

  useEffect(() => {
    const itemIds = searchParams.get('item_id');

    // Only process once and only if item_id is present
    if (!itemIds || processedRef.current) return;
    processedRef.current = true;

    const fetchAndAddProducts = async () => {
      setIsLoading(true);

      try {
        // Support comma-separated IDs: item_id=123,456,789
        const ids = itemIds.split(',').map(id => id.trim()).filter(Boolean);

        if (ids.length === 0) return;

        const supabase = createClient();

        // Fetch products by ID
        const { data: products, error } = await supabase
          .from('products')
          .select('id, name, price, compare_at_price, images, image_hint, slug, manage_stock, stock_quantity, sku, has_variants, brand, condition, description')
          .eq('merchant_id', merchantId)
          .in('id', ids)
          .eq('status', 'active');

        if (error) {
          console.error('Error fetching products:', error);
          toast({
            title: 'Error',
            description: 'Could not add items to cart. Please try again.',
            variant: 'destructive',
          });
          return;
        }

        if (!products || products.length === 0) {
          toast({
            title: 'Product not found',
            description: 'The requested product could not be found.',
            variant: 'destructive',
          });
          return;
        }

        // Add each product to cart
        let addedCount = 0;
        for (const p of products) {
          // Check if already in cart
          const existsInCart = cart.some(item => item.id === p.id);
          if (!existsInCart) {
            const imageUrl = (p.images as { url: string }[])?.[0]?.url || '';
            addToCart({
              id: p.id,
              name: p.name,
              description: p.description || '',
              status: 'active',
              price: p.price,
              manage_stock: p.manage_stock ?? true,
              stock: p.stock_quantity || 0,
              image: imageUrl,
              imageLarge: imageUrl,
              imageHint: p.image_hint || '',
              brand: p.brand || '',
              gtin: '',
              mpn: '',
              slug: p.slug,
              sku: p.sku,
              has_variants: p.has_variants,
              compare_at_price: p.compare_at_price,
              condition: p.condition,
              images: p.images as { url: string; alt: string; order: number }[],
            }, 1);
            addedCount++;
          }
        }

        if (addedCount > 0) {
          toast({
            title: addedCount === 1 ? 'Added to cart' : `${addedCount} items added`,
            description: addedCount === 1
              ? `${products[0].name} has been added to your cart.`
              : `${addedCount} products have been added to your cart.`,
          });
        }

        // Clean up URL by removing item_id parameter
        const url = new URL(window.location.href);
        url.searchParams.delete('item_id');
        window.history.replaceState({}, '', url.pathname);

      } catch (err) {
        console.error('Error adding products to cart:', err);
        toast({
          title: 'Error',
          description: 'Something went wrong. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndAddProducts();
  }, [searchParams, merchantId, addToCart, cart, toast]);

  // Show loading state while adding items
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-700 border-t-red-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Adding items to cart...</p>
        </div>
      </div>
    );
  }

  return <CartPage vatEnabled={vatEnabled} vatRate={vatRate} />;
}
