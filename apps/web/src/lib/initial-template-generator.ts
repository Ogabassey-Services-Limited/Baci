import type { Data } from '@puckeditor/core';
import { generateObject } from 'ai';
import z from 'zod';
import { activeTextModel } from '@/ai/provider';
import {
  getInitialTemplateProfile,
  normalizeBusinessType,
  type TemplateSection,
} from '@/lib/initial-template-profiles';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { ThemeConfiguration } from '@/lib/theme-config';

interface TemplateParams {
  businessName: string;
  businessType: string;
  brandColors: {
    primary: string;
    background: string;
    accent: string;
  };
  merchant: Record<string, unknown>;
}

const aiContentSchema = z.object({
  hero: z
    .array(
      z.object({
        title: z.string(),
        subtitle: z.string(),
      })
    )
    .length(3),
  features: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        icon: z.string(),
      })
    )
    .length(3),
});

type AIContent = z.infer<typeof aiContentSchema>;
type PuckBlock = Data['content'][number];

async function generateAIContent(
  businessName: string,
  businessType: string
): Promise<AIContent | null> {
  try {
    const { object } = await generateObject({
      model: activeTextModel,
      schema: aiContentSchema,
      prompt: `Generate 3 hero carousel slides (title, subtitle) and 3 unique features (title, description, icon name from lucide-react) for a "${businessType}" business named "${businessName}". 
      The tone should be professional, engaging, and specific to the industry.
      For the icon, use only valid kebab-case Lucide icon names (e.g., 'shopping-bag', 'star', 'truck', 'shield-check').`,
    });
    return object;
  } catch (error) {
    console.error('AI Content Generation Failed:', error);
    return null;
  }
}

/**
 * Generate hero carousel slides based on business type
 * Now uses AI-generated images from the database
 */
export async function generateHeroSlides(
  businessName: string,
  businessType: string,
  heroImageIds?: string[],
  aiContent?: AIContent['hero']
) {
  // Fallback images if AI generation is not available yet
  const fallbackImages = [
    {
      imageUrl: '/placeholder.png',
    },
    {
      imageUrl: '/placeholder.png',
    },
    {
      imageUrl: '/placeholder.png',
    },
  ];

  let imagesForSlides = [
    PlaceHolderImages[0] || fallbackImages[0],
    PlaceHolderImages[1] || fallbackImages[1],
    PlaceHolderImages[2] || fallbackImages[2],
  ];

  // If merchant has AI-generated hero images, use those instead
  if (heroImageIds && heroImageIds.length > 0) {
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const supabase = createClient(cookieStore);

      const { data: heroImages, error } = await supabase
        .from('ai_hero_images')
        .select('image_url')
        .in('id', heroImageIds)
        .limit(3);

      if (!error && heroImages && heroImages.length > 0) {
        imagesForSlides = heroImages.map(
          (img: { image_url: string }, index: number) => ({
            imageUrl: img.image_url,
            id: `ai-hero-${index}`,
            description: 'AI Generated Hero Image',
            imageHint: 'hero',
          })
        );
      }
    } catch (error) {
      // Fall back to placeholder images if fetch fails
      console.error('Failed to fetch hero images:', error);
    }
  }

  return imagesForSlides.map((img, i) => {
    let title = `Welcome to ${businessName}`;
    let subtitle = 'Discover our amazing collection of products.';

    if (i === 1) {
      title = 'New Arrivals';
      subtitle = 'Check out the latest trends and styles.';
    } else if (i === 2) {
      title = 'Best Sellers';
      subtitle = 'Shop our most popular items.';
    }

    // Customize text based on business type
    switch (normalizeBusinessType(businessType)) {
      case 'fashion':
        if (i === 0) subtitle = 'Discover the latest trends in fashion.';
        if (i === 1) subtitle = 'Fresh looks for the season.';
        break;
      case 'electronics':
        if (i === 0) subtitle = 'Cutting-edge technology at your fingertips.';
        if (i === 1) subtitle = 'Upgrade your gear today.';
        break;
      case 'food':
        if (i === 0) subtitle = 'Fresh flavors and quality ingredients.';
        if (i === 1) subtitle = 'Fresh ingredients, authentic recipes.';
        break;
      case 'beauty':
        if (i === 0) subtitle = 'Beauty products that bring out your best.';
        if (i === 1) subtitle = 'Clean essentials for your daily glow.';
        break;
      case 'hair':
        if (i === 0) subtitle = 'Premium hair extensions for every style.';
        if (i === 1) subtitle = 'Fresh textures, lengths, and finishes.';
        break;
      case 'home':
        if (i === 0) subtitle = 'Curated pieces for a more beautiful home.';
        if (i === 1) subtitle = 'Fresh finds for every room.';
        break;
      case 'pharmacy':
        if (i === 0) subtitle = 'Trusted healthcare essentials and supplies.';
        if (i === 1) subtitle = 'Restock wellness products with confidence.';
        break;
      case 'art':
      case 'handmade':
        if (i === 0) subtitle = 'Unique handcrafted pieces made with love.';
        if (i === 1) subtitle = 'Fresh artisan pieces from the maker.';
        if (i === 2) subtitle = 'Customer favorites with a personal touch.';
        break;
    }

    if (aiContent?.[i]) {
      title = aiContent[i].title;
      subtitle = aiContent[i].subtitle;
    }

    return {
      image: img.imageUrl,
      title,
      subtitle,
      ctaText: 'Shop Now',
      ctaLink: '#products',
    };
  });
}

