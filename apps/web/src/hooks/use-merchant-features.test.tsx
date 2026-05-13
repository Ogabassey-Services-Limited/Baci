import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: vi.fn(() => ({
    merchant: { id: 'm-1', slug: 'ogabassey' },
    loading: false,
  })),
}));

vi.mock('@/lib/feature-flags', () => ({
  planHasFeature: vi.fn(
    (_plan: string, feature: string) => feature === 'basic_analytics'
  ),
  getPlanFeatures: vi.fn(() => ['basic_analytics', 'reviews']),
  hasSmartCartPro: vi.fn(() => false),
  getUpgradeCTA: vi.fn((feature: string) => ({
    title: `Upgrade for ${feature}`,
    description: 'Get more features',
    targetPlan: 'pro',
  })),
  FEATURE_METADATA: { basic_analytics: { name: 'Analytics' } },
}));

import { renderHook } from '@testing-library/react';
// Explicit .tsx import because .ts file also exports useMerchantFeatures
import { FeatureGate, useMerchantFeatures } from './use-merchant-features.tsx';

describe('useMerchantFeatures (hook)', () => {
  it('returns plan tier and feature check', () => {
    const { result } = renderHook(() => useMerchantFeatures());
    expect(result.current.planTier).toBe('pro');
    expect(result.current.hasFeature('basic_analytics')).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('reports isPaidPlan for pro merchants', () => {
    const { result } = renderHook(() => useMerchantFeatures());
    expect(result.current.isPaidPlan).toBe(true);
  });
});

describe('FeatureGate', () => {
  it('renders children when feature is available', () => {
    render(
      <FeatureGate feature={'basic_analytics' as 'basic_analytics'}>
        <div>Feature Content</div>
      </FeatureGate>
    );
    expect(screen.getByText('Feature Content')).toBeDefined();
  });

  it('renders upgrade prompt when feature is unavailable', () => {
    render(
      <FeatureGate feature={'price_negotiation' as 'price_negotiation'}>
        <div>Hidden</div>
      </FeatureGate>
    );
    expect(screen.queryByText('Hidden')).toBeNull();
    expect(screen.getByRole('button', { name: /upgrade/i })).toBeDefined();
  });

  it('renders fallback when provided and feature unavailable', () => {
    render(
      <FeatureGate
        feature={'price_negotiation' as 'price_negotiation'}
        fallback={<div>Custom Fallback</div>}
      >
        <div>Hidden</div>
      </FeatureGate>
    );
    expect(screen.getByText('Custom Fallback')).toBeDefined();
  });
});
