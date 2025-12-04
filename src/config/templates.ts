import type { Data } from '@measured/puck';

export interface Template {
  id: string;
  name: string;
  description: string;
  isPremium: boolean;
  previewImage?: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'modern-minimal',
    name: 'Modern Minimal',
    description: 'Clean and simple design for modern brands.',
    isPremium: false,
    previewImage:
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1000&auto=format&fit=crop',
  },
  {
    id: 'bold-vibrant',
    name: 'Bold & Vibrant',
    description: 'Stand out with bold colors and large typography.',
    isPremium: true,
    previewImage:
      'https://images.unsplash.com/photo-1556906781-9a412961c28c?q=80&w=1000&auto=format&fit=crop',
  },
  {
    id: 'classic-elegant',
    name: 'Classic Elegant',
    description: 'Timeless design with serif fonts and subtle details.',
    isPremium: true,
    previewImage:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1000&auto=format&fit=crop',
  },
  {
    id: 'ogabassey',
    name: 'Ogabassey',
    description: 'Custom template for Ogabassey Gadgets.',
    isPremium: true,
    previewImage:
      'https://images.unsplash.com/photo-1696446701796-da61225697cc?q=80&w=1000&auto=format&fit=crop',
  },
];

export const getTemplateData = (
  businessName: string
): Record<string, Data> => ({
  'modern-minimal': {
    root: { title: 'Modern Minimal Store' },
    content: [
      {
        type: 'Header',
        props: {
          showLogo: true,
          showSearch: true,
          showCart: true,
          showMenu: true,
          navigationLinks: [
            { label: 'Shop', url: '/shop' },
            { label: 'About', url: '/about' },
            { label: 'Contact', url: '/contact' },
          ],
          layout: 'logo-left-nav-right',
          searchStyle: 'minimal',
          id: 'header',
        },
      },
      {
        type: 'Hero',
        props: {
          title: 'Less is More',
          subtitle:
            'Discover our curated collection of minimalist essentials designed for modern living.',
          ctaText: 'Shop Now',
          ctaLink: '/shop',
          align: 'left',
          padding: 'large',
          backgroundImage:
            'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1000&auto=format&fit=crop',
          overlay: true,
          id: 'hero',
        },
      },
      {
        type: 'Spacer',
        props: { height: 'medium', id: 'spacer-1' },
      },
      {
        type: 'ProductGrid',
        props: {
          title: 'New Arrivals',
          columns: 4,
          limit: 8,
          showFilters: false,
          id: 'products',
        },
      },
      {
        type: 'Newsletter',
        props: {
          title: 'Join Our Newsletter',
          description:
            'Subscribe to get special offers, free giveaways, and once-in-a-lifetime deals.',
          buttonText: 'Subscribe',
          placeholder: 'Enter your email',
          id: 'newsletter',
        },
      },
      {
        type: 'Footer',
        props: {
          copyrightText: `© ${new Date().getFullYear()} Modern Brand. All rights reserved.`,
          showQuickLinks: true,
          quickLinks: [
            { label: 'Terms', url: '/terms' },
            { label: 'Privacy', url: '/privacy' },
          ],
          socialLinks: {
            instagram: 'https://instagram.com',
          },
          showNewsletter: false,
          backgroundColor: '#ffffff',
          textColor: '#000000',
          id: 'footer',
        },
      },
    ],
  },
  'bold-vibrant': {
    root: { title: 'Bold & Vibrant Store' },
    content: [
      {
        type: 'Header',
        props: {
          showLogo: true,
          showSearch: true,
          showCart: true,
          showMenu: true,
          navigationLinks: [
            { label: 'New', url: '/new' },
            { label: 'Sale', url: '/sale' },
            { label: 'Collections', url: '/collections' },
          ],
          layout: 'logo-center',
          searchStyle: 'filled',
          searchRadius: 'full',
          backgroundColor: '#FFD700',
          textColor: '#000000',
          id: 'header',
        },
      },
      {
        type: 'HeroCarousel',
        props: {
          slides: [
            {
              image:
                'https://images.unsplash.com/photo-1556906781-9a412961c28c?q=80&w=1000&auto=format&fit=crop',
              title: 'Summer Collection',
              subtitle: 'Bright colors for sunny days.',
              ctaText: 'View Collection',
              ctaLink: '/summer',
            },
            {
              image:
                'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1000&auto=format&fit=crop',
              title: 'New Trends',
              subtitle: 'Be the first to wear the latest styles.',
              ctaText: 'Shop Trends',
              ctaLink: '/trends',
            },
          ],
          autoplayDelay: 4000,
          id: 'hero-carousel',
        },
      },
      {
        type: 'Features',
        props: {
          title: 'Why Choose Us?',
          subtitle: 'We bring color to your life.',
          features: [
            {
              title: 'Fast Shipping',
              description: 'Get your order in 2 days.',
              icon: 'truck',
            },
            {
              title: 'Bold Designs',
              description: 'Stand out from the crowd.',
              icon: 'star',
            },
            {
              title: 'Premium Quality',
              description: 'Materials that last.',
              icon: 'shield',
            },
          ],
          columns: 3,
          id: 'features',
        },
      },
      {
        type: 'Testimonial',
        props: {
          quote:
            'I absolutely love the vibrant colors! The quality is amazing and I get so many compliments.',
          author: 'Sarah J.',
          role: 'Verified Buyer',
          rating: 5,
          id: 'testimonial',
        },
      },
      {
        type: 'Footer',
        props: {
          copyrightText: `© ${new Date().getFullYear()} Bold Brand.`,
          showQuickLinks: true,
          quickLinks: [
            { label: 'FAQ', url: '/faq' },
            { label: 'Returns', url: '/returns' },
          ],
          socialLinks: {
            instagram: 'https://instagram.com',
            tiktok: 'https://tiktok.com',
          },
          showNewsletter: true,
          backgroundColor: '#000000',
          textColor: '#FFD700',
          id: 'footer',
        },
      },
    ],
  },
  'classic-elegant': {
    root: { title: 'Classic Elegant Store' },
    content: [
      {
        type: 'Header',
        props: {
          showLogo: true,
          showSearch: false,
          showCart: true,
          showMenu: true,
          navigationLinks: [
            { label: 'Home', url: '/' },
            { label: 'Catalog', url: '/catalog' },
            { label: 'Our Story', url: '/story' },
          ],
          layout: 'logo-center',
          paddingY: 'lg',
          id: 'header',
        },
      },
      {
        type: 'Hero',
        props: {
          title: 'Timeless Elegance',
          subtitle: 'Sophisticated styles for the discerning individual.',
          ctaText: 'Explore',
          ctaLink: '/catalog',
          align: 'center',
          padding: 'large',
          backgroundImage:
            'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1000&auto=format&fit=crop',
          overlay: true,
          id: 'hero',
        },
      },
      {
        type: 'AboutSection',
        props: {
          title: 'Our Heritage',
          content:
            'Founded in 1990, we have been dedicated to crafting the finest quality goods. Our commitment to excellence is evident in every stitch and detail.',
          image:
            'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=1000&auto=format&fit=crop',
          imagePosition: 'right',
          showStats: true,
          stats: [
            { value: '30+', label: 'Years of Excellence' },
            { value: '50k+', label: 'Happy Customers' },
          ],
          id: 'about',
        },
      },
      {
        type: 'TrustBadges',
        props: {
          badges: [
            {
              icon: 'shield',
              title: 'Secure Payment',
              description: 'Encrypted transactions',
            },
            {
              icon: 'award',
              title: 'Quality Guarantee',
              description: '30-day money back',
            },
            {
              icon: 'truck',
              title: 'Free Shipping',
              description: 'On orders over $100',
            },
          ],
          layout: 'horizontal',
          style: 'minimal',
          id: 'trust-badges',
        },
      },
      {
        type: 'Footer',
        props: {
          copyrightText: `© ${new Date().getFullYear()} Elegant Brand.`,
          showQuickLinks: true,
          quickLinks: [
            { label: 'Customer Care', url: '/care' },
            { label: 'Shipping', url: '/shipping' },
          ],
          socialLinks: {
            facebook: 'https://facebook.com',
            linkedin: 'https://linkedin.com',
          },
          showNewsletter: true,
          backgroundColor: '#1a1a1a',
          textColor: '#e5e5e5',
          id: 'footer',
        },
      },
    ],
  },
  ogabassey: {
    root: { title: 'Ogabassey Store' },
    content: [
      {
        type: 'OgabasseyHeader',
        props: {
          logoText: businessName || 'Ogabassey',
          showSearch: true,
          showCart: true,
          showUser: true,
          showBell: true,
          id: 'header',
        },
      },
      {
        type: 'OgabasseyHero',
        props: {
          slides: [
            {
              image:
                'https://images.unsplash.com/photo-1696446701796-da61225697cc?q=80&w=1000&auto=format&fit=crop',
              title: 'iPhone 16 Pro Max',
              link: '#iphone',
            },
            {
              image:
                'https://images.unsplash.com/photo-1517336714731-489689fd1ca4?q=80&w=1000&auto=format&fit=crop',
              title: 'MacBook Pro',
              link: '#macbook',
            },
            {
              image:
                'https://images.unsplash.com/photo-1606318801954-d46d46d3360a?q=80&w=1000&auto=format&fit=crop',
              title: 'PS5 Pro Edition',
              link: '#ps5',
            },
          ],
          autoplayDelay: 5000,
          id: 'hero',
        },
      },
      {
        type: 'OgabasseyCategories',
        props: {
          categories: [
            { label: 'Phones', icon: 'smartphone', link: '#phones' },
            { label: 'Gaming', icon: 'gamepad', link: '#gaming' },
            { label: 'Accessories', icon: 'headphones', link: '#accessories' },
            { label: 'Printers', icon: 'printer', link: '#printers' },
            { label: 'Laptop', icon: 'laptop', link: '#laptops' },
          ],
          backgroundColor: '#FEF2F2',
          iconColor: '#DC2626',
          id: 'categories',
        },
      },
      {
        type: 'ProductGrid',
        props: {
          title: 'Featured Products',
          columns: 4,
          limit: 8,
          showFilters: true,
          id: 'products',
        },
      },
      {
        type: 'Footer',
        props: {
          copyrightText: `© ${new Date().getFullYear()} ${businessName || 'Ogabassey'}. All rights reserved.`,
          showQuickLinks: true,
          quickLinks: [
            { label: 'About Us', url: '/about' },
            { label: 'Contact', url: '/contact' },
            { label: 'Privacy Policy', url: '/privacy' },
          ],
          socialLinks: {
            facebook: 'https://facebook.com',
            instagram: 'https://instagram.com',
            twitter: 'https://twitter.com',
          },
          showNewsletter: true,
          backgroundColor: '#000000',
          textColor: '#FFFFFF',
          id: 'footer',
        },
      },
    ],
  },
});
