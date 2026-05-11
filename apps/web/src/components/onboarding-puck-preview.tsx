'use client';

import type { Data } from '@puckeditor/core';
import { Render } from '@puckeditor/core';
import { Loader2, Pencil } from 'lucide-react';
import { Component, type ReactNode, useEffect, useState } from 'react';
import { builderConfig } from '@/components/builder/config';
import { Button } from '@/components/ui/button';
import { CartProvider } from '@/hooks/use-cart';
import { type MerchantData, MerchantProvider } from '@/hooks/use-merchant';
import {
  deriveThemeFromColors,
  generateFeatures,
  generateHeroSlides,
} from '@/lib/initial-template-generator';
import type { BrandColors } from '@/types';

interface OnboardingPuckPreviewProps {
  businessName: string;
  businessType: string;
  logoDataUri?: string;
  brandColors?: BrandColors;
  onEdit?: (data: Data) => void;
  data?: Data | null;
}

const PREVIEW_MERCHANT_ID = 'preview-merchant-id-preview';

/**
 * Error Boundary to catch merchant context errors
 */
class PreviewErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Only catch merchant context errors, re-throw others
    if (
      !error.message.includes(
        'useMerchant must be used within a MerchantProvider'
      )
    ) {
      throw error;
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-lg border border-dashed flex items-center justify-center h-full text-muted-foreground">
          Preview temporarily unavailable. Your store will display correctly
          after onboarding.
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Apply theme CSS variables to a specific element (scoped, not global)
 */
/**
 * Get theme CSS variables as a style object
 */
function getThemeStyles(brandColors: BrandColors): React.CSSProperties {
  const theme = deriveThemeFromColors(brandColors);

  return {
    // Colors
    '--theme-primary': theme.colors.primary,
    '--theme-secondary': theme.colors.secondary,
    '--theme-accent': theme.colors.accent,
    '--theme-background': theme.colors.background,
    '--theme-foreground': theme.colors.foreground,
    '--theme-muted': theme.colors.muted,
    '--theme-muted-foreground': theme.colors.mutedForeground,
    '--theme-border': theme.colors.border,

    // Header colors
    '--theme-header-bg': theme.colors.header.background,
    '--theme-header-text': theme.colors.header.text,
    '--theme-header-icon': theme.colors.header.iconColor,
    '--theme-header-search-border': theme.colors.header.searchBorder,
    '--theme-header-search-bg': theme.colors.header.searchBackground,

    // Footer colors
    '--theme-footer-bg': theme.colors.footer.background,
    '--theme-footer-text': theme.colors.footer.text,
    '--theme-footer-link': theme.colors.footer.linkColor,
    '--theme-footer-link-hover': theme.colors.footer.linkHoverColor,

    // Button colors
    '--theme-button-primary-bg': theme.colors.button.primary.background,
    '--theme-button-primary-text': theme.colors.button.primary.text,
    '--theme-button-primary-hover': theme.colors.button.primary.hover,
    '--theme-button-secondary-bg': theme.colors.button.secondary.background,
    '--theme-button-secondary-text': theme.colors.button.secondary.text,
    '--theme-button-secondary-hover': theme.colors.button.secondary.hover,
    '--theme-button-accent-bg': theme.colors.button.accent.background,
    '--theme-button-accent-text': theme.colors.button.accent.text,
    '--theme-button-accent-hover': theme.colors.button.accent.hover,

    // Card colors
    '--theme-card-bg': theme.colors.card.background,
    '--theme-card-border': theme.colors.card.border,
    '--theme-card-text': theme.colors.card.text,

    // Input colors
    '--theme-input-bg': theme.colors.input.background,
    '--theme-input-border': theme.colors.input.border,
    '--theme-input-text': theme.colors.input.text,
    '--theme-input-placeholder': theme.colors.input.placeholder,
    '--theme-input-focus-border': theme.colors.input.focusBorder,

    // Store variables for ThemedButton/ThemedCard compatibility
    '--store-primary': brandColors.primary,
    '--store-accent': brandColors.accent,
    '--store-background': brandColors.background,
    '--store-primary-text': theme.colors.button.primary.text,
    '--store-accent-text': theme.colors.button.accent.text,
    '--store-background-text': theme.colors.button.secondary.text,
  } as React.CSSProperties;
}

/**
 * Generate preview template data (client-side version of generateInitialTemplate)
 */
async function generatePreviewTemplate(params: {
  businessName: string;
  businessType: string;
  logoDataUri: string | null;
}): Promise<Data> {
  const { businessName, businessType, logoDataUri } = params;

  // Generate hero slides (await the async function)
  const slides = await generateHeroSlides(businessName, businessType);

  // Generate features
  const features = generateFeatures(businessType);

  // Generate unique IDs for preview components
  const timestamp = Date.now();
  const headerId = `Header-preview-${timestamp}`;
  const heroCarouselId = `HeroCarousel-preview-${timestamp}`;
  const featuresId = `Features-preview-${timestamp}`;
  const productGridId = `ProductGrid-preview-${timestamp}`;
  const newsletterId = `Newsletter-preview-${timestamp}`;
  const footerId = `Footer-preview-${timestamp}`;

  // Create Puck data structure
  const config: Data = {
    content: [
      // Header
      {
        type: 'Header',
        props: {
          id: headerId,
          showLogo: true,
          showSearch: true,
          showCart: true,
          showMenu: true,
          sticky: true,
          navigationLinks: [
            { label: 'Home', url: '/' },
            { label: 'Shop', url: '/products' },
            { label: 'About', url: '/about' },
          ],
          ctaButton: {
            show: false,
            text: 'Get Started',
            url: '/signup',
          },
          storeName: businessName,
          ...(logoDataUri && {
            logoUrl: logoDataUri,
          }),
        },
      },
      // Hero Carousel
      {
        type: 'HeroCarousel',
        props: {
          id: heroCarouselId,
          slides: slides,
          autoplayDelay: 5000,
        },
      },
      // Features Section
      {
        type: 'Features',
        props: {
          id: featuresId,
          title: 'Why Choose Us',
          features: features,
          columns: 3,
        },
      },
      // Product Grid
      {
        type: 'ProductGrid',
        props: {
          id: productGridId,
          title: 'Our Products',
          columns: 4,
          limit: 12,
          sortBy: 'newest',
          showFilters: true,
        },
      },
      // Newsletter Section
      {
        type: 'Newsletter',
        props: {
          id: newsletterId,
          title: 'Stay Updated',
          description:
            'Subscribe to our newsletter for the latest updates and exclusive offers.',
          buttonText: 'Subscribe',
          placeholder: 'Enter your email',
        },
      },
      // Footer
      {
        type: 'Footer',
        props: {
          id: footerId,
          showQuickLinks: true,
          quickLinks: [
            { label: 'About Us', url: '/about' },
            { label: 'Contact', url: '/contact' },
            { label: 'Privacy Policy', url: '/privacy' },
            { label: 'Terms', url: '/terms' },
          ],
          socialLinks: {},
          showNewsletter: false,
        },
      },
    ],
    root: {
      props: {
        title: 'Home',
      },
    },
    zones: {},
  };

  return config;
}

export function OnboardingPuckPreview({
  businessName,
  businessType,
  logoDataUri,
  brandColors,
  onEdit,
  data: externalData,
}: OnboardingPuckPreviewProps) {
  const [internalPuckData, setInternalPuckData] = useState<Data | null>(null);
  const puckData = externalData || internalPuckData;
  const [isLoading, setIsLoading] = useState(false);

  // Generate Puck data asynchronously
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await generatePreviewTemplate({
          businessName: businessName || 'Your Store',
          businessType: businessType || 'other',
          logoDataUri: logoDataUri ?? null,
        });

        if (isMounted) {
          setInternalPuckData(data);
        }
      } catch (error) {
        // Log error but don't crash - preview is non-critical
        console.error('Failed to generate preview template:', error);

        // Set null to show fallback UI
        if (isMounted) {
          setInternalPuckData(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [businessName, businessType, logoDataUri]); // Regenerate on any input change

  /* Expanded State */
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate theme styles
  const themeStyles = brandColors ? getThemeStyles(brandColors) : {};

  // Patch the logo into puckData immediately when it changes (faster than full regeneration)
  let patchedPuckData: Data | null = null;
  if (puckData) {
    if (logoDataUri) {
      // Clone the data and update Header's logoUrl
      const patched = JSON.parse(JSON.stringify(puckData)) as Data;
      const headerIndex = patched.content.findIndex((c) => c.type === 'Header');
      if (headerIndex !== -1 && patched.content[headerIndex].props) {
        patched.content[headerIndex].props.logoUrl = logoDataUri;
      }
      patchedPuckData = patched;
    } else {
      patchedPuckData = puckData;
    }
  }

  if (!brandColors || !puckData || !patchedPuckData) {
    return (
      <div className="p-6 rounded-lg border border-dashed flex items-center justify-center h-full text-muted-foreground bg-muted/20">
        Your store preview will appear here once your logo is uploaded.
      </div>
    );
  }

  // Full Screen Modal for Expanded View
  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
        <div className="relative w-full h-full max-w-[1600px] bg-background rounded-xl border shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="h-14 border-b flex items-center justify-between px-6 bg-muted/10">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Live Store Preview
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(false)}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-x"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              <span className="sr-only">Close Preview</span>
            </Button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="min-h-full" style={themeStyles}>
              <MerchantProvider
                initialMerchant={
                  {
                    id: PREVIEW_MERCHANT_ID,
                    user_id: 'preview-user-id',
                    business_name: businessName || 'Your Store',
                    business_type: businessType || 'other',
                    slug: 'preview-store',
                    brand_colors: brandColors,
                  } as MerchantData
                }
              >
                <CartProvider
                  merchantSlug="preview-store"
                  deferValidationUntilIdle
                >
                  <PreviewErrorBoundary>
                    <Render config={builderConfig} data={patchedPuckData} />
                  </PreviewErrorBoundary>
                </CartProvider>
              </MerchantProvider>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal "Card" View
  return (
    <div className="relative w-full h-full rounded-xl border border-white/10 bg-muted/20 overflow-hidden flex flex-col group">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-background/50 backdrop-blur-sm transition-opacity duration-200">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Toolbar - Positioned below header */}
      <div className="absolute top-14 right-4 z-50 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <Button
          size="sm"
          variant="secondary"
          className="shadow-sm border border-white/10 bg-background/80 backdrop-blur-md hover:bg-background h-8 text-xs gap-2"
          onClick={() => setIsExpanded(true)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-maximize-2"
            aria-hidden="true"
          >
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" x2="14" y1="3" y2="10" />
            <line x1="3" x2="10" y1="21" y2="14" />
          </svg>
          Expand
        </Button>
      </div>

      {/* Edit Button - Positioned below header */}
      {onEdit && puckData && (
        <div className="absolute top-14 left-4 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button
            size="sm"
            variant="secondary"
            className="shadow-sm border border-white/10 bg-background/80 backdrop-blur-md hover:bg-background h-8 text-xs pr-3 pl-2"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(puckData);
            }}
          >
            <div className="relative mr-2">
              <Pencil
                className="w-3 h-3"
                style={{ color: brandColors?.primary }}
              />
            </div>
            Edit Template
          </Button>
        </div>
      )}

      {/* Internal Scrollable Area */}
      <div className="w-full h-full overflow-y-auto overflow-x-hidden p-4">
        <div
          className="origin-top-left scale-[0.65] sm:scale-[0.75] md:scale-[0.8] lg:scale-[0.85] w-[153.9%] sm:w-[133.4%] md:w-[125%] lg:w-[117.7%] min-h-[153.9%] sm:min-h-[133.4%] md:min-h-[125%] lg:min-h-[117.7%] rounded-md bg-background shadow-lg"
          style={{
            backgroundColor: 'var(--theme-background)',
            ...themeStyles,
          }}
        >
          <MerchantProvider
            initialMerchant={
              {
                id: PREVIEW_MERCHANT_ID,
                user_id: 'preview-user-id',
                business_name: businessName || 'Your Store',
                business_type: businessType || 'other',
                slug: 'preview-store',
                brand_colors: brandColors,
              } as MerchantData
            }
          >
            <CartProvider merchantSlug="preview-store" deferValidationUntilIdle>
              <PreviewErrorBoundary>
                <Render config={builderConfig} data={patchedPuckData} />
              </PreviewErrorBoundary>
            </CartProvider>
          </MerchantProvider>
        </div>
      </div>
    </div>
  );
}
