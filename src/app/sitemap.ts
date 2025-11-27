import { MetadataRoute } from 'next'

/**
 * Main site sitemap for usebaci.com
 *
 * This sitemap covers the platform's own pages.
 * Each merchant storefront has its own dynamic sitemap at:
 * - ogabassey.usebaci.com/sitemap.xml
 * - Or via path: usebaci.com/ogabassey/sitemap.xml
 */

// Define your site pages - update this when you add new pages
const SITE_PAGES = [
  { path: '/', changeFreq: 'weekly' as const, priority: 1.0 },
  { path: '/onboarding', changeFreq: 'monthly' as const, priority: 0.8 },
  { path: '/login', changeFreq: 'monthly' as const, priority: 0.5 },
  // Add more pages as you create them:
  // { path: '/pricing', changeFreq: 'weekly' as const, priority: 0.9 },
  // { path: '/features', changeFreq: 'monthly' as const, priority: 0.8 },
  // { path: '/blog', changeFreq: 'daily' as const, priority: 0.7 },
  // { path: '/help', changeFreq: 'weekly' as const, priority: 0.6 },
  // { path: '/terms', changeFreq: 'yearly' as const, priority: 0.3 },
  // { path: '/privacy', changeFreq: 'yearly' as const, priority: 0.3 },
]

/**
 * Builds sitemap entries for the site from the SITE_PAGES configuration.
 *
 * The base URL uses NEXT_PUBLIC_ROOT_DOMAIN (prefixed with `https://`) when set, otherwise `http://localhost:3000`.
 *
 * @returns An array of sitemap entries, each with `url`, `lastModified`, `changeFrequency`, and `priority`.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_ROOT_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`
    : 'http://localhost:3000';

  return SITE_PAGES.map(page => ({
    url: `${siteUrl}${page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFreq,
    priority: page.priority,
  }));
}