/**
 * Shared Checkout Theme Utilities
 *
 * Provides CSS variable-based styling for checkout components.
 * This allows checkout to adapt to each merchant's brand colors.
 *
 * @example
 * import { checkoutStyles } from '@/components/storefront/shared/checkout-theme';
 *
 * <button className={checkoutStyles.primaryButton}>Pay Now</button>
 */

/**
 * Standard checkout component styles using CSS custom properties.
 * These automatically adapt to merchant brand colors set via:
 * - --store-primary
 * - --store-primary-text (contrast-aware text color)
 */
export const checkoutStyles = {
  // Primary buttons (Pay, Continue, etc.)
  primaryButton:
    'bg-store-primary text-store-primary-text hover:opacity-90 transition-opacity',
  primaryButtonDisabled:
    'disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed',

  // Secondary/outline buttons
  outlineButton:
    'border-store-primary text-store-primary hover:bg-store-primary/10',

  // Active/selected states
  activeCard: 'border-store-primary bg-store-primary/5',
  activeBorder: 'border-store-primary',
  activeRing: 'ring-1 ring-store-primary/20',

  // Radio buttons and checkboxes
  radioSelected: 'border-store-primary',
  radioDot: 'bg-store-primary',
  checkbox: 'text-store-primary focus:ring-store-primary',

  // Text colors
  primaryText: 'text-store-primary',
  primaryTextHover: 'hover:text-store-primary',

  // Backgrounds
  primaryBg: 'bg-store-primary',
  primaryBgLight: 'bg-store-primary/10',
  primaryBgGradient: 'bg-linear-to-r from-store-primary to-store-primary/80',

  // Focus states
  focusRing: 'focus:ring-store-primary focus:border-store-primary',

  // Shadows
  primaryShadow: 'shadow-store-primary/20',

  // Step indicator states
  stepActive: 'bg-store-primary/10 text-store-primary',
  stepCompleted: 'bg-green-100 text-green-600',
  stepPending: 'bg-gray-100 text-gray-500',
} as const;

/**
 * Helper to combine checkout styles with custom classes
 */
export function cx(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Color mapping for easy replacement:
 * These mappings help identify what to replace in existing components.
 *
 * Hardcoded → CSS Variable
 * ━━━━━━━━━━━━━━━━━━━━━━━
 * bg-red-600 → bg-store-primary
 * bg-red-700 → bg-store-primary/90 (or hover state)
 * text-red-600 → text-store-primary
 * text-red-700 → text-store-primary
 * border-red-600 → border-store-primary
 * ring-red-100 → ring-store-primary/20
 * shadow-red-200 → shadow-store-primary/20
 * focus:ring-red-500 → focus:ring-store-primary
 * hover:bg-red-700 → hover:bg-store-primary/90
 * hover:text-red-600 → hover:text-store-primary
 * hover:text-red-700 → hover:text-store-primary
 * hover:border-red-200 → hover:border-store-primary/40
 * from-red-600 → from-store-primary
 * to-red-700 → to-store-primary/80
 * bg-red-50 → bg-store-primary/5
 * bg-red-100 → bg-store-primary/10
 */
