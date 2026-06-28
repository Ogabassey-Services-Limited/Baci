import { JsonLd } from '@/components/seo/json-ld';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { buildStoreUrl } from '@/lib/store-url';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import {
  generateAboutPageJsonLd,
  hasAboutPageContent,
  type MerchantAboutPage,
} from '@/types/about-page';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function AboutJsonLd({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) return null;

  const aboutPage = (merchant.about_page || {}) as MerchantAboutPage;
  if (!hasAboutPageContent(aboutPage, merchant.pages?.about)) {
    return null;
  }

  const baseUrl = buildStoreUrl(merchant);
  const trustProfile = buildMerchantTrustProfile(merchant, baseUrl);
  const jsonLd = generateAboutPageJsonLd(
    merchant,
    aboutPage,
    baseUrl,
    trustProfile
  );

  return <JsonLd data={jsonLd as Record<string, unknown>} />;
}
