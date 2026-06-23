import { MOBILE_APPS } from '@/config/platform';
import type { MerchantData } from '@/hooks/merchant/types';
import { asRoute } from '@/lib/routes';
import { normalizeSocialUrl } from '@/lib/social';
import {
  buildMerchantTrustProfile,
  hasPublishableReturnsPolicy,
  hasPublishableShippingPolicy,
  hasPublishableWarrantyPolicy,
} from '@/lib/storefront-trust/build-merchant-trust-profile';
import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Music,
  Phone,
  Twitter,
  Youtube,
  Ghost,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';

import { Logo } from './Logo';

type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'twitter'
  | 'youtube'
  | 'linkedin'
  | 'snapchat';

// Monochrome at rest (clean on the dark footer); the merchant accent appears
// on hover so the row stays theme-driven instead of hardcoding platform colors.
const SOCIAL_LINK_CLASS =
  'text-store-primary-text/65 hover:text-store-primary transition-colors';

interface FooterProps {
  merchant?: MerchantData;
  storeSlug?: string;
}

type FooterLink = { label: string; href: ReturnType<typeof asRoute> };

function normalizeStoreSlug(storeSlug?: string): string {
  const normalized = storeSlug?.trim().replace(/^\/+|\/+$/g, '');
  return normalized ? `/${normalized}` : '';
}

function firstNonEmptyTrimmed(
  ...values: Array<string | null | undefined>
): string | undefined {
  return values
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
}

