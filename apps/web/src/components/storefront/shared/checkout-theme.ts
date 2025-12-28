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
    'bg-[var(--store-primary)] text-[var(--store-primary-text)] hover:opacity-90 transition-opacity',
  primaryButtonDisabled:
    'disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed',

  // Secondary/outline buttons
  outlineButton:
    'border-[var(--store-primary)] text-[var(--store-primary)] hover:bg-[var(--store-primary)]/10',

  // Active/selected states
  activeCard: 'border-[var(--store-primary)] bg-[var(--store-primary)]/5',
  activeBorder: 'border-[var(--store-primary)]',
  activeRing: 'ring-1 ring-[var(--store-primary)]/20',

  // Radio buttons and checkboxes
  radioSelected: 'border-[var(--store-primary)]',
  radioDot: 'bg-[var(--store-primary)]',
  checkbox: 'text-[var(--store-primary)] focus:ring-[var(--store-primary)]',

  // Text colors
  primaryText: 'text-[var(--store-primary)]',
  primaryTextHover: 'hover:text-[var(--store-primary)]',

  // Backgrounds
  primaryBg: 'bg-[var(--store-primary)]',
  primaryBgLight: 'bg-[var(--store-primary)]/10',
  primaryBgGradient:
    'bg-gradient-to-r from-[var(--store-primary)] to-[var(--store-primary)]/80',

  // Focus states
  focusRing:
    'focus:ring-[var(--store-primary)] focus:border-[var(--store-primary)]',

  // Shadows
  primaryShadow: 'shadow-[var(--store-primary)]/20',

  // Step indicator states
  stepActive: 'bg-[var(--store-primary)]/10 text-[var(--store-primary)]',
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
 * bg-red-600 → bg-[var(--store-primary)]
 * bg-red-700 → bg-[var(--store-primary)]/90 (or hover state)
 * text-red-600 → text-[var(--store-primary)]
 * text-red-700 → text-[var(--store-primary)]
 * border-red-600 → border-[var(--store-primary)]
 * ring-red-100 → ring-[var(--store-primary)]/20
 * shadow-red-200 → shadow-[var(--store-primary)]/20
 * focus:ring-red-500 → focus:ring-[var(--store-primary)]
 * hover:bg-red-700 → hover:bg-[var(--store-primary)]/90
 * hover:text-red-600 → hover:text-[var(--store-primary)]
 * hover:text-red-700 → hover:text-[var(--store-primary)]
 * hover:border-red-200 → hover:border-[var(--store-primary)]/40
 * from-red-600 → from-[var(--store-primary)]
 * to-red-700 → to-[var(--store-primary)]/80
 * bg-red-50 → bg-[var(--store-primary)]/5
 * bg-red-100 → bg-[var(--store-primary)]/10
 */
