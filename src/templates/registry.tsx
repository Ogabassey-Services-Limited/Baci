/**
 * @fileOverview Centralized Template Registry - Single Source of Truth
 *
 * This file defines all available storefront templates in the Baci platform.
 * Template creators should register new templates here to make them available
 * for preview and production use.
 *
 * @example
 * ```typescript
 * import { TEMPLATE_REGISTRY, getTemplate } from '@/templates/registry';
 *
 * const template = getTemplate('ogabassey-v2');
 * if (template) {
 *   console.log(template.name); // "Ogabassey V2"
 * }
 * ```
 */

import type { ComponentType, ReactNode } from 'react';
import type { MerchantData } from '@/hooks/use-merchant';
import type { Product } from '@/lib/products';

/**
 * Template status - controls visibility and access
 */
export type TemplateStatus = 'production' | 'beta' | 'draft';

/**
 * Template category for filtering and organization
 */
export type TemplateCategory =
  | 'gadgets'
  | 'fashion'
  | 'general'
  | 'food'
  | 'services'
  | 'beauty';

/**
 * Engine integration flags - indicates which e-commerce features work
 */
export interface EngineIntegration {
  /** Uses real product API from Supabase */
  products: boolean;
  /** Cart add/remove/update works */
  cart: boolean;
  /** Full checkout flow works */
  checkout: boolean;
  /** Customer authentication works */
  customerAuth: boolean;
  /** Wishlist functionality works */
  wishlist: boolean;
  /** Order tracking works */
  orderTracking: boolean;
}

/**
 * Template component references
 */
export interface TemplateComponents {
  /** Main home page component */
  Home: ComponentType<TemplatePageProps>;
  /** Product detail page (optional, uses default if not provided) */
  ProductDetail?: ComponentType<TemplatePageProps>;
  /** Cart page (optional, uses default if not provided) */
  Cart?: ComponentType<TemplatePageProps>;
  /** Checkout page (optional, uses default if not provided) */
  Checkout?: ComponentType<TemplatePageProps>;
  /** Category page (optional, uses default if not provided) */
  Category?: ComponentType<TemplatePageProps>;
  /** Layout wrapper (optional) */
  Layout?: ComponentType<{ children: ReactNode }>;
}

/**
 * Props passed to template page components
 */
export interface TemplatePageProps {
  /** Store slug for routing */
  storeSlug?: string;
  /** Merchant data (real or mock) */
  merchant?: MerchantData;
  /** Products (real or mock) */
  products?: Product[];
  /** Whether this is a preview mode */
  isPreview?: boolean;
}

/**
 * Mock data for template preview
 */
export interface TemplateMockData {
  /** Mock merchant data for preview */
  merchant: MerchantData;
  /** Mock products for preview (optional, uses shared mock if not provided) */
  products?: Product[];
}

/**
 * Complete template definition
 */
export interface TemplateDefinition {
  /** Unique identifier (used in URLs) */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Preview thumbnail URL (optional) */
  thumbnail?: string;
  /** Template category */
  category: TemplateCategory;
  /** Current development status */
  status: TemplateStatus;
  /** Version string */
  version: string;
  /** Author/creator */
  author?: string;
  /** Engine integration status */
  engine: EngineIntegration;
  /** Component exports - lazy loaded */
  getComponents: () => Promise<TemplateComponents>;
  /** Mock data for preview mode */
  mockData: TemplateMockData;
  /** Tags for search/filtering */
  tags?: string[];
  /** Date created */
  createdAt?: string;
  /** Date last updated */
  updatedAt?: string;
}

// =============================================================================
// DEFAULT MOCK MERCHANT DATA
// =============================================================================

const defaultMockMerchant: MerchantData = {
  id: 'preview-merchant',
  user_id: 'preview-user',
  business_name: 'Template Preview Store',
  business_type: 'GADGETS',
  logo_url: undefined,
  brand_colors: {
    primary: '#3B82F6',
    background: '#FFFFFF',
    accent: '#10B981',
  },
  country: 'NG',
  slug: 'template-preview',
  published_config: null,
};

// =============================================================================
// TEMPLATE REGISTRY
// =============================================================================

