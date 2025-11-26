/**
 * Feature System
 *
 * Central export for the vertical and universal feature system.
 *
 * @example
 * ```tsx
 * import { useFeatures, useFeature, FEATURE_KEYS } from '@/features';
 *
 * function ProductForm() {
 *   const { isEnabled, productFormConfig } = useFeatures();
 *
 *   // Check if IMEI tracking is enabled
 *   if (isEnabled(FEATURE_KEYS.IMEI_TRACKING)) {
 *     // Show IMEI input field
 *   }
 *
 *   // Or use the hook for detailed info
 *   const sizeGuide = useFeature(FEATURE_KEYS.SIZE_GUIDE);
 *   if (sizeGuide.enabled) {
 *     // Render size guide builder
 *   } else if (sizeGuide.requiresUpgrade) {
 *     // Show upgrade prompt
 *   }
 * }
 * ```
 */

// Types
export type {
    FeatureCategory,
    FeatureType,
    BusinessTypeId,
    VerticalFeature,
    UniversalFeature,
    MerchantFeatures,
    FeatureCheckResult,
    VerticalProductField,
    VerticalProductSection,
    VerticalProductFormConfig,
    VerticalPuckComponent,
} from './types';

// Registry functions
export {
    VERTICAL_FEATURES,
    getFeaturesForBusinessType,
    getFeaturesByCategory,
    isFeatureAvailable,
    isFeatureEnabled,
    getDefaultEnabledFeatures,
    getProductFormConfig,
    FEATURE_KEYS,
} from './registry';

// Context and hooks
export {
    FeatureProvider,
    useFeatures,
    useFeature,
    withFeature,
} from './context';
