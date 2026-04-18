import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MerchantData } from '@/hooks/use-merchant';
import AppBody from './app-body';

vi.mock('next/dynamic', () => ({
  default: () => {
    const Stub = () => <div data-testid="dynamic-stub" />;
    Stub.displayName = 'DynamicStub';
    return Stub;
  },
}));

const merchantWithBrandColors: MerchantData = {
  id: 'merchant-1',
  user_id: 'user-1',
  business_name: 'Test Merchant',
  business_type: 'retail',
  brand_colors: {
    primary: '#1D4ED8',
    background: '#F8FAFC',
    accent: '#F59E0B',
  },
};

describe('AppBody', () => {
  it('applies core theme variables when merchant core theme override is enabled', () => {
    const { container } = render(
      <AppBody merchant={merchantWithBrandColors}>
        <div>Storefront content</div>
      </AppBody>
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.getPropertyValue('--background')).not.toBe('');
    expect(wrapper.style.getPropertyValue('--card')).not.toBe('');
  });

  it('does not override core theme variables when merchant core theme override is disabled', () => {
    const { container } = render(
      <AppBody
        merchant={merchantWithBrandColors}
        applyMerchantCoreThemeVariables={false}
      >
        <div>Dashboard content</div>
      </AppBody>
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.getPropertyValue('--background')).toBe('');
    expect(wrapper.style.getPropertyValue('--card')).toBe('');

    // Brand accent/primary tokens stay available for merchant UI accents.
    expect(wrapper.style.getPropertyValue('--primary')).not.toBe('');
    expect(wrapper.style.getPropertyValue('--store-primary')).not.toBe('');
  });

  it('renders cookie consent by default when newsletter widget is disabled', () => {
    render(
      <AppBody showNewsletterWidget={false}>
        <div>Storefront content</div>
      </AppBody>
    );

    expect(screen.getByTestId('dynamic-stub')).toBeInTheDocument();
  });

  it('does not render cookie consent when showCookieConsent is false', () => {
    render(
      <AppBody showCookieConsent={false} showNewsletterWidget={false}>
        <div>Storefront content</div>
      </AppBody>
    );

    expect(screen.queryByTestId('dynamic-stub')).not.toBeInTheDocument();
  });
});
