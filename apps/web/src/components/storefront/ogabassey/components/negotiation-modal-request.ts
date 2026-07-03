import {
  buildCartSnapshot,
  buildNegotiationSingleItemInfo,
  normalizePhoneToE164,
  summarizeCartForItemInfo,
} from '@baci/shared/lib';
import type { CartItem } from '@/hooks/cart';
import type { createClient } from '@/lib/supabase/client';
import { toNegotiationCartLine } from './negotiation-modal-cart';
import {
  getContactValidationError,
  NegotiationValidationError,
  normalizeOptionalEmail,
} from './negotiation-modal-validation';

const SESSION_KEY = 'ogabassey_guest_session';

export interface NegotiationRequestInput {
  merchantId: string;
  type: 'single' | 'total';
  itemId?: string;
  productSlug?: string;
  productName: string;
  productBrand?: string;
  currentPrice: number;
  offeredPrice: number;
  evidenceUrl?: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  variantId?: string;
  variantName?: string;
  variantAttributes?: Record<string, string>;
  condition?: string;
  cart?: CartItem[];
}

function createGuestSessionId(): string {
  return `web-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`}`;
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return `web-${Date.now()}`;

  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const id = createGuestSessionId();
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return createGuestSessionId();
  }
}

export async function insertNegotiationRequest(
  supabase: ReturnType<typeof createClient>,
  request: NegotiationRequestInput
): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    console.warn('Auth check failed, continuing as guest:', authError.message);
  }

  const validationError = getContactValidationError({
    email: request.customerEmail ?? '',
    phone: request.customerPhone ?? '',
  });
  if (validationError) {
    throw new NegotiationValidationError(validationError);
  }

  const normalizedPhone = normalizePhoneToE164(request.customerPhone);
  const normalizedEmail = normalizeOptionalEmail(request.customerEmail);

  const cartSnapshot =
    request.type === 'total'
      ? buildCartSnapshot((request.cart ?? []).map(toNegotiationCartLine))
      : [];
  if (request.type === 'total' && cartSnapshot.length === 0) {
    throw new NegotiationValidationError(
      'Whole-cart negotiations require at least one cart item.'
    );
  }
  const totalItemInfo =
    request.type === 'total'
      ? summarizeCartForItemInfo(cartSnapshot, request.currentPrice)
      : null;

  const { error } = await supabase.from('negotiation_requests').insert({
    merchant_id: request.merchantId,
    session_id: getOrCreateSessionId(),
    customer_id: user?.id ?? null,
    type: request.type,
    item_info:
      request.type === 'single'
        ? buildNegotiationSingleItemInfo(request)
        : totalItemInfo,
    cart_snapshot: cartSnapshot.length > 0 ? cartSnapshot : null,
    offered_price: request.offeredPrice,
    evidence_url: request.evidenceUrl || null,
    customer_email: normalizedEmail,
    customer_phone: normalizedPhone,
    status: 'pending',
  });

  if (error) throw error;
}
