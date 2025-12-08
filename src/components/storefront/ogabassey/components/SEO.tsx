'use client';
// Migrated from temp-source/components/SEO.tsx
import type React from 'react';
import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
  // Product specific
  price?: number;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  brand?: string;
  rating?: number;
  reviewCount?: number;
}

export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  image,
  url, // = window.location.href, // Removed window access for SSR safety
  type = 'website',
  price,
  currency = 'NGN',
  availability = 'InStock',
  brand,
  rating,
  reviewCount,
}) => {
  useEffect(() => {
    // 1. Update Title
    document.title = `${title} | Ogabassey`;

    // 2. Update Meta Tags Helpers
    const setMeta = (name: string, content: string) => {
      let element = document.querySelector(`meta[name="${name}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('name', name);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    const setOg = (property: string, content: string) => {
      let element = document.querySelector(`meta[property="${property}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('property', property);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 3. Set Standard Meta
    setMeta('description', description);

    // 4. Set Open Graph / Facebook / WhatsApp
    setOg('og:title', title);
    setOg('og:description', description);
    setOg('og:type', type);
    // setOg('og:url', url); // Skip URL if undefined to avoid issues
    if (url) setOg('og:url', url);
    if (image) setOg('og:image', image);
    setOg('og:site_name', 'Ogabassey');

    // 5. Set Twitter
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    if (image) setMeta('twitter:image', image);

    // 6. JSON-LD Structured Data (Rich Snippets)
    let schemaData = null;

    if (type === 'product') {
      schemaData = {
        '@context': 'https://schema.org/',
        '@type': 'Product',
        name: title,
        image: image ? [image] : [],
        description: description,
        brand: {
          '@type': 'Brand',
          name: brand || 'Ogabassey',
        },
        offers: {
          '@type': 'Offer',
          url: url,
          priceCurrency: currency,
          price: price,
          availability: `https://schema.org/${availability}`,
          itemCondition: 'https://schema.org/NewCondition',
        },
      };

      if (rating && reviewCount) {
        schemaData = {
          ...schemaData,
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: rating,
            reviewCount: reviewCount,
            bestRating: '5',
            worstRating: '1',
          },
        };
      }
    }

    // Inject JSON-LD
    if (schemaData) {
      let script = document.querySelector('#seo-schema');
      if (!script) {
        script = document.createElement('script');
        script.id = 'seo-schema';
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(schemaData);
    }

    return () => {
      // Cleanup logic if needed
    };
  }, [
    title,
    description,
    image,
    url,
    type,
    price,
    currency,
    availability,
    brand,
    rating,
    reviewCount,
  ]);

  return null;
};
