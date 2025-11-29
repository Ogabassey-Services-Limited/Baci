
import type { Metadata } from 'next';
import LandingPage from '@/components/landing/landing-page';
import { PLATFORM_CONFIG } from '@/config/platform';

export const metadata: Metadata = {
  title: `${PLATFORM_CONFIG.name} - ${PLATFORM_CONFIG.description}`,
  description: 'Create your e-commerce store in seconds with AI. Launch a professional online store with no coding required. Start your 14-day free trial today.',
  keywords: ['ai ecommerce', 'online store builder', 'create online store', 'ecommerce platform', 'ai store builder', 'no code ecommerce'],
  openGraph: {
    title: `${PLATFORM_CONFIG.name} - ${PLATFORM_CONFIG.description}`,
    description: 'Create your e-commerce store in seconds with AI. Launch a professional online store with no coding required.',
    url: PLATFORM_CONFIG.url,
    siteName: PLATFORM_CONFIG.name,
    type: 'website',
    images: [
      {
        url: `${PLATFORM_CONFIG.url}/og-image.png`,
        width: 1200,
        height: 630,
        alt: `${PLATFORM_CONFIG.name} - AI-Powered E-commerce Builder`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PLATFORM_CONFIG.name} - ${PLATFORM_CONFIG.description}`,
    description: 'Create your e-commerce store in seconds with AI. Launch a professional online store with no coding required.',
    images: [`${PLATFORM_CONFIG.url}/og-image.png`],
  },
  alternates: {
    canonical: PLATFORM_CONFIG.url,
  },
};

export default function HomePage() {
  return <LandingPage />;
}
