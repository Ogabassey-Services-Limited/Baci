import { describe, expect, it } from 'vitest';
import {
  normalizeFeatures,
  normalizeNewsletter,
  normalizeTrustBadges,
} from './ai-storefront-normalize-support';

describe('ai storefront support section normalizers', () => {
  it('normalizes features aliases and column literals', () => {
    const features = normalizeFeatures(
      {
        id: 'why-us',
        title: 'Why choose us',
        description: 'Reliable commerce support',
        columns: 4,
        items: [
          {
            title: 'Secure',
            description: 'Safe checkout',
            icon: 'shield-check',
          },
          'Fast delivery',
        ],
      },
      0
    );

    expect(features.props).toEqual(
      expect.objectContaining({
        id: 'why-us',
        title: 'Why choose us',
        subtitle: 'Reliable commerce support',
        columns: 4,
        features: [
          {
            title: 'Secure',
            description: 'Safe checkout',
            icon: 'shield-check',
          },
          {
            title: 'Fast delivery',
            description: 'Fast delivery',
            icon: 'check',
          },
        ],
      })
    );
  });

  it('falls back for invalid feature lists and invalid column values', () => {
    const features = normalizeFeatures(
      { columns: 9, features: ['Only one'] },
      1
    );

    if (features.type !== 'Features') {
      throw new Error('Expected Features component');
    }
    expect(features.props.columns).toBe(3);
    expect(features.props.features).toHaveLength(3);
  });

  it('normalizes trust badges layout/style and badge aliases', () => {
    const trustBadges = normalizeTrustBadges(
      {
        badges: [
          'Secure checkout',
          {
            name: 'Fast delivery',
            subtitle: 'Tracked shipping',
            icon: 'truck',
          },
        ],
        layout: 'grid',
        style: 'minimal',
      },
      2
    );

    expect(trustBadges.props).toEqual(
      expect.objectContaining({
        id: 'trust-badges-3',
        layout: 'grid',
        style: 'minimal',
        badges: [
          {
            title: 'Secure checkout',
            description: 'Secure checkout',
            icon: 'check',
          },
          {
            title: 'Fast delivery',
            description: 'Tracked shipping',
            icon: 'truck',
          },
        ],
      })
    );
  });

  it('falls back for invalid trust badge layout, style, and malformed badges', () => {
    const trustBadges = normalizeTrustBadges(
      { layout: 'diagonal', style: 'unknown', badges: [123, null] },
      0
    );

    if (trustBadges.type !== 'TrustBadges') {
      throw new Error('Expected TrustBadges component');
    }
    expect(trustBadges.props).toEqual(
      expect.objectContaining({
        id: 'trust-badges-1',
        layout: 'horizontal',
        style: 'cards',
      })
    );
    expect(trustBadges.props.badges.length).toBeGreaterThan(0);
  });

  it('normalizes newsletter aliases and CTA button text', () => {
    const newsletter = normalizeNewsletter(
      {
        title: 'Join our list',
        subtitle: 'Get launches and offers first',
        input_field: 'Email address',
        cta_button: { label: 'Join now' },
      },
      3
    );

    expect(newsletter.props).toEqual(
      expect.objectContaining({
        id: 'newsletter-4',
        title: 'Join our list',
        description: 'Get launches and offers first',
        placeholder: 'Email address',
        buttonText: 'Join now',
      })
    );
  });

  it('falls back for invalid newsletter text and CTA aliases', () => {
    const newsletter = normalizeNewsletter(
      { title: 123, input_field: false, cta_button: { label: 99 } },
      4
    );

    expect(newsletter.props).toEqual(
      expect.objectContaining({
        id: 'newsletter-5',
        title: 'Get updates',
        placeholder: 'Enter your email',
        buttonText: 'Subscribe',
      })
    );
  });
});
