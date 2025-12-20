/**
 * Themed Components Library
 *
 * All components automatically use merchant brand colors from CSS variables.
 * Colors are extracted from logo during onboarding and stored in merchant data.
 *
 * @example
 * ```tsx
 * import { ThemedButton, ThemedCard, ThemedBadge, ThemedInput, ThemedLink } from '@/components/themed';
 *
 * <ThemedCard accentPosition="top">
 *   <h2>Featured Product</h2>
 *   <ThemedBadge colorRole="accent">New</ThemedBadge>
 *   <ThemedInput placeholder="Search..." focusColor="primary" />
 *   <ThemedButton colorRole="primary">Shop Now</ThemedButton>
 * </ThemedCard>
 * ```
 */

export { ThemedBadge } from './themed-badge';
export { ThemedButton } from './themed-button';
export { ThemedCard } from './themed-card';
export { ThemedInput } from './themed-input';
export { ThemedLink } from './themed-link';
export { ThemedSheetContent } from './themed-sheet';
