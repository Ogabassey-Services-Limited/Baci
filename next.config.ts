import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';
import { STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX } from './apps/web/src/config/storefront-metadata-cache-bots';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
});

const nextConfig: NextConfig = {
  // Enable React Compiler for automatic memoization (Next.js 16 stable)
  // Reduces unnecessary re-renders without manual useMemo/useCallback
  reactCompiler: true,

  // Fix Vercel middleware tracing issue with Next.js 16
  // See: https://github.com/vercel/next.js/issues/71818
  outputFileTracingIncludes: {
    '/middleware': ['./node_modules/@supabase/**/*'],
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'loremflickr.com',
      },
      {
        // Placeholder images for development/previews
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        // Placeholder images for development/previews
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'cloudflare-ipfs.com',
      },
      {
        protocol: 'https',
        hostname: 'd1csarkz8obe9u.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: 'cdn.ogabassey.com',
      },
      {
        protocol: 'https',
        hostname: 'ogabassey.com',
      },
      {
        // Supabase storage for merchant images
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        // Google static content (logos, icons)
        protocol: 'https',
        hostname: 'www.gstatic.com',
      },
      {
        // Apple CDN for product images (store previews)
        protocol: 'https',
        hostname: 'store.storeimages.cdn-apple.com',
      },
      {
        // Common data storage (sample videos)
        protocol: 'https',
        hostname: 'commondatastorage.googleapis.com',
      },
      {
        // GSMArena CDN for device/phone images
        protocol: 'https',
        hostname: 'fdn.gsmarena.com',
      },
      {
        // GSMArena CDN for device/phone images
        protocol: 'https',
        hostname: 'fdn2.gsmarena.com',
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Optimize image formats - AVIF is 20% smaller than WebP
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images (Next.js 16 default is 4 hours / 14400s)
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },

  experimental: {
    // Inline CSS to eliminate render-blocking CSS requests
    // Replaces <link> tags with <style> tags for faster FCP/LCP
    inlineCss: true,

    // Note: optimizeCss is disabled as it relies on Critters and is
    // incompatible with App Router streaming. Use stable CSS pipeline instead.

    // Server Actions configuration
    serverActions: {
      bodySizeLimit: '2mb',
    },

    // Enable View Transitions API (React 19.2 feature)
    viewTransition: true,

    // Note: 'use cache' directive (cacheComponents) is not enabled because it's
    // incompatible with existing route segment configs (revalidate, dynamic).
    // Using unstable_cache from next/cache for granular caching instead.
    // Enable cacheComponents once all routes are migrated.
    // cacheComponents: true,

    // Bundle optimization - tree-shake large libraries
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'date-fns',
      'framer-motion',
      '@radix-ui/react-icons',
      'lodash-es',
      '@supabase/supabase-js',
    ],

    // Enable Turbopack file system caching for faster dev rebuilds (Next.js 16)
    // This caches compilation results to disk, dramatically reducing rebuild times
    // TEMPORARILY DISABLED: Investigating stability issues
    // turbopackFileSystemCacheForDev: true,
  },

  // Enable typed routes for compile-time validation of Link hrefs
  typedRoutes: true,

  // Keep this exact matcher in sync with proxy cache bucketing. If Next streams
  // metadata for a UA that the proxy buckets as metadata-blocking, Vercel can
  // replay a cached shell into the wrong route slot and trigger resume mismatch.
  htmlLimitedBots: STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX,

  // Security headers
  headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
