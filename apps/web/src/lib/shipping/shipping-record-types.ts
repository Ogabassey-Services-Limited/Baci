import type { NormalizedShipmentStatus } from './tracking-types';
import type {
  ShipmentItem,
  ShippingAddress,
  ShippingProviderCode,
} from './types';

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
