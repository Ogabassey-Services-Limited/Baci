import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

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
  merchantSlug: string;
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

    const supabase = await createClient();
    const { error } = await supabase.rpc('record_santa_interaction', {
      p_merchant_slug: params.merchantSlug,
      p_session_id: params.sessionId,
      p_client_ip: params.clientIp.slice(0, 64),
      p_interaction_type: params.interactionType,
      p_user_message: params.userMessage?.slice(0, 500),
      p_santa_response: params.santaResponse?.slice(0, 1000),
      p_product_name: params.productName?.slice(0, 200),
      p_requested_price: params.requestedPrice,
      p_approved_price: params.approvedPrice,
      p_discount_percentage: discountPercentage,
    });

    if (error) {
      console.error('[Santa Analytics] Failed to log interaction:', error);
    }
  } catch (error) {
    console.error('[Santa Analytics] Failed to log interaction:', error);
  }
}
