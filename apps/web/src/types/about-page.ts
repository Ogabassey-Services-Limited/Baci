/**
 * Types for the structured merchant About page
 * These types support rich SEO with schema.org AboutPage markup
 */

import { generateOrganizationSchema } from '@/lib/seo-utils';
import type { MerchantTrustProfile } from '@/lib/storefront-trust/merchant-trust-profile-types';

export interface TeamMember {
  name: string;
  role: string;
  bio?: string;
  image?: string;
  social_links?: {
    linkedin?: string;
    twitter?: string;
    instagram?: string;
  };
}

export interface Milestone {
  year: number;
  title: string;
  description?: string;
}

export interface Award {
  title: string;
  year?: number;
  issuer?: string;
}

export interface MediaFeature {
  publication: string;
  title: string;
  url?: string;
  date?: string;
}

export interface SocialProof {
  customers_served?: number;
  years_in_business?: number;
  products_sold?: number;
  rating?: number;
  review_count?: number;
}

export interface MerchantAboutPage {
  // Brand Story
  story?: string;
  mission?: string;
  vision?: string;
  values?: string[];

  // Founder/Leadership
  founded_year?: number;
  founder_name?: string;
  founder_bio?: string;
  founder_image?: string;

  // Team
  team?: TeamMember[];

  // History & Achievements
  milestones?: Milestone[];
  awards?: Award[];
  certifications?: string[];
  media_features?: MediaFeature[];

  // Social Proof
  social_proof?: SocialProof;

  // Media
  gallery?: string[];
  video_url?: string;
}

/**
 * Whether the merchant has enough about-page content to justify rendering
 * an About page. Used by both the generateMetadata and page body to short
 * circuit to `notFound()` for merchants that haven't populated any of the
 * supported narrative, structured, or legacy fields.
 */
export function hasAboutPageContent(
  aboutPage: MerchantAboutPage,
  legacyAboutContent?: string | null
): boolean {
  return Boolean(
    aboutPage.story ||
      aboutPage.mission ||
      aboutPage.vision ||
      (aboutPage.values && aboutPage.values.length > 0) ||
      aboutPage.founded_year ||
      aboutPage.founder_name ||
      aboutPage.founder_bio ||
      aboutPage.founder_image ||
      (aboutPage.team && aboutPage.team.length > 0) ||
      (aboutPage.milestones && aboutPage.milestones.length > 0) ||
      (aboutPage.awards && aboutPage.awards.length > 0) ||
      (aboutPage.certifications && aboutPage.certifications.length > 0) ||
      (aboutPage.media_features && aboutPage.media_features.length > 0) ||
      (aboutPage.social_proof &&
        Object.values(aboutPage.social_proof).some(
          (value) => value !== undefined && value !== null
        )) ||
      (aboutPage.gallery && aboutPage.gallery.length > 0) ||
      aboutPage.video_url ||
      legacyAboutContent
  );
}

/**
 * Generate JSON-LD structured data for the About page
 * Implements schema.org AboutPage and Organization types
 */
export function generateAboutPageJsonLd(
  merchant: {
    business_name: string;
    slug?: string;
    logo_url?: string;
    country?: string;
    email?: string;
    social_media?: Record<string, string>;
  },
  aboutPage: MerchantAboutPage,
  baseUrl: string,
  trustProfile?: MerchantTrustProfile
): object {
  const organizationData = generateOrganizationSchema({
    name: merchant.business_name,
    url: baseUrl,
    country: merchant.country,
    logo: merchant.logo_url || undefined,
    email: merchant.email || undefined,
    socialMedia: merchant.social_media,
    foundingDate: aboutPage.founded_year
      ? aboutPage.founded_year.toString()
      : trustProfile?.foundedYear?.toString(),
    trustProfile,
  });

  if (aboutPage.founder_name) {
    organizationData.founder = {
      '@type': 'Person',
      name: aboutPage.founder_name,
      ...(aboutPage.founder_bio && { description: aboutPage.founder_bio }),
      ...(aboutPage.founder_image && { image: aboutPage.founder_image }),
    };
  }

  if (aboutPage.story) {
    organizationData.description = aboutPage.story;
  }

  if (aboutPage.mission) {
    organizationData.slogan = aboutPage.mission;
  }

  // Add team members as employees
  if (aboutPage.team && aboutPage.team.length > 0) {
    organizationData.employee = aboutPage.team.map((member) => ({
      '@type': 'Person',
      name: member.name,
      jobTitle: member.role,
      ...(member.bio && { description: member.bio }),
      ...(member.image && { image: member.image }),
    }));
  }

  // Add awards
  if (aboutPage.awards && aboutPage.awards.length > 0) {
    organizationData.award = aboutPage.awards.map((award) => award.title);
  }

  // Add aggregate rating if available
  if (aboutPage.social_proof?.rating && aboutPage.social_proof?.review_count) {
    organizationData.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: aboutPage.social_proof.rating,
      reviewCount: aboutPage.social_proof.review_count,
    };
  }

  // Wrap in AboutPage for the page itself
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `About ${merchant.business_name}`,
    url: `${baseUrl}/about`,
    mainEntity: organizationData,
  };
}
