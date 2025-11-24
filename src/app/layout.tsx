
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
  title: `${VENDOR_NAME} - AI E-commerce Builder`,
  description: 'Create your e-commerce store in seconds with AI.',
  applicationName: VENDOR_NAME,
  authors: [{ name: VENDOR_NAME }],
  keywords: ['ai', 'ecommerce', 'store builder', 'online store', 'nextjs', 'react'],
  robots: {
    index: true,
    follow: true,
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
