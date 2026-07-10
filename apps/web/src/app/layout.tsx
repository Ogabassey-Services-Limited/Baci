import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import { Suspense } from 'react';
import './skip-link.css';
import { RootDynamicBody } from '@/app/root-dynamic-body';
import { Toaster } from '@/components/ui/toaster';
import { PLATFORM_CONFIG } from '@/config/platform';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  // display: swap renders immediately in the metric-compatible fallback (next/font's
  // adjustFontFallback is on by default for Inter) and swaps to Inter once loaded —
  // FOUT, not FOIT, with negligible CLS. We intentionally do NOT preload Inter: a body
  // font preload competes with the LCP hero image for the cold-mobile network window
  // (the render-blocking headroom this targets). The naira subset below stays preloaded
  // because it is display:optional and CLS-critical for every price glyph.
  display: 'swap',
  preload: false,
});

// Tiny (~1.2KB) Inter subset containing ONLY the naira sign (U+20A6), served
// ahead of Inter in the font stack. The unicode-range declaration scopes it so
// only ₦ resolves here — every other character falls through to Inter. Without
// this, ₦ lives in next/font's lazy latin-ext slice (~86KB, no preload,
// display: swap), which loads seconds later on cold caches and swaps every
// price glyph → CLS. display: optional makes this subset mathematically
// CLS-proof (it renders only if ready before first paint), and because ₦ never
// resolves to Inter's latin-ext range anymore, the 86KB fetch is skipped
// entirely. adjustFontFallback is off so no synthetic fallback @font-face is
// injected ahead of Inter for non-naira glyphs.
const interNaira = localFont({
  src: './fonts/inter-naira.woff2',
  weight: '100 900',
  display: 'optional',
  preload: true,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+20A6' }],
  variable: '--font-naira',
});

export const metadata: Metadata = {
  metadataBase: new URL(PLATFORM_CONFIG.url),
  alternates: {
    canonical: './',
  },
  title: {
    default: `${PLATFORM_CONFIG.name} - ${PLATFORM_CONFIG.description}`,
    template: `%s | ${PLATFORM_CONFIG.name}`,
  },
  description: PLATFORM_CONFIG.description,
  applicationName: PLATFORM_CONFIG.name,
  authors: [{ name: PLATFORM_CONFIG.name }],
  keywords: [
    'ai',
    'ecommerce',
    'store builder',
    'online store',
    'nextjs',
    'react',
    'business',
    'retail',
  ],
  // Favicon configuration - comprehensive setup for all devices
  icons: {
    icon: [
      { url: '/baci-verified-favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  // PWA manifest
  manifest: '/manifest.json',
  // Google AdSense site-ownership verification (renders
  // <meta name="google-adsense-account" content="ca-pub-9332275663101466">).
  verification: {
    other: {
      'google-adsense-account': 'ca-pub-9332275663101466',
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: `${PLATFORM_CONFIG.name} - ${PLATFORM_CONFIG.description}`,
    description: PLATFORM_CONFIG.description,
    url: PLATFORM_CONFIG.url,
    siteName: PLATFORM_CONFIG.name,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: `${PLATFORM_CONFIG.name} - ${PLATFORM_CONFIG.description}`,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PLATFORM_CONFIG.name} - ${PLATFORM_CONFIG.description}`,
    description: PLATFORM_CONFIG.description,
    creator: '@usebaci',
    images: ['/opengraph-image'],
  },
};

export const viewport: Viewport = {
  // Core viewport settings for responsive design
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // Allow zoom for accessibility (WCAG 1.4.4)
  userScalable: true, // Never disable zoom - accessibility requirement
  // Enable safe area support for notched devices (iPhone, etc.)
  viewportFit: 'cover',
  // Theme color for browser chrome (neutral for dashboard/platform)
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0F0F0F' },
  ],
  // Color scheme support
  colorScheme: 'light dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${inter.variable} ${interNaira.variable}`}
        suppressHydrationWarning
      >
        {/* Skip link for accessibility - allows keyboard users to bypass navigation */}
        <a href="#main-content" className="baci-skip-link">
          Skip to main content
        </a>
        <Toaster />
        <Suspense fallback={null}>
          <RootDynamicBody />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
