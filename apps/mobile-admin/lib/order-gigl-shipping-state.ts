import type { QueryClient } from '@tanstack/react-query';
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

export function toOrderGiglWalletState(result: OrderGiglWalletState) {
  return {
    availableBalance: result.availableBalance,
    canBook: result.canBook,
    shortfall: result.shortfall,
  };
}

export function invalidateOrderGiglFundingQueries(
  client: QueryClient,
  orderId: string
) {
  client.invalidateQueries({ queryKey: ['order', orderId] });
  client.invalidateQueries({ queryKey: ['orders'] });
  client.invalidateQueries({ queryKey: ['order-counts'] });
  client.invalidateQueries({ queryKey: ['dashboard-stats'] });
  client.invalidateQueries({ queryKey: ['merchant-wallet'] });
}

export interface OrderGiglInitialAddress {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface OrderGiglShippingParams {
  enabled: boolean;
  initialAddress?: OrderGiglInitialAddress;
  orderId: string;
  preview?: boolean;
}

export function toOrderGiglAddressDraft(
  address?: OrderGiglInitialAddress
): Partial<OrderGiglReceiver> {
  const latitude =
    typeof address?.latitude === 'number' && Number.isFinite(address.latitude)
      ? address.latitude
      : undefined;
  const longitude =
    typeof address?.longitude === 'number' && Number.isFinite(address.longitude)
      ? address.longitude
      : undefined;
  const hasCoordinates = latitude !== undefined && longitude !== undefined;
  return {
    ...(address?.address ? { address: address.address } : {}),
    ...(address?.city ? { city: address.city } : {}),
    ...(address?.state ? { state: address.state } : {}),
    ...(address?.phone ? { phone: address.phone } : {}),
    ...(hasCoordinates ? { latitude, longitude } : {}),
  };
}

export function toCompleteOrderGiglReceiver(
  draft: Partial<OrderGiglReceiver>
): OrderGiglReceiver | undefined {
  const hasCoordinates =
    Number.isFinite(draft.latitude) && Number.isFinite(draft.longitude);
  const hasLocality = Boolean(draft.city && draft.state);
  if (!draft.address || !draft.phone || (!hasLocality && !hasCoordinates)) {
    return undefined;
  }
  return {
    address: draft.address,
    ...(draft.city ? { city: draft.city } : {}),
    ...(draft.state ? { state: draft.state } : {}),
    phone: draft.phone,
    ...(hasCoordinates
      ? { latitude: draft.latitude, longitude: draft.longitude }
      : {}),
  };
}

export function isOrderGiglQuoteFresh(quote: OrderGiglQuote, now = Date.now()) {
  const expiry = new Date(quote.expiresAt).getTime();
  return Number.isFinite(expiry) && expiry - now > GIGL_CONFIRMATION_SAFETY_MS;
}
