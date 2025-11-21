/**
 * @fileOverview Central configuration for all business types in the Baci e-commerce platform.
 *
 * This file is the SINGLE SOURCE OF TRUTH for business types.
 *
 * @aiContext CRITICAL: Any changes to business types must be made here first.
 * Changes here propagate to:
 * - Onboarding form dropdown (/src/app/onboarding/onboarding-form.tsx)
 * - AI prompt engineering (/src/ai/flows/*)
 * - Template selection logic (future)
 * - Analytics categorization (future)
 * - Product form customization (future)
 *
 * @see /docs/adr/001-business-type-journey-architecture.md for architecture decisions
 */

import { LucideIcon, Shirt, Laptop, Home, Sparkles, Palette, Coffee } from 'lucide-react';
import { ModernTemplate } from '@/templates/modern';
import { ArtisanTemplate } from '@/templates/artisan';
import { TechTemplate } from '@/templates/tech';

/**
 * Business type journey configuration
 * Defines the onboarding and product creation experience for each business category
 */
export interface BusinessTypeJourney {
  /** Onboarding-specific settings */
  onboarding: {
    /** AI prompt guidance for logo generation style */
    logoStyle: string;
    /** AI prompt guidance for color scheme preferences */
    colorScheme: string;
    /** Additional onboarding steps for this business type (future) */
    additionalSteps?: string[];
  };
  /** Product creation form customization */
  productCreation: {
    /** Required fields specific to this business type */
    requiredFields?: string[];
    /** AI prompt style for product descriptions */
    aiDescriptionStyle: string;
    /** Image requirements and guidance */
    imageRequirements: string;
  };
}

/**
 * Complete business type configuration
 */
export interface BusinessTypeConfig {
  /** Unique identifier (matches form values) */
  id: string;
  /** Display label shown to users */
  label: string;
  /** Detailed description of this business category */
  description: string;
  /** Context passed to AI prompts for this business type */
  aiPromptContext: string;
  /** Recommended features for this business type (future) */
  recommendedFeatures?: string[];
  /** Template component to use for storefronts */
  template: React.ComponentType<unknown>;
  /** Lucide icon component for UI */
  icon: LucideIcon;
  /** Journey configuration for onboarding and product creation */
  journey: BusinessTypeJourney;
}

/**
 * All supported business types
 *
 * @example
 * ```typescript
 * import { BUSINESS_TYPES } from '@/config/business-types';
 *
 * // Get config for a specific type
 * const fashionConfig = BUSINESS_TYPES.FASHION;
 *
 * // Generate AI prompt
 * const prompt = `Generate a product description for a ${fashionConfig.aiPromptContext} business`;
 * ```
 */
export const BUSINESS_TYPES = {
  FASHION: {
    id: 'fashion',
    label: 'Fashion & Apparel',
    description: 'Clothing, accessories, and fashion items',
    aiPromptContext: 'fashion and style-focused',
    recommendedFeatures: ['size-charts', 'color-variants', 'lookbooks', 'style-guides'],
    template: ModernTemplate,
    icon: Shirt,
    journey: {
      onboarding: {
        logoStyle: 'elegant, minimalist, fashion-forward',
        colorScheme: 'sophisticated, trendy, timeless',
        additionalSteps: ['brand-aesthetic', 'target-audience'],
      },
      productCreation: {
        requiredFields: ['size', 'color', 'material', 'care-instructions'],
        aiDescriptionStyle: 'aspirational, lifestyle-focused, emphasizes style and fit',
        imageRequirements: 'Clean background, model shots preferred, multiple angles showing fit and detail',
      },
    },
  },

  ELECTRONICS: {
    id: 'electronics',
    label: 'Electronics & Gadgets',
    description: 'Tech products and electronic devices',
    aiPromptContext: 'technology and innovation-focused with technical specifications',
    recommendedFeatures: ['spec-sheets', 'warranty-info', 'comparison-tables', 'compatibility-guides'],
    template: TechTemplate,
    icon: Laptop,
    journey: {
      onboarding: {
        logoStyle: 'modern, sleek, tech-forward',
        colorScheme: 'blue/gray professional tones, high-tech aesthetic',
        additionalSteps: ['warranty-policy', 'return-policy', 'tech-support'],
      },
      productCreation: {
        requiredFields: ['specs', 'warranty', 'compatibility', 'dimensions'],
        aiDescriptionStyle: 'feature-focused, technical, highlights specifications and capabilities',
        imageRequirements: 'White background, multiple angles, close-ups of ports/features',
      },
    },
  },

  HOME_GOODS: {
    id: 'home-goods',
    label: 'Home Goods & Decor',
    description: 'Furniture, home accessories, and decor items',
    aiPromptContext: 'home and lifestyle-focused with interior design emphasis',
    recommendedFeatures: ['room-visualizer', 'dimension-guides', 'material-samples', 'style-collections'],
    template: ArtisanTemplate,
    icon: Home,
    journey: {
      onboarding: {
        logoStyle: 'warm, inviting, home-focused',
        colorScheme: 'neutral, earthy, comfortable tones',
        additionalSteps: ['design-style', 'price-range'],
      },
      productCreation: {
        requiredFields: ['dimensions', 'material', 'color-options', 'assembly-required'],
        aiDescriptionStyle: 'lifestyle-focused, emphasizes comfort and aesthetics, how it fits in a home',
        imageRequirements: 'Lifestyle shots in home settings, dimension references, texture details',
      },
    },
  },

  HEALTH_BEAUTY: {
    id: 'health-beauty',
    label: 'Health & Beauty',
    description: 'Cosmetics, skincare, wellness, and personal care products',
    aiPromptContext: 'health, beauty, and wellness-focused',
    recommendedFeatures: ['ingredient-lists', 'skin-type-filters', 'before-after', 'routine-builders'],
    template: ModernTemplate,
    icon: Sparkles,
    journey: {
      onboarding: {
        logoStyle: 'clean, elegant, wellness-oriented',
        colorScheme: 'soft pastels or clean whites, natural tones',
        additionalSteps: ['product-certifications', 'ingredient-philosophy'],
      },
      productCreation: {
        requiredFields: ['ingredients', 'skin-type', 'usage-instructions', 'size-volume'],
        aiDescriptionStyle: 'benefit-focused, emphasizes results and ingredients, addresses concerns',
        imageRequirements: 'Clean, well-lit shots, product texture, packaging details',
      },
    },
  },

  HANDMADE: {
    id: 'handmade',
    label: 'Handmade & Crafts',
    description: 'Artisan products, handcrafted items, and unique creations',
    aiPromptContext: 'artisan and handcrafted with emphasis on uniqueness and craftsmanship',
    recommendedFeatures: ['maker-story', 'custom-orders', 'crafting-process', 'limited-editions'],
    template: ArtisanTemplate,
    icon: Palette,
    journey: {
      onboarding: {
        logoStyle: 'handcrafted, artistic, personal',
        colorScheme: 'warm, authentic, creative',
        additionalSteps: ['maker-story', 'crafting-methods'],
      },
      productCreation: {
        requiredFields: ['materials', 'handmade-details', 'creation-time', 'customization-options'],
        aiDescriptionStyle: 'story-focused, emphasizes craftsmanship and uniqueness, personal touch',
        imageRequirements: 'Show crafting process, detail shots, artisan at work, unique features',
      },
    },
  },

  FOOD_BEVERAGE: {
    id: 'food-beverage',
    label: 'Food & Beverage',
    description: 'Consumable goods, beverages, and culinary products',
    aiPromptContext: 'food and beverage with focus on taste, quality, and ingredients',
    recommendedFeatures: ['nutrition-facts', 'allergen-info', 'recipes', 'pairing-guides'],
    template: ArtisanTemplate,
    icon: Coffee,
    journey: {
      onboarding: {
        logoStyle: 'appetizing, fresh, inviting',
        colorScheme: 'vibrant, natural food tones',
        additionalSteps: ['food-safety-certs', 'sourcing-info'],
      },
      productCreation: {
        requiredFields: ['ingredients', 'allergens', 'expiration-info', 'storage-instructions'],
        aiDescriptionStyle: 'sensory-focused, emphasizes taste and quality, ingredients and origin',
        imageRequirements: 'Appetizing shots, ingredient close-ups, serving suggestions, packaging',
      },
    },
  },
} as const;

