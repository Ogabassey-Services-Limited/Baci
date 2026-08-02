import { describe, expect, it } from 'vitest';
import { getInitialTemplateProfile } from '@/lib/initial-template-profiles';
import { buildCuratedStorefront } from './build-curated-storefront';
import { forbiddenCuratedStorefrontClaims } from './curated-claim-test-support';
import { curatedProfileCases } from './curated-profile-cases.test-support';

describe('curated starter claim safety', () => {
  it('keeps one representative from every prohibited claim class in the shared policy', () => {
    expect(forbiddenCuratedStorefrontClaims).toEqual(
      expect.arrayContaining([
        'free shipping',
        'nationwide delivery',
        'easy payments',
        'flexible payment',
        'premium quality',
        'trusted quality',
        'trusted by',
        'warranty',
        'best seller',
        'expert advice',
        'expert',
      ])
    );
  });
  it.each(
    curatedProfileCases
  )('keeps $businessType copy merchant-specific and claim-safe', ({
    businessType,
  }) => {
    const storefront = buildCuratedStorefront({
      businessName: 'North Star',
      businessType,
      country: 'Nigeria',
      brandColors: {
        primary: '#111111',
        background: '#ffffff',
        accent: '#f97316',
      },
    });
    const content = JSON.stringify(storefront).toLowerCase();
    const profile = JSON.stringify(
      getInitialTemplateProfile(businessType)
    ).toLowerCase();
    expect(content).toContain('north star');
    expect(
      storefront.content.filter(
        (block) => block.type === 'Hero' && block.props?.headingLevel === 'h1'
      )
    ).toHaveLength(1);
    expect(
      storefront.content.find((block) => block.type === 'Header')?.props
        ?.navigationLinks
    ).toEqual([
      { label: 'Home', url: '/' },
      expect.objectContaining({ url: '/products' }),
      { label: 'About', url: '/about' },
    ]);
    expect(
      storefront.content.find((block) => block.type === 'Header')?.props
        ?.ctaButton
    ).toEqual({ show: false, text: 'Get Started', url: '/signup' });
    expect(
      storefront.content.find((block) => block.type === 'Footer')?.props
        ?.quickLinks
    ).toEqual([
      { label: 'About Us', url: '/about' },
      { label: 'Contact', url: '/contact' },
      { label: 'Privacy Policy', url: '/privacy' },
      { label: 'Terms', url: '/terms' },
    ]);
    for (const claim of forbiddenCuratedStorefrontClaims)
      expect(content).not.toContain(claim);
    for (const claim of forbiddenCuratedStorefrontClaims)
      expect(profile).not.toContain(claim);
  });
});
