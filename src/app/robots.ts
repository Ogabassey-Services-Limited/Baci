import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  const storeUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:9002';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/onboarding/'],
    },
    sitemap: `${storeUrl}/sitemap.xml`,
  }
}
