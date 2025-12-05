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
  /** Explicitly force mock data usage (for previews) */
  useMockData?: boolean;
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

  // ---------------------------------------------------------------------------
  // BETA TEMPLATES
  // ---------------------------------------------------------------------------

  'ogabassey-v2': {
    id: 'ogabassey-v2',
    name: 'Ogabassey V2',
    description: 'Modern dark theme for gadget stores with advanced features',
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
    tags: ['gadgets', 'modern', 'interactive', 'wip'],
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
    tags: ['minimal', 'clean', 'light', 'wip'],
  },

  artisan: {
    id: 'artisan',
    name: 'Artisan',
    description: 'Handcrafted template for artisan and boutique stores',
    category: 'general',
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
      const ArtisanHome: ComponentType<TemplatePageProps> = (props) => {
        return (
          <div className="min-h-screen bg-amber-50">
            <div className="max-w-4xl mx-auto py-20 px-6 text-center">
              <h1 className="text-4xl font-serif text-amber-900 mb-4">
                {props.merchant?.business_name || 'Artisan Store'}
              </h1>
              <p className="text-amber-700 mb-8">
                Handcrafted goods made with love
              </p>
              <div className="bg-white rounded-lg shadow-lg p-8">
                <p className="text-gray-600">
                  🎨 Artisan template coming soon. This will feature warm colors,
                  serif typography, and a handcrafted aesthetic.
                </p>
              </div>
            </div>
          </div>
        );
      };
      return { Home: ArtisanHome };
    },
    mockData: {
      merchant: {
        ...defaultMockMerchant,
        id: 'artisan-preview',
        business_name: 'Artisan Crafts',
        business_type: 'GENERAL',
        brand_colors: {
          primary: '#92400E',
          background: '#FFFBEB',
          accent: '#D97706',
        },
      },
    },
    tags: ['artisan', 'boutique', 'handcrafted', 'warm', 'wip'],
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
    tags: ['modern', 'minimal', 'clean', 'contemporary', 'wip'],
  },

  tech: {
    id: 'tech',
    name: 'Tech',
    description: 'Dark theme template optimized for electronics and tech stores',
    category: 'gadgets',
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
      const TechHome: ComponentType<TemplatePageProps> = (props) => {
        return (
          <div className="min-h-screen bg-gray-950 text-white">
            <div className="max-w-6xl mx-auto py-20 px-6">
              <div className="text-center mb-16">
                <h1 className="text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  {props.merchant?.business_name || 'Tech Store'}
                </h1>
                <p className="text-gray-400 text-lg">
                  The future of technology, today.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="aspect-square bg-gray-900 rounded-lg border border-gray-800"
                  />
                ))}
              </div>
              <div className="mt-12 p-8 bg-gray-900 rounded-lg border border-gray-800 text-center">
                <p className="text-gray-400">
                  🚀 Tech template coming soon. Dark mode, neon accents,
                  and futuristic vibes.
                </p>
              </div>
            </div>
          </div>
        );
      };
      return { Home: TechHome };
    },
    mockData: {
      merchant: {
        ...defaultMockMerchant,
        id: 'tech-preview',
        business_name: 'TechZone',
        business_type: 'ELECTRONICS',
        brand_colors: {
          primary: '#06B6D4',
          background: '#030712',
          accent: '#3B82F6',
        },
      },
    },
    tags: ['tech', 'electronics', 'dark', 'futuristic', 'wip'],
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
