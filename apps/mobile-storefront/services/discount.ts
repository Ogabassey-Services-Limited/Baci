import {
  type StorefrontDiscountValidateResponse,
  StorefrontDiscountValidateResponseSchema,
} from '@baci/shared';
import Constants from 'expo-constants';
import { resolveApiBaseUrl } from '@/lib/api-url';

const API_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl
);

export interface ValidateDiscountInput {
  merchantId: string;
  code: string;
  cartTotal: number;
  productIds?: string[];
  categoryIds?: string[];
}

/**
 * Validates a storefront discount code against the web API. Optional
 * product/category ids drive a non-authoritative UX preflight only — the order
 * RPC remains the sole enforcement boundary.
 */
export async function validateDiscountCode(
  input: ValidateDiscountInput
): Promise<StorefrontDiscountValidateResponse> {
  const response = await fetch(`${API_URL}/api/storefront/discount/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: input.merchantId,
      code: input.code.trim().toUpperCase(),
      cart_total: input.cartTotal,
      ...(input.productIds?.length ? { product_ids: input.productIds } : {}),
      ...(input.categoryIds?.length ? { category_ids: input.categoryIds } : {}),
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errorBody = (await response.json()) as { error?: unknown };
      if (typeof errorBody?.error === 'string' && errorBody.error) {
        detail = `: ${errorBody.error}`;
      }
    } catch {
      // Non-JSON error body — the status code alone is enough context.
    }
    throw new Error(`Discount validation failed: ${response.status}${detail}`);
  }

  const parsed = StorefrontDiscountValidateResponseSchema.safeParse(
    await response.json()
  );
  if (!parsed.success) {
    throw new Error('Invalid discount validation response from server');
  }
  return parsed.data;
}
