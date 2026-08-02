import { normalizeBusinessType } from '@/lib/initial-template-profiles';
import type { AiContent } from './curated-storefront-types';

type Feature = AiContent['features'][number];

const defaultFeatures: Feature[] = [
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

export function generateFeatures(
  businessType: string,
  aiFeatures?: AiContent['features']
): Feature[] {
  if (aiFeatures && aiFeatures.length > 0)
    return aiFeatures.map((feature) => ({ ...feature }));
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
