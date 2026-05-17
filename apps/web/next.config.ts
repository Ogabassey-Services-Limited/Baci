import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
});

/**
 * Force blocking metadata rendering (no streaming) for crawlers that commonly
 * parse only static head tags in HTML. This keeps Ahrefs/Semrush audits aligned
 * with what social/search bots see.
 */
const HTML_LIMITED_BOTS_UA_RE =
  /Googlebot|Googlebot-Image|Googlebot-News|Googlebot-Video|[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|AhrefsBot|AhrefsSiteAudit|SemrushBot|MJ12bot|DotBot|rogerbot|PetalBot|Bytespider/i;

const NEXT_CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
const OGABASSEY_HERO_ASSET_DIR = path.join(
  NEXT_CONFIG_DIR,
  'src/components/storefront/ogabassey/components/assets'
);
const require = createRequire(import.meta.url);
const loaderUtils = require('next/dist/compiled/loader-utils3') as {
  interpolateName: (
    loaderContext: { resourcePath: string; resourceQuery?: string },
    name: string,
    options: { context: string; content: Buffer }
  ) => string;
};

function resolveOgabasseyMobileHeroPreloadPath() {
  let files: string[] = [];

  try {
    files = fs.readdirSync(OGABASSEY_HERO_ASSET_DIR);
  } catch {
    return null;
  }

  const mobileHeroAvif = files.find((fileName) =>
    /^iphone-17-pro-max-mobile\.[^.]+\.avif$/.test(fileName)
  );

  if (!mobileHeroAvif) {
    return null;
  }

  const mobileHeroAssetPath = path.join(
    OGABASSEY_HERO_ASSET_DIR,
    mobileHeroAvif
  );
  let content: Buffer;
  try {
    content = fs.readFileSync(mobileHeroAssetPath);
  } catch {
    return null;
  }

  const interpolatedName = loaderUtils.interpolateName(
    { resourcePath: mobileHeroAssetPath, resourceQuery: '' },
    '/static/media/[name].[hash:8].[ext]',
    {
      context: NEXT_CONFIG_DIR,
      content,
    }
  );

  return `/_next${interpolatedName}`;
}

const OGABASSEY_HOME_MOBILE_HERO_PRELOAD_PATH =
  resolveOgabasseyMobileHeroPreloadPath();
const OGABASSEY_HOME_MOBILE_HERO_LINK_PRELOAD =
  OGABASSEY_HOME_MOBILE_HERO_PRELOAD_PATH
    ? `<${OGABASSEY_HOME_MOBILE_HERO_PRELOAD_PATH}>; rel=preload; as=image; type="image/avif"; media="(max-width: 767px)"`
    : null;

const nextConfig: NextConfig = {
  // Keep heavy server-only packages external to reduce function bundle size and peak memory.
  // These are only used in specific API routes and should not be bundled into every function.
  serverExternalPackages: [
    'jspdf',
    'jspdf-autotable',
    'sharp',
    'expo-server-sdk',
  ],

  // Enable React Compiler for automatic memoization (Next.js 16 stable)
  // Reduces unnecessary re-renders without manual useMemo/useCallback
  reactCompiler: true,

  // Production source maps disabled to save ~1-2 min build time
  // Re-enable if needed for debugging: productionBrowserSourceMaps: true,
  productionBrowserSourceMaps: false,

  // Enable 'use cache' directive for Dynamic IO (Next.js 16)
  cacheComponents: true,

  // Custom cache profiles for 'use cache' + cacheLife()
  cacheLife: {
    // Merchant data: revalidate every 60s, serve stale up to 5min, expire after 1hr
    merchant: { stale: 300, revalidate: 60, expire: 3600 },
    // Product catalog: revalidate every 5min, serve stale up to 5min, expire after 24hr
    products: { stale: 300, revalidate: 300, expire: 86400 },
    // Storefront pages (terms, FAQ, about): revalidate every 5min, stale 1min, expire 1hr
    'storefront-page': { stale: 60, revalidate: 300, expire: 3600 },
    // Categories: rarely change, revalidate every 1hr, expire after 24hr
    categories: { stale: 300, revalidate: 3600, expire: 86400 },
  },

  // Fix Vercel middleware tracing issue with Next.js 16
  // See: https://github.com/vercel/next.js/issues/71818
  outputFileTracingIncludes: {
    '/middleware': ['./node_modules/@supabase/**/*'],
  },

  images: {
    // Custom loader bypasses Vercel's /_next/image proxy entirely.
    // Cloudflare WAF blocks Vercel's server-side fetches (OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAUTHORIZED).
    // Since all merchant images are pre-optimized AVIF on CDNs, re-optimization is redundant.
    // Local public assets therefore keep their direct URL instead of delegating
    // back into the default image optimizer pipeline.
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
    // Note: remotePatterns are effectively documentation here. The custom
    // loader returns final URLs directly, so Next's default optimizer and
    // its remotePatterns enforcement are not on the request path.
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
      {
        // XDA Developers images (common in blog posts)
        protocol: 'https',
        hostname: 'static0.xdaimages.com',
      },
      {
        // XDA Developers images
        protocol: 'https',
        hostname: 'www.xda-developers.com',
      },
      {
        // Placeholder images for legacy tests
        protocol: 'https',
        hostname: 'via.placeholder.com',
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

    // Keep CSS external. The inlineCss experiment inflated the streamed
    // storefront HTML/RSC payload on ogabassey.com and duplicated large
    // Tailwind/global CSS chunks in the initial document.
    inlineCss: false,

    // Note: optimizeCss is disabled as it relies on Critters and is
    // incompatible with App Router streaming. Use stable CSS pipeline instead.

    // Server Actions configuration
    serverActions: {
      bodySizeLimit: '2mb',
    },

    // Enable View Transitions API (React 19.2 feature)
    viewTransition: true,

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
    // Caches compilation results to disk, dramatically reducing rebuild times
    turbopackFileSystemCacheForDev: true,
  },

  // Enable typed routes for compile-time validation of Link hrefs
  typedRoutes: true,

  // Disable metadata streaming for HTML-limited crawlers so SEO audits read
  // full OG/Twitter/title tags directly from the initial HTML head.
  htmlLimitedBots: HTML_LIMITED_BOTS_UA_RE,

  // Turbopack resolve alias (Next.js 16 default bundler)
  // Maps @tiptap/extension-text-style to compat shim that re-exports
  // v3 named exports with a legacy default export for Novel
  turbopack: {
    resolveAlias: {
      // Relative path required — Turbopack doesn't support absolute paths in resolveAlias
      '@tiptap/extension-text-style':
        './src/lib/tiptap-extension-text-style-compat.ts',
    },
  },

  // Webpack fallback alias (used when building with --webpack flag)
  webpack(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@tiptap/extension-text-style$': path.resolve(
        __dirname,
        'src/lib/tiptap-extension-text-style-compat.ts'
      ),
    };

    return config;
  },

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
        destination:
          '/blog/moving-on-from-iphone-xr-in-2025-heres-what-to-buy-next',
        permanent: true,
      },
      {
        source:
          '/blog/why-the-samsung-galaxy-s21-ultra-is-still-a-top-pick-in-2024',
        destination:
          '/blog/samsung-galaxy-s21-ultra-in-2025-powerful-enough-or-just-hanging-on',
        permanent: true,
      },
      // Note: legacy WordPress category permalink redirects (/blog/:legacyCategory/:postSlug)
      // and thumbnail_id query-string stripping are owned by apps/web/src/proxy.ts
      // (single source of truth, also handles /blog/wp-admin 410s). Do not re-add here to
      // avoid redirect chains / competing rules.
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
  rewrites() {
    const mcpServerUrl = process.env.MCP_SERVER_URL;
    if (!mcpServerUrl) {
      return [];
    }
    return [
      {
        source: '/blog/sitemap.xml',
        destination: '/sitemap/blog.xml',
      },
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
    const ogabasseyHomePreloadHeaders = OGABASSEY_HOME_MOBILE_HERO_LINK_PRELOAD
      ? [
          {
            source: '/',
            has: [{ type: 'host', value: 'ogabassey.com' }],
            headers: [
              {
                key: 'Link',
                value: OGABASSEY_HOME_MOBILE_HERO_LINK_PRELOAD,
              },
            ],
          },
          {
            source: '/',
            has: [{ type: 'host', value: 'www.ogabassey.com' }],
            headers: [
              {
                key: 'Link',
                value: OGABASSEY_HOME_MOBILE_HERO_LINK_PRELOAD,
              },
            ],
          },
        ]
      : [];

    return [
      ...ogabasseyHomePreloadHeaders,
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
          // Note: COEP is set selectively in proxy.ts (middleware)
          // to allow Google Ads on storefront while protecting admin routes
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
// Force rebuild: ${new Date().toISOString()}
