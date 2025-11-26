/**
 * Feature System Types
 *
 * This module defines the types for the vertical and universal feature system.
 * Features are capabilities that can be enabled/disabled per merchant based on their business type.
 */

/**
 * Feature categories define where a feature applies
 */
export type FeatureCategory =
    | 'storefront'   // Customer-facing storefront features
    | 'product'      // Product display/management features
    | 'checkout'     // Checkout process features
    | 'inventory'    // Inventory management features
    | 'analytics'    // Analytics and reporting features
    | 'payment'      // Payment processing
    | 'shipping'     // Shipping and delivery
    | 'communication'; // Email, SMS, messaging

/**
 * Feature type determines availability and pricing
 */
export type FeatureType = 'core' | 'optional' | 'premium';

/**
 * Business type identifiers
 */
export type BusinessTypeId =
    | 'fashion'
    | 'electronics'
    | 'home-goods'
    | 'health-beauty'
    | 'handmade'
    | 'food-beverage';

/**
 * Vertical feature definition - features specific to certain business types
 */
export interface VerticalFeature {
    id: string;
    featureKey: string;
    featureName: string;
    description: string | null;
    businessTypes: BusinessTypeId[];
    featureCategory: FeatureCategory;
    featureType: FeatureType;
    defaultEnabled: boolean;
    configSchema: Record<string, unknown> | null;
    uiComponent: string | null;
    apiEndpoint: string | null;
    dependencies: string[] | null;
    sortOrder: number;
    isActive: boolean;
}

/**
 * Universal feature definition - features available to all business types
 */
export interface UniversalFeature {
    id: string;
    featureKey: string;
    featureName: string;
    description: string | null;
    featureCategory: FeatureCategory;
    providerType: string | null;
    configSchema: Record<string, unknown> | null;
    credentialsSchema: Record<string, unknown> | null;
    webhookEndpoint: string | null;
    supportedRegions: string[];
    supportedCurrencies: string[];
    isActive: boolean;
    isPremium: boolean;
    sortOrder: number;
}

/**
 * Merchant feature state
 */
export interface MerchantFeatures {
    enabledFeatures: Record<string, boolean>;
    featureConfig: Record<string, Record<string, unknown>>;
}

/**
 * Feature check result
 */
export interface FeatureCheckResult {
    enabled: boolean;
    available: boolean;
    requiresUpgrade: boolean;
    config: Record<string, unknown> | null;
}

/**
 * Product form field definition based on vertical features
 */
export interface VerticalProductField {
    key: string;
    label: string;
    type: 'text' | 'number' | 'textarea' | 'select' | 'multi-select' | 'size-guide-builder' |
          'spec-builder' | 'imei-input' | 'nutrition-builder' | 'ingredient-list' | 'file-upload';
    placeholder?: string;
    required?: boolean;
    validation?: string;
    options?: { value: string; label: string }[];
    helpText?: string;
    featureKey?: string; // If this field requires a specific feature to be enabled
    section?: string;
}

/**
 * Product form section definition
 */
export interface VerticalProductSection {
    id: string;
    title: string;
    description?: string;
    fields: string[]; // Field keys
    collapsible?: boolean;
    defaultOpen?: boolean;
}

/**
 * Complete product form configuration for a vertical
 */
export interface VerticalProductFormConfig {
    sections: VerticalProductSection[];
    fields: VerticalProductField[];
}

/**
 * Puck component registration for a vertical
 */
export interface VerticalPuckComponent {
    componentKey: string;
    componentName: string;
    description: string;
    featureKey: string;
    businessTypes: BusinessTypeId[];
    defaultProps?: Record<string, unknown>;
}
