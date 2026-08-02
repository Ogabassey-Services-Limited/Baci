/**
 * Shipping Provider Types
 * Unified interfaces for GIGL and Topship integration
 */

// =============================================================================
// PROVIDER CODES
// =============================================================================

export const SHIPPING_PROVIDER_CODES = ['GIGL', 'TOPSHIP'] as const;

export type ShippingProviderCode = (typeof SHIPPING_PROVIDER_CODES)[number];

/**
 * A provider returned a definitive rejection for a booking attempt. Unlike a
 * timeout or transport error, this means the caller can safely allow a retry.
 */
export class ShippingBookingRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShippingBookingRejectedError';
  }
}

/**
 * Merchant-configured rates surface as quotes with this provider code.
 *
 * It is intentionally kept OUT of `SHIPPING_PROVIDER_CODES` (and therefore out
 * of `ShippingProviderCode`): that tuple drives carrier-only paths such as
 * `isShippingProviderCode`, quote persistence, and booking. Merchant rates are
 * computed from config and never booked with a carrier, so only the
 * display-facing `ShippingQuote.provider` union is widened to include it.
 */
export const MERCHANT_PROVIDER_CODE = 'MERCHANT' as const;

export type MerchantProviderCode = typeof MERCHANT_PROVIDER_CODE;

/** Provider code for a quote shown to the customer (carrier or merchant). */
export type QuoteProviderCode = ShippingProviderCode | MerchantProviderCode;

// =============================================================================
// ADDRESS TYPES
// =============================================================================

export interface ShippingAddress {
  name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  // GIGL-specific
  stationId?: number;
  stationName?: string;
}

// =============================================================================
// ITEM TYPES
// =============================================================================

export interface ShipmentItem {
  name: string;
  quantity: number;
  weight: number; // kg
  value: number; // Naira
  category?: string; // For Topship categories
  hsCode?: string; // For international shipments
  length?: number; // cm, for international volumetric pricing
  width?: number; // cm, for international volumetric pricing
  height?: number; // cm, for international volumetric pricing
  description?: string;
}

// =============================================================================
// QUOTE TYPES
// =============================================================================

export interface QuoteRequest {
  sessionId: string;
  merchantId?: string;
  /**
   * Carrier providers the merchant has explicitly enabled. Omit this field for
   * platform-level quotes without a merchant context; an empty array means the
   * merchant has opted out of all carrier rates.
   */
  enabledProviderCodes?: readonly ShippingProviderCode[];
  sender?: ShippingAddress; // Uses merchant address if not provided
  receiver: ShippingAddress;
  items: ShipmentItem[];
  shipmentType: 'domestic' | 'international';
  deliveryPreference?: 'door' | 'pickup_station';
}

export interface ShippingQuote {
  id: string; // UUID for DB storage
  provider: QuoteProviderCode; // Carrier code, or 'MERCHANT' for merchant rates
  serviceTier: string; // Budget, Express, Premium, etc.
  carrierName: string; // Actual carrier: DHL, FedEx, GIG Logistics
  displayName: string; // Customer-facing name: "Express Delivery"
  estimatedDays: number;
  deliveryRange?: string; // Human-readable range (e.g. "3-5 days")
  minDays?: number;
  maxDays?: number;
  price: number; // Naira (normalized, includes insurance)
  currency: 'NGN' | string;
  pickupIncluded: boolean;
  insuranceIncluded: boolean;
  providerRateId?: string; // For booking with provider
  expiresAt: Date;
  rawResponse?: unknown; // Raw provider response for debugging

  // Station pickup (for areas without home delivery)
  isStationPickup?: boolean;
  stationId?: number;
  stationName?: string;
  stationAddress?: string;
  // Collection directions the shopper follows at the pickup point (merchant
  // rates surface `pickupAddress.instructions` here so the client can show them
  // before a pickup is chosen — the raw quote metadata is dropped downstream).
  stationInstructions?: string;
  stationCode?: string;
  // Legacy aliases
  pickupStationId?: number;
  pickupStationName?: string;
  pickupStationAddress?: string;
  pickupStationCode?: string;
}

export interface QuoteResponse {
  quotes: {
    featured: ShippingQuote[]; // Top 3: cheapest, fastest, recommended
    all: ShippingQuote[]; // All available quotes
  };
  sessionId: string;
  expiresAt: string;
  warnings?: string[]; // Any provider errors/warnings
}

// =============================================================================
// BOOKING TYPES
// =============================================================================

export interface BookingRequest {
  orderId: string;
  quoteId: string;
  merchantId?: string;
  providerRateId?: string; // Provider-specific rate ID for booking
  quoteMetadata?: unknown; // Stored provider quote metadata for booking
  sender: ShippingAddress;
  receiver: ShippingAddress;
  items: ShipmentItem[];
  pickupType?: 'pickup' | 'dropoff';
  instructions?: string;
  specialInstructions?: string;
}

export interface ShipmentBookingResult {
  provider: ShippingProviderCode;
  providerShipmentId: string;
  trackingNumber: string;
  carrierName: string;
  labelUrl?: string;
  estimatedDelivery?: Date;
  pickupScheduledAt?: Date;
  status: NormalizedShipmentStatus;
  isStationPickup?: boolean;
  pickupStationName?: string;
  pickupStationAddress?: string;
  rawResponse?: unknown;
}

// =============================================================================
// TRACKING TYPES
// =============================================================================

export interface TrackingEvent {
  status: string;
  description: string;
  location?: string;
  timestamp: Date;
  rawStatus?: string; // Original status from provider
}

