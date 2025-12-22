import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const storeUrl = `${protocol}://${host}`;

  // Protected paths that should not be crawled
  const disallowedPaths = [
    '/dashboard/',
    '/onboarding/',
    '/_storefront/',
    '/api/',
    '/checkout/',
    '/reset-password/',
    '/auth/',
    '/_next/', // Prevent Next.js static assets from being indexed (Soft 404 fix)
  ];

  return {
    rules: [
      // Default rules for all crawlers
      {
        userAgent: '*',
        allow: '/',
        disallow: disallowedPaths,
      },
      // OpenAI ChatGPT Search Bot - allow for AI search visibility
      {
        userAgent: 'OAI-SearchBot',
        allow: '/',
        disallow: disallowedPaths,
      },
      // OpenAI ChatGPT User Agent - allow for real-time queries
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
        disallow: disallowedPaths,
      },
      // OpenAI GPTBot - allow for training (opt-in)
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: disallowedPaths,
      },
      // Anthropic Claude Bot
      {
        userAgent: 'ClaudeBot',
        allow: '/',
        disallow: disallowedPaths,
      },
      // Anthropic Claude Web
      {
        userAgent: 'anthropic-ai',
        allow: '/',
        disallow: disallowedPaths,
      },
      // Google Gemini / Bard
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: disallowedPaths,
      },
      // Perplexity AI
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: disallowedPaths,
      },
      // Cohere AI
      {
        userAgent: 'cohere-ai',
        allow: '/',
        disallow: disallowedPaths,
      },
      // Meta AI
      {
        userAgent: 'FacebookBot',
        allow: '/',
        disallow: disallowedPaths,
      },
      // Common AI research crawlers
      {
        userAgent: 'CCBot',
        allow: '/',
        disallow: disallowedPaths,
      },
    ],
    sitemap: `${storeUrl}/sitemap.xml`,
  };
}
