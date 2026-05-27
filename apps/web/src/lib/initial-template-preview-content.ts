import { normalizeBusinessType } from '@/lib/initial-template-profiles';
import { PlaceHolderImages } from '@/lib/placeholder-images';

type HeroAiContent = Array<{ title: string; subtitle: string }>;
type FeatureAiContent = Array<{
  title: string;
  description: string;
  icon: string;
}>;

type Feature = {
  title: string;
  description: string;
  icon: string;
};

type PreviewBusinessCategory =
  | 'fashion'
  | 'electronics'
  | 'food'
  | 'beauty'
  | 'hair'
  | 'home'
  | 'pharmacy'
  | 'handmade'
  | 'art';

type SlideCopy = [string, string, string?];

const DEFAULT_FEATURES: Feature[] = [
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

const HANDMADE_FEATURES: Feature[] = [
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

const FEATURE_COPY: Record<PreviewBusinessCategory, Feature[]> = {
  fashion: [
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
  ],
  electronics: [
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
  ],
  food: [
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
  ],
  beauty: [
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
  ],
  hair: [
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
  ],
  home: [
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
  ],
  pharmacy: [
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
  ],
  handmade: HANDMADE_FEATURES,
  art: HANDMADE_FEATURES,
};

const HERO_SUBTITLES: Record<PreviewBusinessCategory, SlideCopy> = {
  fashion: [
    'Discover the latest trends in fashion.',
    'Fresh looks for the season.',
  ],
  electronics: [
    'Cutting-edge technology at your fingertips.',
    'Upgrade your gear today.',
  ],
  food: [
    'Fresh flavors and quality ingredients.',
    'Fresh ingredients, authentic recipes.',
  ],
  beauty: [
    'Beauty products that bring out your best.',
    'Clean essentials for your daily glow.',
  ],
  hair: [
    'Premium hair extensions for every style.',
    'Fresh textures, lengths, and finishes.',
  ],
  home: [
    'Curated pieces for a more beautiful home.',
    'Fresh finds for every room.',
  ],
  pharmacy: [
    'Trusted healthcare essentials and supplies.',
    'Restock wellness products with confidence.',
  ],
  handmade: [
    'Unique handcrafted pieces made with love.',
    'Fresh artisan pieces from the maker.',
    'Customer favorites with a personal touch.',
  ],
  art: [
    'Unique handcrafted pieces made with love.',
    'Fresh artisan pieces from the maker.',
    'Customer favorites with a personal touch.',
  ],
};

export function generateHeroSlides(
  businessName: string,
  businessType: string,
  aiContent?: HeroAiContent
) {
  const fallbackImages = [
    { imageUrl: '/placeholder.png' },
    { imageUrl: '/placeholder.png' },
    { imageUrl: '/placeholder.png' },
  ];
  const imagesForSlides = [
    PlaceHolderImages[0] || fallbackImages[0],
    PlaceHolderImages[1] || fallbackImages[1],
    PlaceHolderImages[2] || fallbackImages[2],
  ];
  const normalizedBusinessType = normalizeBusinessType(businessType);
  const subtitles =
    normalizedBusinessType in HERO_SUBTITLES
      ? HERO_SUBTITLES[normalizedBusinessType as PreviewBusinessCategory]
      : undefined;

  return imagesForSlides.map((img, i) => {
    const aiSlide = aiContent?.[i];
    const title =
      aiSlide?.title ||
      (i === 1
        ? 'New Arrivals'
        : i === 2
          ? 'Best Sellers'
          : `Welcome to ${businessName}`);
    const subtitle =
      aiSlide?.subtitle ||
      subtitles?.[i] ||
      (i === 1
        ? 'Check out the latest trends and styles.'
        : i === 2
          ? 'Shop our most popular items.'
          : 'Discover our amazing collection of products.');

    return {
      image: img.imageUrl,
      title,
      subtitle,
      ctaText: 'Shop Now',
      ctaLink: '#products',
    };
  });
}

export function generateFeatures(
  businessType: string,
  aiFeatures?: FeatureAiContent
) {
  if (aiFeatures && aiFeatures.length > 0) {
    return aiFeatures.map((feature) => ({
      title: feature.title,
      description: feature.description,
      icon: feature.icon,
    }));
  }

  const normalizedBusinessType = normalizeBusinessType(businessType);
  return normalizedBusinessType in FEATURE_COPY
    ? FEATURE_COPY[normalizedBusinessType as PreviewBusinessCategory]
    : DEFAULT_FEATURES;
}
