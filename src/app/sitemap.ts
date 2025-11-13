import { MetadataRoute } from 'next'

// Mock product data - in a real app, this would come from your database
const products = [
    { id: 'p1' },
    { id: 'p2' },
    { id: 'p5' },
];
 
export default function sitemap(): MetadataRoute.Sitemap {
  const storeUrl = process.env.NEXT_PUBLIC_ROOT_DOMAIN ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}` : 'http://localhost:3000';

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${storeUrl}/product/${product.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    {
      url: storeUrl,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    {
      url: `${storeUrl}/onboarding`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${storeUrl}/dashboard`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    ...productEntries,
  ]
}
