import { useRouter } from 'expo-router';
import { useProduct } from '@/hooks/use-product';
import type { QuizPrizeClaim } from '@/services/quiz';
import { useCartStore } from '@/stores/cart-store';
import { formatProductConditionDisplay } from '@/types/product';

interface UseQuizPrizeClaimResult {
  /** Add the won prize to the cart (as a voucher line) and open the cart. */
  claimPrize: () => void;
  /** Retry fetching the prize product after a load failure. */
  retry: () => void;
  /** True while the prize product is still loading. */
  isPreparing: boolean;
  /** True once the prize product is ready to be claimed. */
  isReady: boolean;
  /** Product-fetch error message, if any. */
  error: string | null;
}

/**
 * Turns a signed quiz `prizeClaim` into a real cart hand-off. The prize product
 * is resolved by id (the storefront product query accepts a UUID identifier),
 * then added to the cart carrying `voucher_token`/`voucher_award_id` — the
 * existing cart + order pipeline forwards these to `/api/orders`, where the
 * voucher entitlement is verified and priced server-side. Navigation lands the
 * shopper on the cart to complete checkout.
 */
export function useQuizPrizeClaim(
  prizeClaim: QuizPrizeClaim
): UseQuizPrizeClaimResult {
  const router = useRouter();
  const { product, isLoading, error, refetch } = useProduct(
    prizeClaim.productId
  );

  const claimPrize = () => {
    if (!product) return;

    const conditionDisplay = prizeClaim.condition
      ? formatProductConditionDisplay(prizeClaim.condition)
      : undefined;

    useCartStore.getState().addItem({
      product_id: prizeClaim.productId,
      slug: product.slug,
      variant_id: prizeClaim.variantId ?? undefined,
      variant_attributes: conditionDisplay
        ? { condition: conditionDisplay }
        : undefined,
      name: product.name,
      brand: product.brand,
      price: product.price,
      compare_at_price: product.compare_at_price,
      quantity: 1,
      image_url: product.image || product.images?.[0],
      condition: conditionDisplay,
      voucher_token: prizeClaim.voucherToken,
      voucher_award_id: prizeClaim.awardId,
    });

    router.push('/cart');
  };

  return {
    claimPrize,
    retry: () => {
      void refetch();
    },
    isPreparing: isLoading && !product,
    isReady: Boolean(product),
    error,
  };
}
