import crypto from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';

export function generateSessionId(ip: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ip}-santa-2024`)
    .digest('hex')
    .slice(0, 16);
}

export function parseWishResult(response: string): {
  type: 'wish_granted' | 'wish_denied' | 'chat';
  productName?: string;
  approvedPrice?: number;
} {
  if (response.includes('ACTION:ADD_TO_CART')) {
    const productMatch = response.match(/PRODUCT:([^|]+)/);
    const priceMatch = response.match(/PRICE:([^|\s]+)/);

    return {
      type: 'wish_granted',
      productName: productMatch?.[1]?.trim(),
      approvedPrice: priceMatch?.[1]
        ? Number(priceMatch[1].replace(/[₦,N\s]/g, ''))
        : undefined,
    };
  }

  const isDenied =
    /budget.*below/i.test(response) ||
    /can't.*approve/i.test(response) ||
    /cannot.*grant/i.test(response) ||
    /workshop has costs/i.test(response) ||
    /save up/i.test(response) ||
    /payment plan/i.test(response);

  return { type: isDenied ? 'wish_denied' : 'chat' };
}

export async function logSantaInteraction(params: {
  merchantId: string;
  sessionId: string;
  clientIp: string;
  interactionType:
    | 'chat'
    | 'wish_granted'
    | 'wish_denied'
    | 'add_to_cart'
    | 'checkout_started'
    | 'checkout_completed';
  userMessage?: string;
  santaResponse?: string;
  productName?: string;
  requestedPrice?: number;
  approvedPrice?: number;
}): Promise<void> {
  try {
    const serviceClient = createServiceClient();
    let discountPercentage: number | null = null;
    if (
      params.approvedPrice &&
      params.requestedPrice &&
      params.requestedPrice > params.approvedPrice
    ) {
      discountPercentage =
        ((params.requestedPrice - params.approvedPrice) /
          params.requestedPrice) *
        100;
    }

    const { error } = await serviceClient.from('santa_interactions').insert({
      merchant_id: params.merchantId,
      session_id: params.sessionId,
      client_ip: params.clientIp.slice(0, 64),
      interaction_type: params.interactionType,
      user_message: params.userMessage?.slice(0, 500),
      santa_response: params.santaResponse?.slice(0, 1000),
      product_name: params.productName,
      requested_price: params.requestedPrice,
      approved_price: params.approvedPrice,
      discount_percentage: discountPercentage,
    });

    if (error) {
      console.error('[Santa Analytics] Failed to log interaction:', error);
    }
  } catch (error) {
    console.error('[Santa Analytics] Failed to log interaction:', error);
  }
}