/**
 * Helper type for business type IDs
 */
export type BusinessTypeId = keyof typeof BUSINESS_TYPES;

/**
 * Helper type for business type configuration
 */
export type BusinessTypeConfigType = typeof BUSINESS_TYPES[BusinessTypeId];

/**
 * Get business type configuration by ID
 *
 * @param id - The business type ID
 * @returns The business type configuration or undefined if not found
 *
 * @example
 * ```typescript
 * const config = getBusinessTypeById('fashion');
 * console.log(config.label); // "Fashion & Apparel"
 * ```
 */
export function getBusinessTypeById(id: string): BusinessTypeConfigType | undefined {
  const key = Object.keys(BUSINESS_TYPES).find(
    (k) => BUSINESS_TYPES[k as BusinessTypeId].id === id
  );
  return key ? BUSINESS_TYPES[key as BusinessTypeId] : undefined;
}

/**
 * Get all business type IDs as an array
 *
 * @returns Array of all business type IDs
 *
 * @example
 * ```typescript
 * const ids = getAllBusinessTypeIds();
 * // ['fashion', 'electronics', 'home-goods', ...]
 * ```
 */
export function getAllBusinessTypeIds(): string[] {
  return Object.values(BUSINESS_TYPES).map(type => type.id);
}

/**
 * Get all business types as an array
 *
 * @returns Array of all business type configurations
 *
 * @example
 * ```typescript
 * const types = getAllBusinessTypes();
 * types.forEach(type => {
 *   console.log(type.label);
 * });
 * ```
 */
export function getAllBusinessTypes(): BusinessTypeConfigType[] {
  return Object.values(BUSINESS_TYPES);
}

/**
 * Check if a given string is a valid business type ID
 *
 * @param id - The ID to check
 * @returns True if the ID is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidBusinessTypeId('fashion'); // true
 * isValidBusinessTypeId('invalid'); // false
 * ```
 */
export function isValidBusinessTypeId(id: string): boolean {
  return getAllBusinessTypeIds().includes(id);
}

/**
 * Get AI prompt context for a business type
 *
 * @param id - The business type ID
 * @returns The AI prompt context string
 *
 * @example
 * ```typescript
 * const context = getAIPromptContext('fashion');
 * // "fashion and style-focused"
 * ```
 */
export function getAIPromptContext(id: string): string {
  const config = getBusinessTypeById(id);
  return config?.aiPromptContext || 'general e-commerce';
}

/**
 * Get product description AI style for a business type
 *
 * @param id - The business type ID
 * @returns The AI description style guidance
 */
export function getProductDescriptionStyle(id: string): string {
  const config = getBusinessTypeById(id);
  return config?.journey.productCreation.aiDescriptionStyle || 'general, informative product description';
}
