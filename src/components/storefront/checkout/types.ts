/**
 * Checkout Component Types
 * Shared types for checkout flow components
 *
 * 2025 Best Practices Applied:
 * - Delivery dates over shipping speed (more actionable for customers)
 * - Dynamic pricing support
 * - Guest checkout friendly
 * - Mobile-first considerations
 */

import type { ShippingQuote, ShippingProviderCode } from '@/lib/shipping/types';

// Re-export shipping types for convenience
export type { ShippingQuote, ShippingProviderCode };

export interface ShippingAddress {
  name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  country?: string;
  countryCode?: string;
}

export interface ShipmentItem {
  name: string;
  quantity: number;
  weight: number;
  value: number;
  category?: string;
}

export interface DiscountResult {
  id: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  finalTotal: number;
}

export interface ShippingSelectorProps {
  /** Receiver address for quote calculation */
  receiverAddress: ShippingAddress;
  /** Cart items for weight/value calculation */
  items: ShipmentItem[];
  /** Callback when user selects a shipping option */
  onSelect: (quote: ShippingQuote) => void;
  /** Currently selected quote ID */
  selectedQuoteId?: string;
  /** Additional CSS classes */
  className?: string;
  /** Merchant ID for sender address lookup */
  merchantId?: string;
  /** Show loading skeleton while parent is loading */
  isLoading?: boolean;
}

export interface DiscountCodeInputProps {
  /** Merchant ID for validation */
  merchantId: string;
  /** Current order subtotal (before discount) */
  orderTotal: number;
  /** Product IDs in cart for product-specific discounts */
  productIds?: string[];
  /** Category IDs for category-specific discounts */
  categoryIds?: string[];
  /** Customer email for per-customer usage limits */
  customerEmail?: string;
  /** Callback when discount is applied or removed */
  onApply: (discount: DiscountResult | null) => void;
  /** Additional CSS classes */
  className?: string;
  /** Disable input (e.g., during checkout processing) */
  disabled?: boolean;
}

export type ShippingTab = 'cheapest' | 'fastest';

/** Checkout step for progress indicator */
export type CheckoutStep = 'shipping' | 'payment' | 'review';

/** Progress indicator props */
export interface CheckoutProgressProps {
  currentStep: CheckoutStep;
  onStepClick?: (step: CheckoutStep) => void;
  className?: string;
}

/** Dynamic order summary props */
export interface DynamicOrderSummaryProps {
  /** Cart subtotal */
  subtotal: number;
  /** Selected shipping quote */
  shippingQuote?: ShippingQuote | null;
  /** Applied discount */
  discount?: DiscountResult | null;
  /** Currency code */
  currencyCode?: string;
  /** Show loading state for shipping */
  shippingLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}
