import { resolveAgenticChatTenant } from '@/lib/agentic/agentic-chat-tenant';
import { createAnonClient } from '@/lib/supabase/anon';

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

    // Insert via a bounded SECURITY DEFINER RPC using the RLS-scoped anon
    // client — NOT a service-role client. santa_interactions grants INSERT only
    // to service_role, so this anonymous storefront endpoint must go through the
    // definer boundary rather than construct a privileged client in the request
    // graph (see 20260726120000_log_santa_interaction_rpc.sql).
    const supabase = createAnonClient();

    const { error } = await supabase.rpc('log_santa_interaction', {
      p_merchant_id: tenant.merchantId,
      p_session_id: params.sessionId,
      p_client_ip: params.clientIp.slice(0, 64), // Truncate for privacy
      p_interaction_type: params.interactionType,
      p_user_message: params.userMessage?.slice(0, 500) ?? null, // Truncate
      p_santa_response: params.santaResponse?.slice(0, 1000) ?? null, // Truncate
      p_product_name: params.productName ?? null,
      p_requested_price: params.requestedPrice ?? null,
      p_approved_price: params.approvedPrice ?? null,
      p_discount_percentage: calculateDiscountPercentage(
        params.requestedPrice,
        params.approvedPrice
      ),
    });

    if (error) {
      console.error(
        '[Santa Analytics] Failed to log interaction:',
        error.message
      );
    }
  } catch (error) {
    // Log but don't fail the request
    console.error('[Santa Analytics] Failed to log interaction:', error);
  }
}