/**
 * Derive a complete theme configuration from brand colors
 */
export function deriveThemeFromColors(brandColors: {
  primary: string;
  background: string;
  accent: string;
}): ThemeConfiguration {
  // Helper to get contrasting text color (simplified)
  const getContrastColor = (bgColor: string): string => {
    // Simple heuristic - in production, use proper color contrast calculation
    return bgColor === '#FFFFFF' || bgColor.toLowerCase() === '#fff'
      ? '#000000'
      : '#FFFFFF';
  };

  // Helper to darken color (simplified)
  const darken = (color: string, _percent: number = 10): string => {
    // Simplified - in production, use proper color manipulation library
    return color;
  };

  // Helper to lighten color (simplified)
  const _lighten = (color: string, _percent: number = 10): string => {
    // Simplified - in production, use proper color manipulation library
    return color;
  };

  const primaryText = getContrastColor(brandColors.primary);
  const accentText = getContrastColor(brandColors.accent);

  return {
    colors: {
      // Base colors
      primary: brandColors.primary,
      secondary: darken(brandColors.primary, 20),
      accent: brandColors.accent,
      background: brandColors.background,
      foreground: '#000000',
      muted: '#F5F5F5',
      mutedForeground: '#666666',
      border: '#E0E0E0',

      // Header colors
      header: {
        background: brandColors.background,
        text: '#000000',
        iconColor: brandColors.primary,
        searchBorder: brandColors.primary,
        searchBackground: '#FFFFFF',
      },

      // Footer colors
      footer: {
        background: brandColors.primary,
        text: primaryText,
        linkColor: primaryText,
        linkHoverColor: brandColors.accent,
      },

      // Button colors
      button: {
        primary: {
          background: brandColors.primary,
          text: primaryText,
          hover: darken(brandColors.primary, 10),
        },
        secondary: {
          background: '#F5F5F5',
          text: '#000000',
          hover: '#E0E0E0',
        },
        accent: {
          background: brandColors.accent,
          text: accentText,
          hover: darken(brandColors.accent, 10),
        },
      },

      // Card colors
      card: {
        background: '#FFFFFF',
        border: '#E0E0E0',
        text: '#000000',
      },

      // Input colors
      input: {
        background: '#FFFFFF',
        border: '#E0E0E0',
        text: '#000000',
        placeholder: '#999999',
        focusBorder: brandColors.primary,
      },
    },

    typography: {
      fontFamily: {
        heading: 'Inter, sans-serif',
        body: 'Inter, sans-serif',
        mono: 'monospace',
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '3.75rem',
      },
      fontWeight: {
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
      },
      lineHeight: {
        tight: 1.25,
        normal: 1.5,
        relaxed: 1.75,
        loose: 2.0,
      },
      letterSpacing: {
        tight: '-0.025em',
        normal: '0',
        wide: '0.025em',
      },
    },

    spacing: {
      // Global spacing scale
      xs: '0.5rem',
      sm: '0.75rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem',
      '3xl': '4rem',

      // Component-specific spacing
      header: {
        height: '4rem',
        paddingX: '1rem',
        paddingY: '0.5rem',
      },
      footer: {
        paddingY: '2rem',
        paddingX: '1rem',
      },
      section: {
        paddingY: '4rem',
        paddingX: '1rem',
      },
      container: {
        maxWidth: '1280px',
        paddingX: '1rem',
      },
    },

    borders: {
      width: {
        none: '0',
        thin: '1px',
        normal: '2px',
        thick: '4px',
      },
      radius: {
        none: '0',
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        full: '9999px',
      },
      style: {
        solid: 'solid',
        dashed: 'dashed',
        dotted: 'dotted',
      },
    },

    shadows: {
      none: 'none',
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    },

    layout: {
      breakpoints: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
      zIndex: {
        dropdown: 1000,
        sticky: 1020,
        fixed: 1030,
        modalBackdrop: 1040,
        modal: 1050,
        popover: 1060,
        tooltip: 1070,
      },
    },

    animations: {
      duration: {
        fast: '150ms',
        normal: '300ms',
        slow: '500ms',
      },
      easing: {
        linear: 'linear',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  };
}

/**
 * Generate features based on business type
 */
export function generateFeatures(
  businessType: string,
  aiFeatures?: AIContent['features']
) {
  if (aiFeatures && aiFeatures.length > 0) {
    return aiFeatures.map((f) => ({
      title: f.title,
      description: f.description,
      icon: f.icon,
    }));
  }
  const defaultFeatures = [
    {
      title: 'Fast Shipping',
      description: 'We ship worldwide with secure packaging.',
      icon: 'truck',
    },
    {
      title: '24/7 Support',
      description: 'Our team is here to help you anytime.',
      icon: 'headphones',
    },
    {
      title: 'Secure Payment',
      description: '100% secure payment processing.',
      icon: 'shield',
    },
  ];

  switch (normalizeBusinessType(businessType)) {
    case 'fashion':
      return [
        {
          title: 'Premium Quality',
          description: 'Finest materials and craftsmanship.',
          icon: 'star',
        },
        {
          title: 'Easy Returns',
          description: '30-day hassle-free return policy.',
          icon: 'refresh-cw',
        },
        {
          title: 'Secure Payment',
          description: '100% secure payment processing.',
          icon: 'shield',
        },
      ];
    case 'electronics':
      return [
        {
          title: 'Official Warranty',
          description: 'All products come with manufacturer warranty.',
          icon: 'check-circle',
        },
        {
          title: 'Expert Support',
          description: 'Technical support from our experts.',
          icon: 'headphones',
        },
        {
          title: 'Fast Delivery',
          description: 'Get your gadgets delivered quickly.',
          icon: 'truck',
        },
      ];
    case 'food':
      return [
        {
          title: 'Fresh Ingredients',
          description: 'Farm-fresh ingredients daily.',
          icon: 'leaf',
        },
        {
          title: 'Fast Delivery',
          description: 'Hot and fresh to your doorstep.',
          icon: 'truck',
        },
        {
          title: 'Best Taste',
          description: 'Award-winning recipes and flavors.',
          icon: 'heart',
        },
      ];
    case 'beauty':
      return [
        {
          title: 'Ingredient Focused',
          description: 'Carefully selected products for your routine.',
          icon: 'sparkles',
        },
        {
          title: 'Personal Care Support',
          description: 'Guidance for beauty and wellness essentials.',
          icon: 'heart',
        },
        {
          title: 'Secure Checkout',
          description: 'Safe payment processing for every order.',
          icon: 'shield',
        },
      ];
    case 'hair':
      return [
        {
          title: 'Premium Textures',
          description: 'Quality hair selected for softness and longevity.',
          icon: 'sparkles',
        },
        {
          title: 'Style Guidance',
          description: 'Find the right length, texture, and finish.',
          icon: 'scissors',
        },
        {
          title: 'Fast Delivery',
          description: 'Get your hair essentials delivered quickly.',
          icon: 'truck',
        },
      ];
    case 'home':
      return [
        {
          title: 'Curated Style',
          description: 'Thoughtful pieces for beautiful everyday spaces.',
          icon: 'home',
        },
        {
          title: 'Quality Materials',
          description: 'Durable finishes selected for real homes.',
          icon: 'star',
        },
        {
          title: 'Secure Delivery',
          description: 'Careful packaging for home and decor orders.',
          icon: 'truck',
        },
      ];
    case 'pharmacy':
      return [
        {
          title: 'Trusted Products',
          description: 'Healthcare essentials sourced with care.',
          icon: 'shield-check',
        },
        {
          title: 'Clear Guidance',
          description: 'Helpful product details for safer decisions.',
          icon: 'clipboard-check',
        },
        {
          title: 'Reliable Fulfilment',
          description: 'Secure handling for medical and wellness orders.',
          icon: 'truck',
        },
      ];
    case 'art':
    case 'handmade':
      return [
        {
          title: 'Unique Handmade',
          description: 'One-of-a-kind products crafted with care.',
          icon: 'palette',
        },
        {
          title: 'Maker Story',
          description: 'Every piece carries a personal creative touch.',
          icon: 'heart',
        },
        {
          title: 'Careful Packaging',
          description: 'Handmade orders packed safely for delivery.',
          icon: 'package-check',
        },
      ];
    default:
      return defaultFeatures;
  }
}

/**
 * Generate initial Puck template for a new merchant
 */
export async function generateInitialTemplate(
  params: TemplateParams
): Promise<Data> {
  const { businessName, businessType, brandColors, merchant } = params;
  const profile = getInitialTemplateProfile(businessType);

  // Generate theme from brand colors
  const theme = deriveThemeFromColors(brandColors);

  // Get hero image IDs from merchant if available
  const heroImageIds = (merchant?.hero_image_ids as string[]) || undefined;

  // Generate AI Content (Parallelize or do before? Doing it here async)
  // We accept failure (returns null) so it falls back to static text.
  const aiContent = await generateAIContent(businessName, businessType);

  // Generate hero slides (now async to fetch AI images)
  const slides = await generateHeroSlides(
    businessName,
    businessType,
    heroImageIds,
    aiContent?.hero
  );

  // Generate features
  const features = generateFeatures(businessType, aiContent?.features);

  // Generate unique IDs for components
  const headerId = `Header-${Date.now()}`;
  const heroCarouselId = `HeroCarousel-${Date.now()}-1`;
  const storyId = `Text-${Date.now()}-2`;
  const featuresId = `Features-${Date.now()}-3`;
  const productGridId = `ProductGrid-${Date.now()}-4`;
  const newsletterId = `Newsletter-${Date.now()}-5`;
  const footerId = `Footer-${Date.now()}-6`;

  const headerBlock: PuckBlock = {
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
        { label: profile.shopNavLabel, url: '/products' },
        { label: 'About', url: '/about' },
      ],
      ctaButton: {
        show: false,
        text: 'Get Started',
        url: '/signup',
      },
      storeName: businessName,
      // Add logo URL if merchant has one
      ...(typeof params.merchant?.logo_url === 'string'
        ? {
            logoUrl: params.merchant.logo_url,
          }
        : {}),
    },
  };

  const heroBlock: PuckBlock = {
    type: 'HeroCarousel',
    props: {
      id: heroCarouselId,
      slides: slides,
      autoplayDelay: 5000,
    },
  };

  const storyBlock: PuckBlock = {
    type: 'Text',
    props: {
      id: storyId,
      title: profile.storyTitle,
      content: profile.storyContent,
      align: profile.storyAlign,
    },
  };

  const featuresBlock: PuckBlock = {
    type: 'Features',
    props: {
      id: featuresId,
      title: profile.featuresTitle,
      features: features,
      columns: 3,
    },
  };

  const productGridBlock: PuckBlock = {
    type: 'ProductGrid',
    props: {
      id: productGridId,
      title: profile.productGridTitle,
      columns: profile.productGridColumns,
      limit: profile.productGridLimit,
      sortBy: 'newest',
      showFilters: true,
    },
  };

  const newsletterBlock: PuckBlock = {
    type: 'Newsletter',
    props: {
      id: newsletterId,
      title: profile.newsletterTitle,
      description: profile.newsletterDescription,
      buttonText: 'Subscribe',
      placeholder: 'Enter your email',
    },
  };

  const footerBlock: PuckBlock = {
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
  };

  const sectionBlocks: Record<TemplateSection, PuckBlock> = {
    hero: heroBlock,
    story: storyBlock,
    features: featuresBlock,
    products: productGridBlock,
    newsletter: newsletterBlock,
  };

  // Create Puck data structure
  const config: Data = {
    content: [
      headerBlock,
      ...profile.contentOrder.map((section) => sectionBlocks[section]),
      footerBlock,
    ],
    root: {
      props: {
        title: 'Home',
      },
    },
    zones: {},
  };

  // Add theme to config (cast to Record since theme isn't in official Data type)
  (config as Record<string, unknown>).theme = theme;

  return config;
}