export const Footer: React.FC<FooterProps> = ({ merchant, storeSlug }) => {
  const basePath = normalizeStoreSlug(storeSlug);
  const businessName = merchant?.business_name || 'Ogabassey';
  const socialLinks = merchant?.social_media || {};
  // Prefer the public support email (what merchants edit in store settings) over the
  // private account email, so admin edits surface and the account email isn't exposed.
  const contactEmail =
    firstNonEmptyTrimmed(merchant?.support_email, merchant?.email) ??
    'support@ogabassey.com';
  const contactPhone = merchant?.phone || '+234 814 697 8921';
  const contactAddress =
    firstNonEmptyTrimmed(merchant?.business_address) ??
    '2 Olaide Tomori St, Ikeja, Lagos';
  // Open the storefront address in Google Maps. Derived from the address text
  // so it stays correct for any merchant using this template.
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    contactAddress
  )}`;
  const trustProfile = merchant
    ? buildMerchantTrustProfile(merchant, basePath || undefined)
    : null;
  const trustLinks: FooterLink[] = [
    trustProfile && hasPublishableReturnsPolicy(trustProfile)
      ? { label: 'Returns', href: asRoute(`${basePath}/returns`) }
      : null,
    trustProfile && hasPublishableShippingPolicy(trustProfile)
      ? { label: 'Shipping', href: asRoute(`${basePath}/shipping`) }
      : null,
    trustProfile && hasPublishableWarrantyPolicy(trustProfile)
      ? { label: 'Warranty', href: asRoute(`${basePath}/warranty`) }
      : null,
  ].filter((link): link is FooterLink => link !== null);

  // Helper to render social link if it exists
  const renderSocialLink = (
    input: string | undefined,
    label: string,
    platform: SocialPlatform,
    Icon: React.ElementType
  ) => {
    const url = normalizeSocialUrl(input, platform);
    if (!url) return null;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={SOCIAL_LINK_CLASS}
        aria-label={label}
      >
        <Icon size={20} />
      </a>
    );
  };

  return (
    <footer className="bg-[color:color-mix(in_srgb,var(--store-background-text)_94%,black)] text-store-primary-text pt-10 pb-32 md:pb-10 relative overflow-hidden font-sans border-t border-store-border/40">
      {/* Pattern Overlay - Same as Navbar */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(color-mix(in srgb, var(--store-primary-text) 22%, transparent) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {/* Column 1: Brand Info (Compact) */}
          <div className="space-y-4">
            <Link
              href={asRoute(basePath || '/')}
              className="flex items-center cursor-pointer select-none"
            >
              <Logo className="h-8 w-auto" />
            </Link>
            <p className="text-store-primary-text/65 text-xs leading-relaxed max-w-xs">
              Making Smartphones Accessible and Affordable
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              {renderSocialLink(
                socialLinks.instagram,
                'Instagram',
                'instagram',
                Instagram
              )}
              {renderSocialLink(
                socialLinks.facebook,
                'Facebook',
                'facebook',
                Facebook
              )}
              {renderSocialLink(socialLinks.tiktok, 'TikTok', 'tiktok', Music)}
              {renderSocialLink(
                socialLinks.twitter,
                'X (Twitter)',
                'twitter',
                Twitter
              )}
              {renderSocialLink(
                socialLinks.youtube,
                'YouTube',
                'youtube',
                Youtube
              )}
              {renderSocialLink(
                socialLinks.linkedin,
                'LinkedIn',
                'linkedin',
                Linkedin
              )}
              {renderSocialLink(
                socialLinks.snapchat,
                'Snapchat',
                'snapchat',
                Ghost
              )}
            </div>
          </div>

          {/* Column 2: Quick Links (Merged) */}
          {/* Column 2: Quick Links (Unified) */}
          <nav className="flex justify-between md:justify-start gap-12" aria-label="Footer navigation">
            <div>
              <h3 className="text-sm font-bold mb-4 text-store-primary-text uppercase tracking-wider">
                Menu
              </h3>
              <ul className="space-y-2 text-xs text-store-primary-text/65">
                <li><Link href={asRoute(`${basePath}/about`)} className="hover:text-store-primary">About Us</Link></li>
                <li><Link href={asRoute(`${basePath}/blog`)} className="hover:text-store-primary">Blog</Link></li>
                <li><Link href={asRoute(`${basePath}/repairs`)} className="hover:text-store-primary">Repairs</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-4 text-store-primary-text uppercase tracking-wider">
                Support
              </h3>
              <ul className="space-y-2 text-xs text-store-primary-text/65">
                <li><Link href={asRoute(`${basePath}/track-order`)} className="hover:text-store-primary">Track Order</Link></li>
                <li><Link href={asRoute(`${basePath}/faq`)} className="hover:text-store-primary">Help Center</Link></li>
                <li><Link href={asRoute(`${basePath}/contact`)} className="hover:text-store-primary">Contact Us</Link></li>
                <li><Link href={asRoute(`${basePath}/terms`)} className="hover:text-store-primary">Terms of Service</Link></li>
                <li><Link href={asRoute(`${basePath}/privacy`)} className="hover:text-store-primary">Privacy Policy</Link></li>
                {trustLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="hover:text-store-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Column 3: Contact (Compact) */}
          <address className="not-italic">
            <h3 className="text-sm font-bold mb-4 text-store-primary-text uppercase tracking-wider">
              Contact
            </h3>
            <ul className="space-y-3 text-xs text-store-primary-text/65">
              <li className="flex items-start gap-2">
                <MapPin className="shrink-0 text-store-primary" size={16} />
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${contactAddress} in Google Maps`}
                  className="hover:text-store-primary-text transition-colors"
                >
                  {contactAddress}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="shrink-0 text-store-primary" size={16} />
                <a href={`tel:${contactPhone.replace(/\s/g, '')}`} className="hover:text-store-primary-text transition-colors">
                  {contactPhone}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="shrink-0 text-store-primary" size={16} />
                <a
                  href={`mailto:${contactEmail}`}
                  className="hover:text-store-primary-text transition-colors"
                >
                  {contactEmail}
                </a>
              </li>
            </ul>
          </address>

          {/* Column 4: App & Payment (Horizontal) */}
          <div>
            <h3 className="text-sm font-bold mb-4 text-store-primary-text uppercase tracking-wider">
              Download App
            </h3>
            <div className="flex gap-2 mb-6">
              {MOBILE_APPS.storefront.appStoreUrl ? (
                <a
                  href={MOBILE_APPS.storefront.appStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Download on the App Store"
                  className="inline-flex transition-opacity hover:opacity-90"
                >
                  <img
                    src="/badges/app-store-black.svg"
                    alt="Download on the App Store"
                    className="h-10 w-auto"
                  />
                </a>
              ) : null}
              <a
                href={MOBILE_APPS.storefront.playStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Get it on Google Play"
                className="inline-flex transition-opacity hover:opacity-90"
              >
                <img
                  src="/badges/google-play.svg"
                  alt="Get it on Google Play"
                  className="h-10 w-auto"
                />
              </a>
            </div>

            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] text-store-primary-text/50 font-medium">Secured by:</span>
              {/* Paystack Logo Badge */}
              <div className="flex items-center gap-1 bg-store-background px-2 py-1 rounded border border-store-border shadow-sm opacity-90 hover:opacity-100 transition-opacity">
                <svg viewBox="0 0 24 24" className="size-4 text-store-primary fill-current">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <span className="text-[10px] font-bold text-store-background-text tracking-tight">Paystack</span>
              </div>

              {/* Flutterwave Logo Badge */}
              <div className="flex items-center gap-1 bg-store-background px-2 py-1 rounded border border-store-border shadow-sm opacity-90 hover:opacity-100 transition-opacity">
                <svg viewBox="0 0 24 24" className="size-4 text-store-primary fill-current">
                  <path d="M12 2L2 22h10l10-20H12zm0 6l-5 10h10L12 8z" />
                </svg>
                <span className="text-[10px] font-bold text-store-background-text tracking-tight">Flutterwave</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-store-border/40 text-center text-[10px] text-store-primary-text/50">
          <span suppressHydrationWarning>&copy; {new Date().getFullYear()} Ogabassey Ltd. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
};
