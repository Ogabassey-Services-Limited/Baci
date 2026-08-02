import { createClient } from '@/lib/supabase/server';

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
