import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutThemeProvider } from '@/components/checkout-theme-provider';

const mocks = vi.hoisted(() => ({
  useMerchant: vi.fn(),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchant: (...args: unknown[]) => mocks.useMerchant(...args),
}));

describe('CheckoutThemeProvider', () => {
  beforeEach(() => {
    mocks.useMerchant.mockReset();
    document.documentElement.removeAttribute('style');
  });

  it('sets store primary companion variables when applying merchant theme colors', async () => {
    mocks.useMerchant.mockReturnValue({
      merchant: {
        brand_colors: {
          primary: '#ffffff',
        },
      },
    });

    const { unmount } = render(
      <CheckoutThemeProvider>
        <div>Checkout</div>
      </CheckoutThemeProvider>
    );

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue('--store-primary')
      ).toBe('#ffffff');
      expect(
        document.documentElement.style.getPropertyValue('--store-on-primary')
      ).toBe('#000000');
      expect(
        document.documentElement.style.getPropertyValue('--store-primary-text')
      ).toBe('#000000');
      expect(
        document.documentElement.style.getPropertyValue('--store-border')
      ).toBe('rgba(255, 255, 255, 0.24)');
    });

    unmount();

    expect(
      document.documentElement.style.getPropertyValue('--store-primary')
    ).toBe('');
    expect(
      document.documentElement.style.getPropertyValue('--store-on-primary')
    ).toBe('');
    expect(
      document.documentElement.style.getPropertyValue('--store-primary-text')
    ).toBe('');
    expect(
      document.documentElement.style.getPropertyValue('--store-border')
    ).toBe('');
  });

  it('sets a light on-primary color for dark merchant primary colors', async () => {
    mocks.useMerchant.mockReturnValue({
      merchant: {
        brand_colors: {
          primary: '#111111',
        },
      },
    });

    render(
      <CheckoutThemeProvider>
        <div>Checkout</div>
      </CheckoutThemeProvider>
    );

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue('--store-on-primary')
      ).toBe('#FFFFFF');
      expect(
        document.documentElement.style.getPropertyValue('--store-primary-text')
      ).toBe('#FFFFFF');
      expect(
        document.documentElement.style.getPropertyValue('--store-border')
      ).toBe('rgba(17, 17, 17, 0.24)');
    });
  });

  it('sets white on-primary text for mid-tone primary colors', async () => {
    mocks.useMerchant.mockReturnValue({
      merchant: {
        brand_colors: {
          primary: '#4d4dff',
        },
      },
    });

    render(
      <CheckoutThemeProvider>
        <div>Checkout</div>
      </CheckoutThemeProvider>
    );

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue('--store-primary')
      ).toBe('#4d4dff');
      expect(
        document.documentElement.style.getPropertyValue('--store-on-primary')
      ).toBe('#FFFFFF');
      expect(
        document.documentElement.style.getPropertyValue('--store-primary-text')
      ).toBe('#FFFFFF');
      expect(
        document.documentElement.style.getPropertyValue('--store-border')
      ).toBe('rgba(77, 77, 255, 0.24)');
    });
  });

  it('does not set store variables when merchant brand colors are missing', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: {},
    });

    render(
      <CheckoutThemeProvider>
        <div>Checkout</div>
      </CheckoutThemeProvider>
    );

    expect(
      document.documentElement.style.getPropertyValue('--store-primary')
    ).toBe('');
    expect(
      document.documentElement.style.getPropertyValue('--store-on-primary')
    ).toBe('');
    expect(
      document.documentElement.style.getPropertyValue('--store-border')
    ).toBe('');
  });

  it('does not mutate root theme variables while merchant data is loading', () => {
    mocks.useMerchant.mockReturnValue({
      loading: true,
      merchant: undefined,
    });

    render(
      <CheckoutThemeProvider>
        <div>Checkout</div>
      </CheckoutThemeProvider>
    );

    expect(document.documentElement.getAttribute('style')).toBeNull();
  });
});
