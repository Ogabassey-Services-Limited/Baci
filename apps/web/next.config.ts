import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
});

const nextConfig: NextConfig = {
  // Enable React Compiler for automatic memoization (Next.js 16 stable)
  // Reduces unnecessary re-renders without manual useMemo/useCallback
  reactCompiler: true,

  // Enable source maps in production for better debugging and Lighthouse scores
  // Note: Increases build size slightly but helps with error tracking
  productionBrowserSourceMaps: true,

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
    // SRI (Subresource Integrity) temporarily disabled
    // Causes ENOENT subresource-integrity-manifest.json in Vercel CLI deploys
    // Re-enable when Vercel monorepo support for SRI is stable
    // sri: {
    //   algorithm: 'sha256',
    // },

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

  // SEO redirects - flat URL structure for legal pages + legacy WordPress URLs
  redirects() {
    return Promise.resolve([
      // === SEO-FRIENDLY LEGAL PAGE REDIRECTS ===
      // Redirect old /pages/* URLs to new flat structure
      {
        source: '/:slug/pages/terms',
        destination: '/:slug/terms',
        permanent: true, // 301 redirect
      },
      {
        source: '/:slug/pages/privacy',
        destination: '/:slug/privacy',
        permanent: true,
      },
      {
        source: '/:slug/pages/about',
        destination: '/:slug/about',
        permanent: true,
      },
      {
        source: '/:slug/pages/faq',
        destination: '/:slug/faq',
        permanent: true,
      },
      {
        source: '/:slug/pages/contact',
        destination: '/:slug/contact',
        permanent: true,
      },
      // Redirect legacy verbose URLs to short versions
      {
        source: '/:slug/terms-of-service',
        destination: '/:slug/terms',
        permanent: true,
      },
      {
        source: '/:slug/privacy-policy',
        destination: '/:slug/privacy',
        permanent: true,
      },
      // === CONTENT REDIRECTS (Ahrefs Fixes) ===
      // Renamed blog posts
      {
        source: '/blog/iphone-xr-in-2025-is-this-still-a-good-deal',
        destination: '/blog/moving-on-from-iphone-xr-in-2025-heres-what-to-buy-next',
        permanent: true,
      },
      {
        source: '/blog/why-the-samsung-galaxy-s21-ultra-is-still-a-top-pick-in-2024',
        destination: '/blog/samsung-galaxy-s21-ultra-in-2025-powerful-enough-or-just-hanging-on',
        permanent: true,
      },
      // Fix specific product suffix issues
      {
        source: '/phones/iphone-x-3gb-64gb-nfid',
        destination: '/phones/iphone-x-3gb-64gb',
        permanent: true,
      },
      // === CATEGORY REDIRECTS (Meta Refresh Fix) ===
      // Redirect legacy category paths to canonical URLs (scoped to ogabassey.com)
      {
        source: '/macbook',
        destination: '/laptops',
        permanent: true,
        has: [{ type: 'host', value: 'ogabassey.com' }],
      },
      {
        source: '/macbook/:path*',
        destination: '/laptops/:path*',
        permanent: true,
        has: [{ type: 'host', value: 'ogabassey.com' }],
      },
      {
        source: '/samsung',
        destination: '/smartphones',
        permanent: true,
        has: [{ type: 'host', value: 'ogabassey.com' }],
      },
      {
        source: '/samsung/:path*',
        destination: '/smartphones/:path*',
        permanent: true,
        has: [{ type: 'host', value: 'ogabassey.com' }],
      },
      {
        source: '/phones',
        destination: '/smartphones',
        permanent: true,
        has: [{ type: 'host', value: 'ogabassey.com' }],
      },
      {
        source: '/phones/:path*',
        destination: '/smartphones/:path*',
        permanent: true,
        has: [{ type: 'host', value: 'ogabassey.com' }],
      },
      {
        source: '/oppo',
        destination: '/oppo-phones',
        permanent: true,
        has: [{ type: 'host', value: 'ogabassey.com' }],
      },
      {
        source: '/oppo/:path*',
        destination: '/oppo-phones/:path*',
        permanent: true,
        has: [{ type: 'host', value: 'ogabassey.com' }],
      },

      // === LEGACY WORDPRESS URL REDIRECTS (GSC Fix) ===
      // /user/* paths - redirect to homepage
      {
        source: '/user/:path*',
        destination: '/',
        permanent: true,
      },
      // /home/* paths - redirect to homepage
      {
        source: '/home/:path*',
        destination: '/',
        permanent: true,
      },
      // /product-category/* - redirect to products
      {
        source: '/product-category/:path*',
        destination: '/ogabassey/products',
        permanent: true,
      },
      // /category/product/:id - legacy product URLs
      {
        source: '/category/product/:id',
        destination: '/ogabassey/products',
        permanent: true,
      },
    ]);
  },

  // Proxy MCP requests to VPS (only if MCP_SERVER_URL is configured)
  async rewrites() {
    const mcpServerUrl = process.env.MCP_SERVER_URL;
    if (!mcpServerUrl) {
      return [];
    }
    return [
      {
        source: '/mcp/sse',
        destination: `${mcpServerUrl}/sse`,
      },
      {
        source: '/mcp/messages',
        destination: `${mcpServerUrl}/messages`,
      },
    ];
  },

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
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