/**
 * All registered templates
 *
 * To add a new template:
 * 1. Create your template folder in /src/templates/[template-name]/
 * 2. Add an entry here with status: 'draft'
 * 3. Preview at /template-preview/[template-name]
 * 4. When ready, change status to 'beta' or 'production'
 */
export const TEMPLATE_REGISTRY: Record<string, TemplateDefinition> = {
  // ---------------------------------------------------------------------------
  // PRODUCTION TEMPLATES
  // ---------------------------------------------------------------------------

  'gadget-default': {
    id: 'gadget-default',
    name: 'Gadget Default',
    description: 'Standard template for electronics and gadget stores',
    thumbnail: '/.gemini/antigravity/brain/cbb117d5-7762-43f9-a5e1-d1d129af3887/gadget_default_preview_after_wait_1765030055914.png',
    category: 'gadgets',
    status: 'production',
    version: '1.0.0',
    engine: {
      products: true,
      cart: true,
      checkout: true,
      customerAuth: true,
      wishlist: false,
      orderTracking: true,
    },
    getComponents: async () => {
      const { GadgetDefaultTemplate } = await import(
        '@/components/storefront/templates/gadget-default-template'
      );
      return {
        Home: GadgetDefaultTemplate as ComponentType<TemplatePageProps>,
      };
    },
    mockData: {
      merchant: {
        ...defaultMockMerchant,
        id: 'gadget-default-preview',
        business_name: 'TechZone Store',
        business_type: 'ELECTRONICS',
        brand_colors: {
          primary: '#2563EB',
          background: '#F8FAFC',
          accent: '#0891B2',
        },
      },
    },
    tags: ['electronics', 'tech', 'gadgets', 'modern'],
  },

  'premium-default': {
    id: 'premium-default',
    name: 'Premium Default',
    description: 'Elegant template for fashion and luxury brands',
    thumbnail: '/.gemini/antigravity/brain/cbb117d5-7762-43f9-a5e1-d1d129af3887/premium_default_preview_after_wait_1765030083226.png',
    category: 'fashion',
    status: 'production',
    version: '1.0.0',
    engine: {
      products: true,
      cart: true,
      checkout: true,
      customerAuth: true,
      wishlist: false,
      orderTracking: true,
    },
    getComponents: async () => {
      const { PremiumDefaultTemplate } = await import(
        '@/components/storefront/templates/premium-default'
      );
      return {
        Home: PremiumDefaultTemplate as ComponentType<TemplatePageProps>,
      };
    },
    mockData: {
      merchant: {
        ...defaultMockMerchant,
        id: 'premium-default-preview',
        business_name: 'Luxe Fashion',
        business_type: 'FASHION',
        brand_colors: {
          primary: '#1F2937',
          background: '#FAFAFA',
          accent: '#D4AF37',
        },
      },
    },
    tags: ['fashion', 'luxury', 'elegant', 'premium'],
  },

  'home-goods': {
    id: 'home-goods',
    name: 'Haven Home',
    description: 'Warm, lifestyle-focused template for furniture and home decor stores',
    thumbnail: '/.gemini/antigravity/brain/cbb117d5-7762-43f9-a5e1-d1d129af3887/home_goods_template_preview_1765032079483.png',
    category: 'general',
    status: 'production',
    version: '1.0.0',
    engine: {
      products: true,
      cart: true,
      checkout: true,
      customerAuth: false,
      wishlist: false,
      orderTracking: false,
    },
    getComponents: async () => {
      const { HomeGoodsHome } = await import('./home-goods');
      return { Home: HomeGoodsHome };
    },
    mockData: {
      merchant: {
        ...defaultMockMerchant,
        id: 'home-goods-preview',
        business_name: 'Haven Home',
        business_type: 'HOME_GOODS',
        brand_colors: {
          primary: '#8B4513',
          background: '#FAF8F5',
          accent: '#D4A574',
        },
      },
    },
    tags: ['home', 'furniture', 'decor', 'lifestyle', 'warm'],
  },

  'food-beverage': {
    id: 'food-beverage',
    name: 'Artisan Kitchen',
    description: 'Warm, rustic template for gourmet food e-commerce with dietary filters and recipe inspiration',
    thumbnail: '/.gemini/antigravity/brain/cbb117d5-7762-43f9-a5e1-d1d129af3887/food_template_hero_1765034186701.png',
    category: 'general',
    status: 'production',
    version: '1.0.0',
    engine: {
      products: true,
      cart: true,
      checkout: true,
      customerAuth: false,
      wishlist: false,
      orderTracking: false,
    },
    getComponents: async () => {
      const { FoodBeverageHome } = await import('./food-beverage');
      return { Home: FoodBeverageHome };
    },
    mockData: {
      merchant: {
        ...defaultMockMerchant,
        id: 'food-beverage-preview',
        business_name: 'Artisan Kitchen',
        business_type: 'FOOD_BEVERAGE',
        brand_colors: {
          primary: '#D2691E',
          background: '#FFF8E7',
          accent: '#556B2F',
        },
      },
    },
    tags: ['food', 'gourmet', 'organic', 'artisan', 'recipes'],
  },

  beauty: {
    id: 'beauty',
    name: 'Radiant Beauty',
    description: 'Minimalist luxury template for health & beauty brands with skin quiz and ingredient focus',
    thumbnail: '/.gemini/antigravity/brain/cbb117d5-7762-43f9-a5e1-d1d129af3887/beauty_products_section_1765033465009.png',
    category: 'general',
    status: 'production',
    version: '1.0.0',
    engine: {
      products: true,
      cart: true,
      checkout: true,
      customerAuth: false,
      wishlist: false,
      orderTracking: false,
    },
    getComponents: async () => {
      const { BeautyHome } = await import('./beauty');
      return { Home: BeautyHome };
    },
    mockData: {
      merchant: {
        ...defaultMockMerchant,
        id: 'beauty-preview',
        business_name: 'Radiant Beauty',
        business_type: 'HEALTH_BEAUTY',
        brand_colors: {
          primary: '#FFD6E8',
          background: '#FAF9F6',
          accent: '#B76E79',
        },
      },
    },
    tags: ['beauty', 'skincare', 'wellness', 'luxury', 'minimalist'],
  },

  'hair-extensions': {
    id: 'hair-extensions',
    name: 'Glamour Hair Studio',
    description: 'Dark luxury template for hair extensions and wigs with texture/length filters and tutorials',
    thumbnail: '/.gemini/antigravity/brain/cbb117d5-7762-43f9-a5e1-d1d129af3887/hair_template_hero_1765034748122.png',
    category: 'general',
    status: 'production',
    version: '1.0.0',
    engine: {
      products: true,
      cart: true,
      checkout: true,
      customerAuth: false,
      wishlist: false,
      orderTracking: false,
    },
    getComponents: async () => {
      const { HairExtensionsHome } = await import('./hair-extensions');
      return { Home: HairExtensionsHome };
    },
    mockData: {
      merchant: {
        ...defaultMockMerchant,
        id: 'hair-extensions-preview',
        business_name: 'Glamour Hair Studio',
        business_type: 'HAIR_EXTENSIONS',
        brand_colors: {
          primary: '#B76E79',
          background: '#1A1A1A',
          accent: '#F5D0C5',
        },
      },
    },
    tags: ['hair', 'extensions', 'wigs', 'beauty', 'glamour'],
  },

  pharmaceutical: {
    id: 'pharmaceutical',
    name: 'MedCare Pharmacy',
    description: 'Professional pharmacy template with trust signals and prescription upload',
    thumbnail: '/.gemini/antigravity/brain/cbb117d5-7762-43f9-a5e1-d1d129af3887/pharmaceutical_template_screenshot_final_1765032763119.png',
    category: 'general',
    status: 'production',
    version: '1.0.0',
    engine: {
      products: true,
      cart: true,
      checkout: true,
      customerAuth: false,
      wishlist: false,
      orderTracking: false,
    },
    getComponents: async () => {
      const { PharmaceuticalHome } = await import('./pharmaceutical');
      return { Home: PharmaceuticalHome };
    },
    mockData: {
      merchant: {
        ...defaultMockMerchant,
        id: 'pharmaceutical-preview',
        business_name: 'MedCare Pharmacy',
        business_type: 'PHARMACEUTICALS',
        brand_colors: {
          primary: '#2563EB',
          background: '#FFFFFF',
          accent: '#10B981',
        },
      },
    },
    tags: ['pharmacy', 'medical', 'healthcare', 'professional', 'trust'],
  },

  // ---------------------------------------------------------------------------
  // BETA TEMPLATES
  // ---------------------------------------------------------------------------

  'ogabassey-v2': {
    id: 'ogabassey-v2',
    name: 'Ogabassey V2',
    description: 'Modern dark theme for gadget stores with advanced features',
    thumbnail: '/.gemini/antigravity/brain/cbb117d5-7762-43f9-a5e1-d1d129af3887/ogabassey_v2_preview_1765030123136.png',
    category: 'gadgets',
    status: 'beta',
    version: '2.1.0-beta',
    author: 'Baci Team',
    engine: {
      products: true, // Now supports engine products via EngineProductGrid
      cart: true,
      checkout: false,
      customerAuth: false,
      wishlist: true,
      orderTracking: false,
    },
    getComponents: async () => {
      const { GadgetCustomTemplateOgabasseyV2 } = await import(
        '@/components/storefront/templates/gadget-custom-template-ogabassey-v2'
      );
      return {
        Home: GadgetCustomTemplateOgabasseyV2 as ComponentType<TemplatePageProps>,
      };
    },
    mockData: {
      merchant: {
        ...defaultMockMerchant,
        id: 'ogabassey-v2-preview',
        business_name: 'Ogabassey',
        business_type: 'GADGETS',
        logo_url:
          'https://ogabassey.com/wp-content/uploads/2023/06/Ogabassey-Logo-1.png',
        brand_colors: {
          primary: '#DC2626',
          background: '#0F172A',
          accent: '#22D3EE',
        },
      },
    },
    tags: ['gadgets', 'dark', 'modern', 'advanced'],
    updatedAt: '2024-12-05',
  },

  // ---------------------------------------------------------------------------
  // DRAFT TEMPLATES (Work in Progress)
  // ---------------------------------------------------------------------------

  'new-template': {
    id: 'new-template',
    name: 'New Template',
    description: 'Modern gadget store with interactive product grid',
    category: 'gadgets',
    status: 'draft',
    version: '0.2.0',
    author: 'Baci Team',
    engine: {
      products: true, // Now supports engine products via EngineProductGrid
      cart: true, // Uses Baci cart system
      checkout: false,
      customerAuth: false,
      wishlist: true, // Uses Baci saved/wishlist system
      orderTracking: false,
    },
    getComponents: async () => {
      const { Home } = await import(
        '@/components/storefront/new-template/home'
      );
      return {
        Home: Home as ComponentType<TemplatePageProps>,
      };
    },
    mockData: {
      merchant: {
        ...defaultMockMerchant,
        id: 'new-template-preview',
        business_name: 'Modern Gadgets',
        business_type: 'GADGETS',
        brand_colors: {
          primary: '#DC2626',
          background: '#FFFFFF',
          accent: '#111827',
        },
      },
    },
    tags: ['gadgets', 'modern', 'interactive', 'work-in-progress'],
    createdAt: '2024-12-04',
    updatedAt: '2024-12-05',
  },

  lumina: {
    id: 'lumina',
    name: 'Lumina',
    description: 'Clean, light template with focus on product imagery',
    category: 'general',
    status: 'draft',
    version: '0.1.0',
    engine: {
      products: true,
      cart: false, // Still needs cart connection
      checkout: false,
      customerAuth: false,
      wishlist: false,
      orderTracking: false,
    },
    getComponents: async () => {
      // Lumina currently only has product grid, not a full home page
      const { LuminaEngineGrid } = await import(
        '@/components/storefront/lumina/engine-grid'
      );
      // Create a wrapper component
      const LuminaHome: ComponentType<TemplatePageProps> = (props) => {
        return (
          <div className="min-h-screen bg-white">
            <LuminaEngineGrid
              storeSlug={props.storeSlug || 'lumina-preview'}
              useMockData={props.isPreview ?? false}
            />
          </div>
        );
      };
      return { Home: LuminaHome };
    },
    mockData: {
      merchant: {
        ...defaultMockMerchant,
        id: 'lumina-preview',
        business_name: 'Lumina Store',
        business_type: 'FASHION',
        brand_colors: {
          primary: '#6366F1',
          background: '#FFFFFF',
          accent: '#EC4899',
        },
      },
    },
    tags: ['minimal', 'clean', 'light', 'work-in-progress'],
  },

  artisan: {
    id: 'artisan',
    name: 'The Artisan Collective',
    description: 'Warm, authentic template for handcrafted and artisan products with maker story and custom orders',
    thumbnail: '/.gemini/antigravity/brain/cbb117d5-7762-43f9-a5e1-d1d129af3887/artisan_template_hero_1765035110905.png',
    category: 'general',
    status: 'production',
    version: '1.0.0',
    engine: {
      products: true,
      cart: true,
      checkout: true,
      customerAuth: false,
      wishlist: false,
      orderTracking: false,
    },
    getComponents: async () => {
      const { HandmadeHome } = await import('./artisan');
      return { Home: HandmadeHome };
    },
    mockData: {
      merchant: {
        ...defaultMockMerchant,
        id: 'artisan-preview',
        business_name: 'The Artisan Collective',
        business_type: 'HANDMADE',
        brand_colors: {
          primary: '#C4785E',
          background: '#FAF6F1',
          accent: '#7D8B6C',
        },
      },
    },
    tags: ['artisan', 'handmade', 'crafts', 'boutique', 'maker'],
  },

  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Clean, minimalist template for contemporary brands',
    category: 'fashion',
    status: 'draft',
    version: '0.1.0',
    engine: {
      products: false,
      cart: false,
      checkout: false,
      customerAuth: false,
      wishlist: false,
      orderTracking: false,
    },
    getComponents: async () => {
      const ModernHome: ComponentType<TemplatePageProps> = (props) => {
        return (
          <div className="min-h-screen bg-white">
            <div className="max-w-6xl mx-auto py-20 px-6">
              <h1 className="text-6xl font-light tracking-tight text-gray-900 mb-4">
                {props.merchant?.business_name || 'Modern Store'}
              </h1>
              <p className="text-xl text-gray-500 mb-12">
                Less is more. Quality over quantity.
              </p>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="aspect-square bg-gray-100 rounded-sm" />
                ))}
              </div>
              <div className="mt-12 p-8 border border-gray-200 rounded-sm">
                <p className="text-gray-600 text-center">
                  ✨ Modern template coming soon. Clean lines, lots of whitespace,
                  and contemporary aesthetics.
                </p>
              </div>
            </div>
          </div>
        );
      };
      return { Home: ModernHome };
    },
    mockData: {
      merchant: {
        ...defaultMockMerchant,
        id: 'modern-preview',
        business_name: 'Modern Studio',
        business_type: 'FASHION',
        brand_colors: {
          primary: '#111827',
          background: '#FFFFFF',
          accent: '#6B7280',
        },
      },
    },
    tags: ['modern', 'minimal', 'clean', 'contemporary', 'work-in-progress'],
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a template by ID
 */
export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATE_REGISTRY[id];
}

/**
 * Get all templates
 */
export function getAllTemplates(): TemplateDefinition[] {
  return Object.values(TEMPLATE_REGISTRY);
}

/**
 * Get templates by status
 */
export function getTemplatesByStatus(
  status: TemplateStatus
): TemplateDefinition[] {
  return getAllTemplates().filter((t) => t.status === status);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: TemplateCategory
): TemplateDefinition[] {
  return getAllTemplates().filter((t) => t.category === category);
}

/**
 * Get production-ready templates only
 */
export function getProductionTemplates(): TemplateDefinition[] {
  return getTemplatesByStatus('production');
}

/**
 * Get all template IDs
 */
export function getAllTemplateIds(): string[] {
  return Object.keys(TEMPLATE_REGISTRY);
}

/**
 * Check if a template exists
 */
export function templateExists(id: string): boolean {
  return id in TEMPLATE_REGISTRY;
}

/**
 * Get template mock merchant data
 */
export function getTemplateMockMerchant(id: string): MerchantData | undefined {
  return TEMPLATE_REGISTRY[id]?.mockData.merchant;
}
