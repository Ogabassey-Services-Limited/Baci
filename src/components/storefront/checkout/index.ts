/**
 * Checkout Components
 *
 * 2025 Best Practices Applied:
 * - Delivery dates over shipping speed
 * - Dynamic real-time pricing
 * - Strategic promo code placement (not front-loaded)
 * - Progress indicators with verbs
 * - Mobile-first responsive design
 * - No hidden fees - transparent pricing
 * - Guest checkout support
 */

// Components
export { ShippingSelector } from './shipping-selector';
export { DiscountCodeInput } from './discount-code-input';
export { CheckoutProgress, CheckoutProgressBar } from './checkout-progress';
export { DynamicOrderSummary, CompactOrderSummary } from './dynamic-order-summary';

// Types
export type {
  ShippingAddress,
  ShipmentItem,
  DiscountResult,
  ShippingSelectorProps,
  DiscountCodeInputProps,
  ShippingTab,
  CheckoutStep,
  CheckoutProgressProps,
  DynamicOrderSummaryProps,
  ShippingQuote,
  ShippingProviderCode,
} from './types';
