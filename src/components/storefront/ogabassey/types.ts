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
  rating: number;
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
