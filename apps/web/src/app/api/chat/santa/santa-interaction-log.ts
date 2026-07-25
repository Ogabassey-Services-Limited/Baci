import { resolveAgenticChatTenant } from '@/lib/agentic/agentic-chat-tenant';
import { createServiceClient } from '@/lib/supabase/service';

export type SantaInteractionType =
  | 'chat'
  | 'wish_granted'
  | 'wish_denied'
  | 'add_to_cart'
  | 'checkout_started'
  | 'checkout_completed';

export interface SantaInteractionLogParams {
  sessionId: string;
  clientIp: string;
  interactionType: SantaInteractionType;
  userMessage?: string;
  santaResponse?: string;
  productName?: string;
  requestedPrice?: number;
  approvedPrice?: number;
}

function calculateDiscountPercentage(
  requestedPrice?: number,
  approvedPrice?: number
): number | null {
  if (!(approvedPrice && requestedPrice) || requestedPrice <= approvedPrice) {
    return null;
  }
  return ((requestedPrice - approvedPrice) / requestedPrice) * 100;
}

/**
 * Log a Santa interaction asynchronously (fire and forget).
 *
 * The tenant is resolved from BACI_AGENTIC_MERCHANT_SLUG rather than a hardcoded
 * merchant UUID. When it cannot be resolved the insert is skipped entirely —
 * analytics rows must never be attributed to an unknown merchant.
 */
export async function logSantaInteraction(
  params: SantaInteractionLogParams
): Promise<void> {
  try {
    const tenant = await resolveAgenticChatTenant();
    if (!tenant) {
      console.error(
        '[Santa Analytics] Skipping log — copilot tenant is not configured'
      );
      return;
    }

    const serviceClient = createServiceClient();

    await serviceClient.from('santa_interactions').insert({
      merchant_id: tenant.merchantId,
      session_id: params.sessionId,
      client_ip: params.clientIp.slice(0, 64), // Truncate for privacy
      interaction_type: params.interactionType,
      user_message: params.userMessage?.slice(0, 500), // Truncate for storage
      santa_response: params.santaResponse?.slice(0, 1000), // Truncate
      product_name: params.productName,
      requested_price: params.requestedPrice,
      approved_price: params.approvedPrice,
      discount_percentage: calculateDiscountPercentage(
        params.requestedPrice,
        params.approvedPrice
      ),
    });
  } catch (error) {
    // Log but don't fail the request
    console.error('[Santa Analytics] Failed to log interaction:', error);
  }
}
