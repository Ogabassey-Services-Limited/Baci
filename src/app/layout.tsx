
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Analytics } from "@vercel/analytics/next"
import { Providers } from '@/contexts/providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap', // Prevents FOIT (Flash of Invisible Text)
  preload: true, // Preloads font for faster initial render
});

const VENDOR_NAME = 'Baci';
const VENDOR_LEGAL_NAME = 'Baci AI E-commerce';
const VENDOR_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';


export const metadata: Metadata = {
  title: {
    default: `${VENDOR_NAME} - Your AI-Powered E-commerce Builder`,
    template: `%s | ${VENDOR_NAME}`,
  },
  description: 'Create your e-commerce store in seconds with AI. Launch a professional online store with no coding required.',
  applicationName: VENDOR_NAME,
  authors: [{ name: VENDOR_NAME }],
  keywords: ['ai', 'ecommerce', 'store builder', 'online store', 'nextjs', 'react', 'business', 'retail'],
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
    title: `${VENDOR_NAME} - Your AI-Powered E-commerce Builder`,
    description: 'Create your e-commerce store in seconds with AI. Launch a professional online store with no coding required.',
    url: VENDOR_URL,
    siteName: VENDOR_NAME,
    images: [
      {
        url: `${VENDOR_URL}/og-image.png`, // Ensure this image exists or use a placeholder
        width: 1200,
        height: 630,
        alt: `${VENDOR_NAME} - Your AI-Powered E-commerce Builder`,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${VENDOR_NAME} - Your AI-Powered E-commerce Builder`,
    description: 'Create your e-commerce store in seconds with AI. Launch a professional online store with no coding required.',
    creator: `@${VENDOR_NAME}`, // Update if you have a specific handle
    images: [`${VENDOR_URL}/og-image.png`],
  },
  alternates: {
    canonical: VENDOR_URL,
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
  // Theme color for browser chrome
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3F51B5' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1f4e' },
  ],
  // Color scheme support
  colorScheme: 'light dark',
};

import { CsrfInitializer } from '@/components/csrf-initializer';
import { headers } from 'next/headers';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get nonce from middleware (will be null for storefront routes)
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') || undefined;
  // const nonce = undefined;

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: VENDOR_NAME,
    alternateName: 'Baci - Your AI-Powered E-commerce Builder',
    legalName: VENDOR_LEGAL_NAME,
    url: VENDOR_URL,
    logo: `${VENDOR_URL}/logo.svg`,
    sameAs: [
      'https://twitter.com/usebaci',
      'https://linkedin.com/company/usebaci',
      'https://instagram.com/usebaci'
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-555-555-5555',
      contactType: 'customer service',
      areaServed: 'US',
      availableLanguage: 'en'
    },
    // Entity Salience: Connect Baci to AI and E-commerce concepts
    knowsAbout: [
      'Artificial Intelligence',
      'E-commerce',
      'Web Development',
      'Online Store Builder',
      'SaaS'
    ]
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: VENDOR_NAME,
    url: VENDOR_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${VENDOR_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: VENDOR_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: 'AI-powered e-commerce platform for building online stores.',
    // Advanced fields for SGE and Rich Results
    softwareVersion: '2.0.0',
    screenshot: `${VENDOR_URL}/og-image.png`, // AI uses this to visualize the app
    featureList: [
      'AI Store Builder',
      'Inventory Management',
      'Payment Processing',
      'SEO Optimization',
      'Analytics Dashboard'
    ],
    isAccessibleForFree: true,
    applicationSubCategory: 'E-commerce Platform'
  };


  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Font loading is handled automatically by next/font/google (Inter).
          No manual preconnect/preload needed - Next.js optimizes this.
        */}

        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
      </head>
      <body className={inter.variable} suppressHydrationWarning>
        {/* Skip link for accessibility - allows keyboard users to bypass navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <CsrfInitializer />
        <Providers>
          {children}
          <Toaster />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
