// Migrated from temp-source/types.ts
import type React from 'react';

export interface ProductRecommendation {
  name: string;
  price: string;
  reason: string;
  category: string;
}

export interface Category {
  id: string;
  name: string;
  icon: React.ReactNode;
  color?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  bgColor: string;
  textColor: string;
  size: 'large' | 'small';
}

export interface Product {
  id: number | string;
  merchantId?: string; // For scoped searches (comparison)
  slug?: string;
  name: string;
  price: string;
  rawPrice?: number;
  image: string;
  description: string;
  rating?: number;
  category: string;
  categorySlug?: string;
  condition:
  | 'New'
  | 'Used'
  | 'Open Box'
  | 'new'
  | 'used'
  | 'open_box'
  | 'refurbished';
  // Detailed specs for filtering
  brand?: string;
  storage?: string | string[];
  ram?: string;
  colors?: string[] | { name: string; value: string }[];
  simType?: string;
  displayType?: string;
  displaySize?: string;
  // New fields for Interactive Grid
  images?: string[];
  spec?: string;
  specs?: { label: string; value: string }[];
  detailedSpecs?: { category: string; items: { label: string; value: string }[] }[];
  reviews?: number;
  stock?: number;
  videoUrl?: string; // YouTube URL for unboxing/review
  // Technical specs from API (optional but typed)
  product_key_specs?: ProductKeySpecs;
  // Phase 7: Condition Deduplication
  has_condition_offers?: boolean;
  offers?: {
    id: string;
    condition: 'new' | 'used' | 'open_box' | 'refurbished';
    price: number;
    stock_quantity: number;
    images?: string[];
  }[];
}

export interface ProductKeySpecs {
  // Network
  network_technology?: string;
  is_5g?: boolean;
  has_nfc?: boolean;

  // Body
  dimensions_mm?: string;
  weight_g?: number;
  build_materials?: string;
  ip_rating?: string;
  sim_type?: string;

  // Display
  display_type?: string;
  screen_size_inches?: number;
  display_resolution?: string;
  refresh_rate_hz?: number;
  display_ppi?: number;
  display_peak_brightness?: number;

  // Platform
  android_version?: string;
  chipset?: string;
  cpu_cores?: string;
  gpu?: string;

  // Memory
  ram_gb?: number;
  storage_gb?: number;
  has_card_slot?: boolean;
  card_slot_type?: string;

  // Camera
  main_camera_mp?: number;
  has_quad_camera?: boolean;
  has_triple_camera?: boolean;
  has_dual_camera?: boolean;
  front_camera_mp?: number;
  rear_camera_video?: string;

  // Sound
  has_stereo_speakers?: boolean;
  has_headphone_jack?: boolean;

  // Connectivity
  wifi_bands?: string;
  bluetooth_version?: string;
  usb_type?: string;
  has_usb_otg?: boolean;
  has_fm_radio?: boolean;

  // Features
  fingerprint_type?: string;

  // Battery
  battery_mah?: number;
  charging_watt?: number;
  has_wireless_charging?: boolean;
  wireless_charging_watt?: number;

  // Allow index access for generic mapping
  [key: string]: string | number | boolean | undefined;
}

import type { CartItem } from '@/hooks/use-cart';

export type V2CartItem = CartItem;

export interface Order {
  id: string;
  date: string;
  time: string;
  total: string;
  status: string;
  paymentMethod: string;
  shippingAddress: string;
  items: V2CartItem[];
  walletDeduction?: number;
}

// Re-export specific types if needed by other components
export type { Product as V2Product };
