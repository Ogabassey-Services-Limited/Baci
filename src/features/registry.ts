/**
 * Feature Registry
 *
 * Central registry for managing vertical-specific and universal features.
 * This module provides utilities for checking feature availability,
 * getting feature configurations, and determining which features are
 * enabled for a given merchant.
 */

import type {
    VerticalFeature,
    UniversalFeature,
    BusinessTypeId,
    FeatureCategory,
    FeatureCheckResult,
    MerchantFeatures,
    VerticalProductFormConfig,
    VerticalProductField,
    VerticalProductSection,
} from './types';

/**
 * Static vertical feature definitions
 * These match the database seeds but are available client-side without DB calls
 */
export const VERTICAL_FEATURES: Record<string, Omit<VerticalFeature, 'id' | 'isActive'>> = {
    // Fashion features
    size_guide: {
        featureKey: 'size_guide',
        featureName: 'Size Guide Builder',
        description: 'Create and display size charts for clothing items',
        businessTypes: ['fashion'],
        featureCategory: 'product',
        featureType: 'optional',
        defaultEnabled: true,
        configSchema: null,
        uiComponent: 'SizeGuideBuilder',
        apiEndpoint: null,
        dependencies: null,
        sortOrder: 10,
    },
    ai_tryon: {
        featureKey: 'ai_tryon',
        featureName: 'AI Virtual Try-On',
        description: 'Let customers virtually try on clothes using AI',
        businessTypes: ['fashion'],
        featureCategory: 'storefront',
        featureType: 'premium',
        defaultEnabled: false,
        configSchema: { model: 'string', quality: 'string' },
        uiComponent: 'VirtualTryOn',
        apiEndpoint: '/api/features/ai-tryon',
        dependencies: null,
        sortOrder: 20,
    },
    color_variants: {
        featureKey: 'color_variants',
        featureName: 'Color Variant Swatches',
        description: 'Show color options as visual swatches',
        businessTypes: ['fashion', 'home-goods'],
        featureCategory: 'product',
        featureType: 'optional',
        defaultEnabled: true,
        configSchema: null,
        uiComponent: 'ColorSwatches',
        apiEndpoint: null,
        dependencies: null,
        sortOrder: 30,
    },
    material_info: {
        featureKey: 'material_info',
        featureName: 'Material & Care Information',
        description: 'Display fabric composition and care instructions',
        businessTypes: ['fashion'],
        featureCategory: 'product',
        featureType: 'optional',
        defaultEnabled: true,
        configSchema: null,
        uiComponent: 'MaterialCareInfo',
        apiEndpoint: null,
        dependencies: null,
        sortOrder: 40,
    },

    // Electronics features
    imei_tracking: {
        featureKey: 'imei_tracking',
        featureName: 'IMEI/Serial Number Tracking',
        description: 'Track individual devices by IMEI or serial number',
        businessTypes: ['electronics'],
        featureCategory: 'inventory',
        featureType: 'optional',
        defaultEnabled: true,
        configSchema: null,
        uiComponent: 'IMEITracker',
        apiEndpoint: '/api/features/imei',
        dependencies: null,
        sortOrder: 10,
    },
    warranty_management: {
        featureKey: 'warranty_management',
        featureName: 'Warranty Management',
        description: 'Track and manage product warranties',
        businessTypes: ['electronics'],
        featureCategory: 'product',
        featureType: 'optional',
        defaultEnabled: true,
        configSchema: null,
        uiComponent: 'WarrantyManager',
        apiEndpoint: null,
        dependencies: null,
        sortOrder: 20,
    },
    tech_specs: {
        featureKey: 'tech_specs',
        featureName: 'Technical Specifications',
        description: 'Display detailed product specifications',
        businessTypes: ['electronics'],
        featureCategory: 'product',
        featureType: 'core',
        defaultEnabled: true,
        configSchema: null,
        uiComponent: 'TechSpecs',
        apiEndpoint: null,
        dependencies: null,
        sortOrder: 30,
    },
    spec_comparison: {
        featureKey: 'spec_comparison',
        featureName: 'Product Comparison Tool',
        description: 'Let customers compare product specifications',
        businessTypes: ['electronics'],
        featureCategory: 'storefront',
        featureType: 'optional',
        defaultEnabled: false,
        configSchema: null,
        uiComponent: 'SpecComparison',
        apiEndpoint: null,
        dependencies: ['tech_specs'],
        sortOrder: 40,
    },

    // Food & Beverage features
    nutrition_facts: {
        featureKey: 'nutrition_facts',
        featureName: 'Nutrition Facts',
        description: 'Display nutritional information',
        businessTypes: ['food-beverage'],
        featureCategory: 'product',
        featureType: 'optional',
        defaultEnabled: true,
        configSchema: null,
        uiComponent: 'NutritionFacts',
        apiEndpoint: null,
        dependencies: null,
        sortOrder: 10,
    },
    allergen_info: {
        featureKey: 'allergen_info',
        featureName: 'Allergen Information',
        description: 'Display allergen warnings and information',
        businessTypes: ['food-beverage'],
        featureCategory: 'product',
        featureType: 'core',
        defaultEnabled: true,
        configSchema: null,
        uiComponent: 'AllergenInfo',
        apiEndpoint: null,
        dependencies: null,
        sortOrder: 20,
    },

    // Health & Beauty features
    ingredient_list: {
        featureKey: 'ingredient_list',
        featureName: 'Ingredient List',
        description: 'Display full ingredient lists',
        businessTypes: ['health-beauty'],
        featureCategory: 'product',
        featureType: 'core',
        defaultEnabled: true,
        configSchema: null,
        uiComponent: 'IngredientList',
        apiEndpoint: null,
        dependencies: null,
        sortOrder: 10,
    },
    skin_type_filters: {
        featureKey: 'skin_type_filters',
        featureName: 'Skin Type Filters',
        description: 'Filter products by skin type',
        businessTypes: ['health-beauty'],
        featureCategory: 'storefront',
        featureType: 'optional',
        defaultEnabled: true,
        configSchema: null,
        uiComponent: 'SkinTypeFilter',
        apiEndpoint: null,
        dependencies: null,
        sortOrder: 20,
    },

    // Home Goods features
    dimension_guide: {
        featureKey: 'dimension_guide',
        featureName: 'Dimension Guide',
        description: 'Show detailed dimensions with diagrams',
        businessTypes: ['home-goods'],
        featureCategory: 'product',
        featureType: 'optional',
        defaultEnabled: true,
        configSchema: null,
        uiComponent: 'DimensionGuide',
        apiEndpoint: null,
        dependencies: null,
        sortOrder: 20,
    },

    // Handmade features
    maker_story: {
        featureKey: 'maker_story',
        featureName: 'Maker Story',
        description: 'Display artisan/maker profile and story',
        businessTypes: ['handmade'],
        featureCategory: 'storefront',
        featureType: 'optional',
        defaultEnabled: true,
        configSchema: null,
        uiComponent: 'MakerStory',
        apiEndpoint: null,
        dependencies: null,
        sortOrder: 10,
    },
    custom_orders: {
        featureKey: 'custom_orders',
        featureName: 'Custom Order Requests',
        description: 'Accept custom/personalized orders',
        businessTypes: ['handmade'],
        featureCategory: 'checkout',
        featureType: 'optional',
        defaultEnabled: true,
        configSchema: null,
        uiComponent: 'CustomOrderForm',
        apiEndpoint: '/api/features/custom-orders',
        dependencies: null,
        sortOrder: 20,
    },
};

