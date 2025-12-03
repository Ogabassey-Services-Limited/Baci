'use client';

import type { Data } from '@measured/puck';
import { Render } from '@measured/puck';
import { Loader2 } from 'lucide-react';
import {
  Component,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { builderConfig } from '@/components/builder/config';
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
}

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
  brandColors: BrandColors;
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
}: OnboardingPuckPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [puckData, setPuckData] = useState<Data | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Generate Puck data asynchronously
  useEffect(() => {
    let isMounted = true;

    if (!brandColors) {
      setPuckData(null);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await generatePreviewTemplate({
          businessName: businessName || 'Your Store',
          businessType: businessType || 'other',
          logoDataUri: logoDataUri ?? null,
          brandColors,
        });

        if (isMounted) {
          setPuckData(data);
        }
      } catch (error) {
        // Log error but don't crash - preview is non-critical
        console.error('Failed to generate preview template:', error);

        // Set null to show fallback UI
        if (isMounted) {
          setPuckData(null);
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
  }, [businessName, businessType, logoDataUri, brandColors]);

  // Memoize theme styles to avoid manual DOM manipulation
  const themeStyles = useMemo(() => {
    if (!brandColors) return {};
    return getThemeStyles(brandColors);
  }, [brandColors]);

  if (!brandColors || !puckData) {
    return (
      <div className="p-6 rounded-lg border border-dashed flex items-center justify-center h-full text-muted-foreground">
        Your store preview will appear here once your logo is uploaded.
      </div>
    );
  }

  return (
    <div className="relative p-4 rounded-lg border border-dashed bg-muted/20 overflow-hidden">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-background/50 backdrop-blur-sm transition-opacity duration-200">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Live Preview Badge */}
      <div className="absolute top-16 right-6 z-50 bg-amber-500 text-black text-[10px] px-3 py-1.5 rounded-full font-semibold shadow-lg">
        Live Store Preview
      </div>

      <div
        ref={previewRef}
        className="scale-[0.8] origin-top-left w-[125%] -translate-x-1 -translate-y-1 bg-background rounded-md shadow-lg"
        style={{
          backgroundColor: 'var(--theme-background)',
          ...themeStyles,
        }}
      >
        <PreviewErrorBoundary>
          <Render config={builderConfig} data={puckData} />
        </PreviewErrorBoundary>
      </div>
    </div>
  );
}
