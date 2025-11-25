
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Analytics } from "@vercel/analytics/next"
import { Providers } from '@/contexts/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const VENDOR_NAME = 'Baci';
const VENDOR_LEGAL_NAME = 'Baci AI E-commerce';
const VENDOR_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';


export const metadata: Metadata = {
  title: {
    default: `${VENDOR_NAME} - AI E-commerce Builder`,
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
    title: `${VENDOR_NAME} - AI E-commerce Builder`,
    description: 'Create your e-commerce store in seconds with AI. Launch a professional online store with no coding required.',
    url: VENDOR_URL,
    siteName: VENDOR_NAME,
    images: [
      {
        url: `${VENDOR_URL}/og-image.png`, // Ensure this image exists or use a placeholder
        width: 1200,
        height: 630,
        alt: `${VENDOR_NAME} - AI E-commerce Builder`,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${VENDOR_NAME} - AI E-commerce Builder`,
    description: 'Create your e-commerce store in seconds with AI. Launch a professional online store with no coding required.',
    creator: `@${VENDOR_NAME}`, // Update if you have a specific handle
    images: [`${VENDOR_URL}/og-image.png`],
  },
  alternates: {
    canonical: VENDOR_URL,
  },
};

export const viewport: Viewport = {
  themeColor: '#3F51B5',
};

import { CsrfInitializer } from '@/components/csrf-initializer';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: VENDOR_NAME,
    legalName: VENDOR_LEGAL_NAME,
    url: VENDOR_URL,
    logo: `${VENDOR_URL}/logo.svg`, // Assuming you have a logo file
    sameAs: [
      // Add links to your social media profiles here
      // e.g., "https://twitter.com/your-brand"
    ],
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
  };


  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://vercel.live https://assets.vercel.com https://va.vercel-scripts.com; object-src 'none'; base-uri 'self';" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
      </head>
      <body className={inter.variable} suppressHydrationWarning>
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
