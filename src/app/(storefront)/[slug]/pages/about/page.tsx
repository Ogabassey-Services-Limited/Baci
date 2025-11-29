import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AboutPageClient } from './about-page-client';
import { generateAboutPageJsonLd, MerchantAboutPage } from '@/types/about-page';
import { safeJsonLdStringify } from '@/lib/sanitize';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getMerchant(slug: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !merchant) {
    return null;
  }

  return merchant;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

  if (!merchant) {
    return {
      title: 'About Us',
    };
  }

  const aboutPage = (merchant.about_page || {}) as MerchantAboutPage;
  const description = aboutPage.story || aboutPage.mission || `Learn more about ${merchant.business_name}`;

  return {
    title: `About Us | ${merchant.business_name}`,
    description: description.substring(0, 160),
    openGraph: {
      title: `About ${merchant.business_name}`,
      description: description.substring(0, 160),
      type: 'website',
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
  };
}

export default async function AboutPage({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

  if (!merchant) {
    notFound();
  }

  const aboutPage = (merchant.about_page || {}) as MerchantAboutPage;
  const legacyAboutContent = merchant.pages?.about;

  // If no structured about page and no legacy content, show not found
  if (!aboutPage.story && !aboutPage.mission && !legacyAboutContent) {
    notFound();
  }

  // Generate base URL for JSON-LD
  const isDevelopment = process.env.NODE_ENV === 'development';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  const baseUrl = isDevelopment
    ? `http://localhost:3000/storefront/${slug}`
    : `https://${slug}.${rootDomain}`;

  // Generate JSON-LD structured data
  const jsonLd = generateAboutPageJsonLd(merchant, aboutPage, baseUrl);

  return (
    <>
      {/* nosemgrep: react-dangerouslysetinnerhtml, typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml - JSON-LD structured data is safe server-generated content */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd as Record<string, unknown>) }}
      />
      <AboutPageClient
        merchant={merchant}
        aboutPage={aboutPage}
        legacyContent={legacyAboutContent}
      />
    </>
  );
}