export interface TrackingResult {
  provider: ShippingProviderCode;
  trackingNumber: string;
  status: NormalizedShipmentStatus;
  carrierName: string;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  events: TrackingEvent[];
  isStationPickup?: boolean;
  pickupStationName?: string;
  pickupStationAddress?: string;
}

// =============================================================================
// STATUS TYPES
// =============================================================================

export type NormalizedShipmentStatus =
  | 'pending'
  | 'booked'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'failed'
  | 'returned';

export const SHIPMENT_STATUS_LABELS: Record<NormalizedShipmentStatus, string> =
  {
    pending: 'Pending',
    booked: 'Booked',
    pickup_scheduled: 'Pickup Scheduled',
    picked_up: 'Picked Up',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    failed: 'Failed',
    returned: 'Returned',
  };

// =============================================================================
// CANCELLATION TYPES
// =============================================================================

export interface CancellationResult {
  success: boolean;
  message: string;
  refundAmount?: number;
  refundCurrency?: string;
}

// =============================================================================
// SELF-FULFILLMENT TYPES
// =============================================================================

export interface SelfFulfillmentData {
  trackingNumber?: string | null;
  dispatchPhone?: string | null;
  carrierName?: string;
}

// =============================================================================
// DATABASE TYPES (matching Supabase schema)
// =============================================================================

export interface ShipmentRecord {
  id: string;
  order_id: string;
  merchant_id: string;
  provider_code: ShippingProviderCode;
  provider_shipment_id: string | null;
  tracking_number: string | null;
  carrier_name: string | null;
  service_tier: string | null;
  quoted_price: number | null;
  currency: string;
  status: NormalizedShipmentStatus;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  label_url: string | null;
  is_station_pickup: boolean;
  // Matches the baseline Supabase columns; pickup_station_* aliases do not exist in the database.
  station_name: string | null;
  station_address: string | null;
  sender_address: ShippingAddress;
  receiver_address: ShippingAddress;
  items: ShipmentItem[];
  provider_response: unknown;
  created_at: string;
  updated_at: string;
}

export interface ShippingQuoteRecord {
  id: string;
  session_id: string;
  provider_code: ShippingProviderCode | 'FALLBACK';
  service_tier: string | null;
  carrier_name: string | null;
  price: number;
  estimated_days: number | null;
  provider_rate_id: string | null;
  sender_city: string | null;
  sender_state: string | null;
  receiver_city: string | null;
  receiver_state: string | null;
  receiver_country: string;
  total_weight: number | null;
  insurance_included: boolean;
  is_station_pickup: boolean;
  // Matches the baseline Supabase columns; pickup_station_* aliases do not exist in the database.
  station_name: string | null;
  station_address: string | null;
  expires_at: string;
  raw_response: unknown;
  created_at: string;
}

// =============================================================================
// LOCATION TYPES (for address lookup)
// =============================================================================

export interface NigerianState {
  name: string;
  code: string;
  cities: NigerianCity[];
}

export interface NigerianCity {
  name: string;
  stationId?: number; // GIGL station ID
  stationName?: string; // GIGL station name
}

export interface UnifiedLocation {
  state: string;
  city: string;
  displayName?: string;
  stationId?: number;
  stationName?: string;
  latitude?: number;
  longitude?: number;
}

// =============================================================================
// PROVIDER CONFIG TYPES
// =============================================================================

export interface ProviderConfig {
  code: ShippingProviderCode;
  name: string;
  displayName: string; // What customers see
  enabled: boolean;
  supportsInternational: boolean;
  supportsDomestic: boolean;
}

export const PROVIDER_CONFIGS: Record<ShippingProviderCode, ProviderConfig> = {
  GIGL: {
    code: 'GIGL',
    name: 'GIGL',
    displayName: 'GIG Logistics',
    enabled: true,
    supportsInternational: true,
    supportsDomestic: true,
  },
  TOPSHIP: {
    code: 'TOPSHIP',
    name: 'Topship',
    displayName: 'Topship', // Hidden from customers - show carrier name instead
    enabled: true,
    supportsInternational: true,
    supportsDomestic: true,
  },
};

// =============================================================================
// TIER MAPPING (for customer-friendly display names)
// =============================================================================

export type DeliveryTier = 'express' | 'standard' | 'economy' | 'premium';

export const TIER_DISPLAY_NAMES: Record<
  DeliveryTier,
  { name: string; icon: string }
> = {
  express: { name: 'Express Delivery', icon: '⚡' },
  standard: { name: 'Standard Delivery', icon: '⭐' },
  economy: { name: 'Economy Delivery', icon: '💰' },
  premium: { name: 'Premium Delivery', icon: '🚀' },
};

// Map provider service tiers to unified tiers
export function mapToDeliveryTier(
  serviceTier: string,
  estimatedDays: number
): DeliveryTier {
  const tier = serviceTier.toLowerCase();

  // Express/fast options
  if (
    tier.includes('express') ||
    tier.includes('fast') ||
    tier.includes('priority') ||
    estimatedDays <= 2
  ) {
    return 'express';
  }

  // Premium options (FedEx, DHL, etc.)
  if (
    tier.includes('fedex') ||
    tier.includes('dhl') ||
    tier.includes('ups') ||
    tier.includes('premium')
  ) {
    return 'premium';
  }

  // Budget/economy options
  if (
    tier.includes('budget') ||
    tier.includes('economy') ||
    tier.includes('lastmile') ||
    estimatedDays >= 5
  ) {
    return 'economy';
  }

  // Default to standard
  return 'standard';
}
