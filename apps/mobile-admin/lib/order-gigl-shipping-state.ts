import type { OrderGiglQuote, OrderGiglReceiver } from './order-gigl-shipping';

export const GIGL_CONFIRMATION_SAFETY_MS = 30_000;
export const GIGL_POLL_INTERVAL_MS = 3_000;
export const GIGL_MAX_POLL_COUNT = 20;

export type OrderGiglShippingState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'missing_address'
  | 'funding'
  | 'funding_pending'
  | 'polling'
  | 'error';

export interface OrderGiglWalletState {
  availableBalance: number;
  canBook: boolean;
  shortfall: number;
}

export interface OrderGiglInitialAddress {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
}

export interface OrderGiglShippingParams {
  enabled: boolean;
  initialAddress?: OrderGiglInitialAddress;
  orderId: string;
}

export function toOrderGiglAddressDraft(
  address?: OrderGiglInitialAddress
): Partial<OrderGiglReceiver> {
  return {
    ...(address?.address ? { address: address.address } : {}),
    ...(address?.city ? { city: address.city } : {}),
    ...(address?.state ? { state: address.state } : {}),
    ...(address?.phone ? { phone: address.phone } : {}),
  };
}

export function toCompleteOrderGiglReceiver(
  draft: Partial<OrderGiglReceiver>
): OrderGiglReceiver | undefined {
  if (!draft.address || !draft.city || !draft.state || !draft.phone) {
    return undefined;
  }
  return {
    address: draft.address,
    city: draft.city,
    state: draft.state,
    phone: draft.phone,
  };
}

export function isOrderGiglQuoteFresh(quote: OrderGiglQuote, now = Date.now()) {
  const expiry = new Date(quote.expiresAt).getTime();
  return Number.isFinite(expiry) && expiry - now > GIGL_CONFIRMATION_SAFETY_MS;
}
