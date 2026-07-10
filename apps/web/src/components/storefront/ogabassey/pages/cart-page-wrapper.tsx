'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/hooks/cart';
import { useToast } from '@/hooks/use-toast';
import {
  getPrimaryProductImage,
  PRODUCT_IMAGE_PLACEHOLDER_URL,
} from '@/lib/product-image';
import { createClient } from '@/lib/supabase/client';
import { CartPage } from './cart-page';

const QUIZ_PRIZE_PLATFORM = 'quiz_prize';

interface CartPageWrapperProps {
  merchantId: string;
  vatEnabled?: boolean;
  vatRate?: number;
}

interface FetchAndAddCartItemsOptions {
  itemIds: string;
  quizAwardId: string | null;
  quizVoucherToken: string | null;
  variantId?: string;
  condition?: string;
  merchantId: string;
  cart: ReturnType<typeof useCart>['cart'];
  addToCart: ReturnType<typeof useCart>['addToCart'];
  toast: ReturnType<typeof useToast>['toast'];
  setIsLoading: (loading: boolean) => void;
}

// Module-scope helper: keeps the try/finally out of the component body so
// React Compiler can memoize CartPageWrapper.
async function fetchAndAddCartItems({
  itemIds,
  quizAwardId,
  quizVoucherToken,
  variantId,
  condition,
  merchantId,
  cart,
  addToCart,
  toast,
  setIsLoading,
}: FetchAndAddCartItemsOptions): Promise<void> {
  const hasQuizPrizeVoucher = Boolean(quizAwardId && quizVoucherToken);

  // A prize is redeemed as its OWN order; the server rejects a cart that mixes
  // the voucher with paid items (QUIZ_VOUCHER_MIXED_CART_UNSUPPORTED). Block the
  // claim here — mirror of the mobile claim guard — so the shopper isn't sent
  // through checkout only to hit a 400 and have to unwind the cart by hand.
  if (hasQuizPrizeVoucher && cart.some((item) => !item.quizAwardId)) {
    toast({
      title: 'Check out your prize separately',
      description:
        'Your cart has other items. Check out or empty your cart first, then claim your prize.',
      variant: 'destructive',
    });
    return;
  }

  setIsLoading(true);

  try {
    // Support comma-separated IDs: item_id=123,456,789
    const ids = itemIds.split(',').map(id => id.trim()).filter(Boolean);

    if (ids.length === 0) return;

    const supabase = createClient();

    // Fetch products by ID
    const { data: products, error } = await supabase
      .from('products')
      .select(
        'id, name, description, status, price, manage_stock, stock, brand, gtin, mpn, merchant_id, images, imageHint:image_hint'
      )
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

    const activeProducts = products.filter(
      (product) => product.status === 'active'
    );
    if (activeProducts.length === 0) {
      toast({
        title: 'Product not found',
        description: 'The requested product could not be found.',
        variant: 'destructive',
      });
      return;
    }

    // Add each product to cart
    let addedCount = 0;
    for (const product of activeProducts) {
      const resolvedImage =
        getPrimaryProductImage(product.images) ||
        PRODUCT_IMAGE_PLACEHOLDER_URL;
      // Check if already in cart
      const existsInCart = hasQuizPrizeVoucher
        ? cart.some(item => item.quizAwardId === quizAwardId)
        : cart.some(item => item.id === product.id && !item.quizAwardId);
      if (!existsInCart) {
        addToCart(
          {
            ...product,
            image: resolvedImage,
            imageLarge: resolvedImage,
          },
          1,
          hasQuizPrizeVoucher
            ? {
                condition,
                platform: QUIZ_PRIZE_PLATFORM,
                quizAwardId: quizAwardId ?? undefined,
                quizVoucherToken: quizVoucherToken ?? undefined,
                variantId,
              }
            : undefined
        );
        addedCount++;
      }
    }

    if (addedCount > 0) {
      toast({
        title: addedCount === 1 ? 'Added to cart' : `${addedCount} items added`,
        description: addedCount === 1
          ? `${activeProducts[0].name} has been added to your cart.`
          : `${addedCount} products have been added to your cart.`,
      });
    }

    // Clean up URL by removing item_id parameter
    const url = new URL(window.location.href);
    url.searchParams.delete('item_id');
    url.searchParams.delete('quiz_award_id');
    url.searchParams.delete('quiz_voucher_token');
    url.searchParams.delete('variant_id');
    url.searchParams.delete('condition');
    window.history.replaceState(
      {},
      '',
      `${url.pathname}${url.search}${url.hash}`
    );
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
    const quizAwardId = searchParams.get('quiz_award_id')?.trim() || null;
    const quizVoucherToken =
      searchParams.get('quiz_voucher_token')?.trim() || null;
    const variantId = searchParams.get('variant_id')?.trim() || undefined;
    const condition = searchParams.get('condition')?.trim() || undefined;

    // Only process once and only if item_id is present
    if (!itemIds || processedRef.current) return;
    processedRef.current = true;

    void fetchAndAddCartItems({
      itemIds,
      quizAwardId,
      quizVoucherToken,
      variantId,
      condition,
      merchantId,
      cart,
      addToCart,
      toast,
      setIsLoading,
    });
  }, [searchParams, merchantId, addToCart, cart, toast]);

  // Show loading state while adding items
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-store-background">
        <div className="text-center">
          <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-4 border-store-background-text/18 border-t-(--store-primary)" />
          <p className="text-store-background-text/65">
            Adding items to cart…
          </p>
        </div>
      </div>
    );
  }

  return <CartPage vatEnabled={vatEnabled} vatRate={vatRate} />;
}
