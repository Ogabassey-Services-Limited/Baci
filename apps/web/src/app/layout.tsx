import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import { RootDynamicBody } from '@/app/root-dynamic-body';
import { PLATFORM_CONFIG } from '@/config/platform';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap', // Prevents FOIT (Flash of Invisible Text)
  preload: true, // Preloads font for faster initial render
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
      <head>
        {/*
          Font loading is handled automatically by next/font/google (Inter).
          No manual preconnect/preload needed - Next.js optimizes this.
        */}

        {/*
          DNS prefetch hints for third-party origins
          Using dns-prefetch instead of preconnect to avoid "unused preconnect" warnings
          dns-prefetch is less aggressive but still helps with connection setup
          Note: Supabase URL is handled via env vars, no hardcoding needed
        */}
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body className={inter.variable} suppressHydrationWarning>
        {/* Skip link for accessibility - allows keyboard users to bypass navigation */}
        <a
          href="#main-content"
          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[9999] focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:px-4 focus-visible:py-2 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Skip to main content
        </a>
        <Suspense fallback={null}>
          <RootDynamicBody>{children}</RootDynamicBody>
        </Suspense>
      </body>
    </html>
  );
}
