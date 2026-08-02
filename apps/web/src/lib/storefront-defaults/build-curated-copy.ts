import { normalizeBusinessType } from '@/lib/initial-template-profiles';

export function buildCuratedCopy(input: {
  businessName: string;
  businessType: string;
  country: string;
}) {
  const name = input.businessName.trim() || 'Your Store';
  const category = normalizeBusinessType(input.businessType);
  const subject =
    category === 'fashion'
      ? 'styles'
      : category === 'food'
        ? 'menu items'
        : category === 'electronics'
          ? 'devices'
          : category === 'pharmacy'
            ? 'health products'
            : 'products';
  const shopLabel =
    category === 'fashion'
      ? 'Collections'
      : category === 'food'
        ? 'Menu'
        : category === 'electronics'
          ? 'Gadgets'
          : category === 'pharmacy'
            ? 'Health Store'
            : 'Shop';
  return {
    header: {
      navigationLinks: [
        { label: 'Home', url: '/' },
        { label: shopLabel, url: '/products' },
        { label: 'About', url: '/about' },
      ],
      ctaButton: { show: false, text: 'Get Started', url: '/signup' },
    },
    hero: {
      title: `Explore ${subject} from ${name}`,
      subtitle: `Browse ${subject} from ${name}.`,
      ctaText: 'Explore products',
      ctaLink: '#products',
    },
    story: {
      title: `About ${name}`,
      content: `Explore ${subject} from ${name}.`,
    },
    features: {
      title: `Browse ${subject}`,
      items: [
        {
          title: 'Browse',
          description: 'Find products that suit your needs.',
          icon: 'search',
        },
        {
          title: 'Discover',
          description: 'See the available collection.',
          icon: 'sparkles',
        },
        {
          title: 'Choose',
          description: 'Review products before ordering.',
          icon: 'shopping-bag',
        },
      ],
    },
    products: { title: 'Explore products' },
    newsletter: {
      title: `Updates from ${name}`,
      description: `Receive updates from ${name}.`,
      buttonText: 'Subscribe',
      placeholder: 'Enter your email',
    },
    footer: {
      quickLinks: [
        { label: 'About Us', url: '/about' },
        { label: 'Contact', url: '/contact' },
        { label: 'Privacy Policy', url: '/privacy' },
        { label: 'Terms', url: '/terms' },
      ],
    },
  };
}
