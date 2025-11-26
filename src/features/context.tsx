'use client';

/**
 * Feature Context Provider
 *
 * Provides feature checking capabilities to components.
 * Wraps merchant context to provide feature-aware functionality.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useMerchant } from '@/hooks/use-merchant';
import {
    getFeaturesForBusinessType,
    getFeaturesByCategory,
    isFeatureEnabled,
    getProductFormConfig,
    VERTICAL_FEATURES,
} from './registry';
import type {
    BusinessTypeId,
    FeatureCategory,
    FeatureCheckResult,
    MerchantFeatures,
    VerticalFeature,
    VerticalProductFormConfig,
} from './types';

interface FeatureContextValue {
    /**
     * Check if a feature is enabled for the current merchant
     */
    isEnabled: (featureKey: string) => boolean;

    /**
     * Get detailed feature check result
     */
    checkFeature: (featureKey: string) => FeatureCheckResult;

    /**
     * Get all available features for the current merchant's business type
     */
    availableFeatures: Omit<VerticalFeature, 'id' | 'isActive'>[];

    /**
     * Get features by category
     */
    getFeaturesByCategory: (category: FeatureCategory) => Omit<VerticalFeature, 'id' | 'isActive'>[];

    /**
     * Get product form configuration for the current business type
     */
    productFormConfig: VerticalProductFormConfig | null;

    /**
     * Current business type
     */
    businessType: BusinessTypeId | null;

    /**
     * Whether features are still loading
     */
    loading: boolean;

    /**
     * Get feature configuration for a specific feature
     */
    getFeatureConfig: <T = Record<string, unknown>>(featureKey: string) => T | null;
}

const FeatureContext = createContext<FeatureContextValue | null>(null);

interface FeatureProviderProps {
    children: ReactNode;
}

export function FeatureProvider({ children }: FeatureProviderProps) {
    const { merchant, loading } = useMerchant();

    const businessType = merchant?.business_type as BusinessTypeId | null;

    const merchantFeatures: MerchantFeatures = useMemo(() => ({
        enabledFeatures: (merchant?.enabled_features as Record<string, boolean>) || {},
        featureConfig: (merchant?.feature_config as Record<string, Record<string, unknown>>) || {},
    }), [merchant?.enabled_features, merchant?.feature_config]);

    const availableFeatures = useMemo(() => {
        if (!businessType) return [];
        return getFeaturesForBusinessType(businessType);
    }, [businessType]);

    const productFormConfig = useMemo(() => {
        if (!businessType) return null;
        return getProductFormConfig(businessType);
    }, [businessType]);

    const isEnabled = (featureKey: string): boolean => {
        if (!businessType) return false;
        const result = isFeatureEnabled(featureKey, merchantFeatures, businessType);
        return result.enabled;
    };

    const checkFeature = (featureKey: string): FeatureCheckResult => {
        if (!businessType) {
            return {
                enabled: false,
                available: false,
                requiresUpgrade: false,
                config: null,
            };
        }
        return isFeatureEnabled(featureKey, merchantFeatures, businessType);
    };

    const getFeaturesByCategoryFn = (category: FeatureCategory) => {
        if (!businessType) return [];
        return getFeaturesByCategory(businessType, category);
    };

    const getFeatureConfig = <T = Record<string, unknown>>(featureKey: string): T | null => {
        return (merchantFeatures.featureConfig[featureKey] as T) || null;
    };

    const value: FeatureContextValue = {
        isEnabled,
        checkFeature,
        availableFeatures,
        getFeaturesByCategory: getFeaturesByCategoryFn,
        productFormConfig,
        businessType,
        loading,
        getFeatureConfig,
    };

    return (
        <FeatureContext.Provider value={value}>
            {children}
        </FeatureContext.Provider>
    );
}

/**
 * Hook to access feature context
 */
export function useFeatures(): FeatureContextValue {
    const context = useContext(FeatureContext);
    if (!context) {
        throw new Error('useFeatures must be used within a FeatureProvider');
    }
    return context;
}

/**
 * Hook to check a single feature
 */
export function useFeature(featureKey: string): FeatureCheckResult & { feature: Omit<VerticalFeature, 'id' | 'isActive'> | null } {
    const { checkFeature } = useFeatures();
    const result = checkFeature(featureKey);
    const feature = VERTICAL_FEATURES[featureKey] || null;

    return {
        ...result,
        feature,
    };
}

/**
 * HOC to wrap components that require a specific feature
 */
export function withFeature<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    featureKey: string,
    FallbackComponent?: React.ComponentType
) {
    return function FeatureGatedComponent(props: P) {
        const { isEnabled } = useFeatures();

        if (!isEnabled(featureKey)) {
            if (FallbackComponent) {
                return <FallbackComponent />;
            }
            return null;
        }

        return <WrappedComponent {...props} />;
    };
}