/**
 * Get all features available for a business type
 */
export function getFeaturesForBusinessType(businessType: BusinessTypeId): Omit<VerticalFeature, 'id' | 'isActive'>[] {
    return Object.values(VERTICAL_FEATURES).filter(
        feature => feature.businessTypes.includes(businessType)
    ).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get features by category for a business type
 */
export function getFeaturesByCategory(
    businessType: BusinessTypeId,
    category: FeatureCategory
): Omit<VerticalFeature, 'id' | 'isActive'>[] {
    return getFeaturesForBusinessType(businessType).filter(
        feature => feature.featureCategory === category
    );
}

/**
 * Check if a feature is available for a business type
 */
export function isFeatureAvailable(featureKey: string, businessType: BusinessTypeId): boolean {
    const feature = VERTICAL_FEATURES[featureKey];
    return feature ? feature.businessTypes.includes(businessType) : false;
}

/**
 * Check if a feature is enabled for a merchant
 */
export function isFeatureEnabled(
    featureKey: string,
    merchantFeatures: MerchantFeatures,
    businessType: BusinessTypeId
): FeatureCheckResult {
    const feature = VERTICAL_FEATURES[featureKey];

    if (!feature) {
        return {
            enabled: false,
            available: false,
            requiresUpgrade: false,
            config: null,
        };
    }

    const available = feature.businessTypes.includes(businessType);
    const enabled = merchantFeatures.enabledFeatures[featureKey] ?? feature.defaultEnabled;
    const requiresUpgrade = feature.featureType === 'premium' && !enabled;
    const config = merchantFeatures.featureConfig[featureKey] || null;

    return {
        enabled: available && enabled,
        available,
        requiresUpgrade,
        config,
    };
}

/**
 * Get default enabled features for a business type
 */
export function getDefaultEnabledFeatures(businessType: BusinessTypeId): Record<string, boolean> {
    const features = getFeaturesForBusinessType(businessType);
    const enabledMap: Record<string, boolean> = {};

    for (const feature of features) {
        enabledMap[feature.featureKey] = feature.defaultEnabled;
    }

    return enabledMap;
}

/**
 * Get product form configuration for a business type
 */
export function getProductFormConfig(businessType: BusinessTypeId): VerticalProductFormConfig {
    const baseFields: VerticalProductField[] = [
        { key: 'name', label: 'Product Name', type: 'text', required: true, section: 'basic' },
        { key: 'description', label: 'Description', type: 'textarea', required: true, section: 'basic' },
        { key: 'price', label: 'Price', type: 'number', required: true, section: 'basic' },
        { key: 'compare_at_price', label: 'Compare at Price', type: 'number', section: 'basic' },
        { key: 'sku', label: 'SKU', type: 'text', section: 'basic' },
        { key: 'category', label: 'Category', type: 'select', section: 'basic' },
        { key: 'brand', label: 'Brand', type: 'text', section: 'basic' },
    ];

    const baseSections: VerticalProductSection[] = [
        { id: 'basic', title: 'Basic Information', fields: ['name', 'description', 'price', 'compare_at_price', 'sku', 'category', 'brand'], defaultOpen: true },
        { id: 'media', title: 'Media', fields: ['images'], defaultOpen: true },
        { id: 'inventory', title: 'Inventory', fields: ['stock', 'manage_stock', 'low_stock_threshold'], collapsible: true },
    ];

    // Add vertical-specific fields
    const verticalFields: VerticalProductField[] = [];
    const verticalSections: VerticalProductSection[] = [];

    switch (businessType) {
        case 'fashion':
            verticalFields.push(
                { key: 'sizes', label: 'Available Sizes', type: 'multi-select', options: [
                    { value: 'XS', label: 'XS' }, { value: 'S', label: 'S' }, { value: 'M', label: 'M' },
                    { value: 'L', label: 'L' }, { value: 'XL', label: 'XL' }, { value: 'XXL', label: 'XXL' }
                ], section: 'variants', featureKey: 'size_guide' },
                { key: 'size_chart', label: 'Size Chart', type: 'size-guide-builder', section: 'variants', featureKey: 'size_guide' },
                { key: 'colors', label: 'Available Colors', type: 'multi-select', section: 'variants', featureKey: 'color_variants' },
                { key: 'materials', label: 'Materials', type: 'multi-select', options: [
                    { value: 'cotton', label: 'Cotton' }, { value: 'polyester', label: 'Polyester' },
                    { value: 'silk', label: 'Silk' }, { value: 'wool', label: 'Wool' }, { value: 'linen', label: 'Linen' }
                ], section: 'details', featureKey: 'material_info' },
                { key: 'care_instructions', label: 'Care Instructions', type: 'textarea', section: 'details', featureKey: 'material_info' },
            );
            verticalSections.push(
                { id: 'variants', title: 'Sizes & Colors', fields: ['sizes', 'size_chart', 'colors'], collapsible: true, defaultOpen: true },
                { id: 'details', title: 'Materials & Care', fields: ['materials', 'care_instructions'], collapsible: true },
            );
            break;

        case 'electronics':
            verticalFields.push(
                { key: 'imei', label: 'IMEI Number', type: 'imei-input', section: 'tracking', featureKey: 'imei_tracking', validation: 'imei' },
                { key: 'serial_number', label: 'Serial Number', type: 'text', section: 'tracking', featureKey: 'imei_tracking' },
                { key: 'specs', label: 'Technical Specifications', type: 'spec-builder', section: 'specs', featureKey: 'tech_specs' },
                { key: 'warranty_months', label: 'Warranty (Months)', type: 'number', section: 'warranty', featureKey: 'warranty_management' },
                { key: 'warranty_type', label: 'Warranty Type', type: 'select', options: [
                    { value: 'manufacturer', label: 'Manufacturer Warranty' },
                    { value: 'seller', label: 'Seller Warranty' },
                    { value: 'extended', label: 'Extended Warranty' }
                ], section: 'warranty', featureKey: 'warranty_management' },
            );
            verticalSections.push(
                { id: 'specs', title: 'Technical Specifications', fields: ['specs'], collapsible: true, defaultOpen: true },
                { id: 'tracking', title: 'Device Tracking', fields: ['imei', 'serial_number'], collapsible: true },
                { id: 'warranty', title: 'Warranty Information', fields: ['warranty_months', 'warranty_type'], collapsible: true },
            );
            break;

        case 'food-beverage':
            verticalFields.push(
                { key: 'nutrition', label: 'Nutrition Facts', type: 'nutrition-builder', section: 'nutrition', featureKey: 'nutrition_facts' },
                { key: 'ingredients', label: 'Ingredients', type: 'ingredient-list', section: 'nutrition', featureKey: 'nutrition_facts' },
                { key: 'allergens', label: 'Allergens', type: 'multi-select', options: [
                    { value: 'gluten', label: 'Gluten' }, { value: 'dairy', label: 'Dairy' },
                    { value: 'nuts', label: 'Nuts' }, { value: 'soy', label: 'Soy' },
                    { value: 'eggs', label: 'Eggs' }, { value: 'shellfish', label: 'Shellfish' }
                ], section: 'allergens', featureKey: 'allergen_info' },
                { key: 'expiry_days', label: 'Shelf Life (Days)', type: 'number', section: 'storage' },
                { key: 'storage_instructions', label: 'Storage Instructions', type: 'textarea', section: 'storage' },
            );
            verticalSections.push(
                { id: 'nutrition', title: 'Nutrition Information', fields: ['nutrition', 'ingredients'], collapsible: true, defaultOpen: true },
                { id: 'allergens', title: 'Allergen Information', fields: ['allergens'], collapsible: true, defaultOpen: true },
                { id: 'storage', title: 'Storage & Shelf Life', fields: ['expiry_days', 'storage_instructions'], collapsible: true },
            );
            break;

        case 'health-beauty':
            verticalFields.push(
                { key: 'ingredients', label: 'Full Ingredient List', type: 'ingredient-list', section: 'ingredients', featureKey: 'ingredient_list' },
                { key: 'skin_types', label: 'Suitable for Skin Types', type: 'multi-select', options: [
                    { value: 'normal', label: 'Normal' }, { value: 'dry', label: 'Dry' },
                    { value: 'oily', label: 'Oily' }, { value: 'combination', label: 'Combination' },
                    { value: 'sensitive', label: 'Sensitive' }
                ], section: 'skin', featureKey: 'skin_type_filters' },
                { key: 'usage_instructions', label: 'How to Use', type: 'textarea', section: 'usage' },
                { key: 'volume', label: 'Volume/Size', type: 'text', placeholder: 'e.g., 50ml, 100g', section: 'basic' },
            );
            verticalSections.push(
                { id: 'ingredients', title: 'Ingredients', fields: ['ingredients'], collapsible: true, defaultOpen: true },
                { id: 'skin', title: 'Skin Type Suitability', fields: ['skin_types'], collapsible: true },
                { id: 'usage', title: 'Usage Instructions', fields: ['usage_instructions'], collapsible: true },
            );
            break;

        case 'home-goods':
            verticalFields.push(
                { key: 'dimensions', label: 'Dimensions', type: 'text', placeholder: 'L x W x H', section: 'dimensions', featureKey: 'dimension_guide' },
                { key: 'weight', label: 'Weight', type: 'text', section: 'dimensions' },
                { key: 'materials', label: 'Materials', type: 'multi-select', section: 'details' },
                { key: 'assembly_required', label: 'Assembly Required', type: 'select', options: [
                    { value: 'no', label: 'No Assembly Required' },
                    { value: 'simple', label: 'Simple Assembly' },
                    { value: 'complex', label: 'Complex Assembly' }
                ], section: 'details' },
                { key: 'color_options', label: 'Available Colors', type: 'multi-select', section: 'variants', featureKey: 'color_variants' },
            );
            verticalSections.push(
                { id: 'dimensions', title: 'Dimensions & Weight', fields: ['dimensions', 'weight'], collapsible: true, defaultOpen: true },
                { id: 'details', title: 'Materials & Assembly', fields: ['materials', 'assembly_required'], collapsible: true },
                { id: 'variants', title: 'Color Options', fields: ['color_options'], collapsible: true },
            );
            break;

        case 'handmade':
            verticalFields.push(
                { key: 'crafting_time', label: 'Crafting Time', type: 'text', placeholder: 'e.g., 2-3 days', section: 'crafting' },
                { key: 'materials_used', label: 'Materials Used', type: 'textarea', section: 'crafting' },
                { key: 'customization_options', label: 'Customization Options', type: 'textarea', section: 'custom', featureKey: 'custom_orders', helpText: 'Describe what customers can customize' },
                { key: 'is_limited_edition', label: 'Limited Edition', type: 'select', options: [
                    { value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }
                ], section: 'details' },
                { key: 'edition_size', label: 'Edition Size', type: 'number', section: 'details', helpText: 'Total number in this edition' },
            );
            verticalSections.push(
                { id: 'crafting', title: 'Crafting Details', fields: ['crafting_time', 'materials_used'], collapsible: true, defaultOpen: true },
                { id: 'custom', title: 'Customization', fields: ['customization_options'], collapsible: true },
                { id: 'details', title: 'Edition Details', fields: ['is_limited_edition', 'edition_size'], collapsible: true },
            );
            break;
    }

    return {
        sections: [...baseSections, ...verticalSections],
        fields: [...baseFields, ...verticalFields],
    };
}

/**
 * Export feature keys as constants for type-safe usage
 */
export const FEATURE_KEYS = {
    // Fashion
    SIZE_GUIDE: 'size_guide',
    AI_TRYON: 'ai_tryon',
    COLOR_VARIANTS: 'color_variants',
    MATERIAL_INFO: 'material_info',

    // Electronics
    IMEI_TRACKING: 'imei_tracking',
    WARRANTY_MANAGEMENT: 'warranty_management',
    TECH_SPECS: 'tech_specs',
    SPEC_COMPARISON: 'spec_comparison',

    // Food & Beverage
    NUTRITION_FACTS: 'nutrition_facts',
    ALLERGEN_INFO: 'allergen_info',

    // Health & Beauty
    INGREDIENT_LIST: 'ingredient_list',
    SKIN_TYPE_FILTERS: 'skin_type_filters',

    // Home Goods
    DIMENSION_GUIDE: 'dimension_guide',

    // Handmade
    MAKER_STORY: 'maker_story',
    CUSTOM_ORDERS: 'custom_orders',
} as const;
