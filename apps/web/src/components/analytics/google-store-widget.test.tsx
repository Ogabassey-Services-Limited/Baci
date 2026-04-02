import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MerchantData } from '@/hooks/use-merchant';
import {
  GoogleStoreWidget,
  resolveGoogleStoreWidgetPreference,
} from './google-store-widget';

vi.mock('next/script', () => ({
  default: ({
    id,
    src,
    onLoad,
  }: {
    id?: string;
    src?: string;
    onLoad?: () => void;
  }) => {
    useEffect(() => {
      onLoad?.();
    }, [onLoad]);

    return <script data-testid={id} src={src} />;
  },
}));

const baseMerchant: MerchantData = {
  id: 'merchant-1',
  user_id: 'user-1',
  business_name: 'Ogabassey',
  business_type: 'electronics',
  slug: 'ogabassey',
  custom_domain: 'ogabassey.com',
};

const originalMerchantWidget = window.merchantwidget;

afterEach(() => {
  if (originalMerchantWidget) {
    window.merchantwidget = originalMerchantWidget;
    return;
  }

  delete window.merchantwidget;
});

describe('GoogleStoreWidget', () => {
  it('renders the widget script for the matching live domain', async () => {
    const start = vi.fn();
    window.merchantwidget = { start };

    render(
      <GoogleStoreWidget merchant={baseMerchant} hostname="www.ogabassey.com" />
    );

    await screen.findByTestId('google-store-widget-script');

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith({
        position: 'LEFT_BOTTOM',
        sideMargin: 24,
        bottomMargin: 24,
        mobileSideMargin: 16,
        mobileBottomMargin: 104,
      });
    });
  });

  it('renders when the merchant has no custom domain configured', async () => {
    const start = vi.fn();
    window.merchantwidget = { start };
    const merchantWithoutDomain = {
      ...baseMerchant,
      custom_domain: undefined,
    };

    render(
      <GoogleStoreWidget
        merchant={merchantWithoutDomain}
        hostname="preview.usebaci.com"
      />
    );

    await screen.findByTestId('google-store-widget-script');

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith({
        position: 'LEFT_BOTTOM',
        sideMargin: 24,
        bottomMargin: 24,
        mobileSideMargin: 16,
        mobileBottomMargin: 104,
      });
    });
  });

  it('does not render when the current hostname does not match the merchant domain', () => {
    render(
      <GoogleStoreWidget
        merchant={baseMerchant}
        hostname="preview.usebaci.com"
      />
    );

    expect(
      screen.queryByTestId('google-store-widget-script')
    ).not.toBeInTheDocument();
  });

  it('does not render when explicitly disabled', () => {
    render(
      <GoogleStoreWidget
        merchant={baseMerchant}
        enabled={false}
        hostname="ogabassey.com"
      />
    );

    expect(
      screen.queryByTestId('google-store-widget-script')
    ).not.toBeInTheDocument();
  });

  it('does not throw when merchantwidget API is unavailable after script load', async () => {
    delete window.merchantwidget;

    expect(() =>
      render(
        <GoogleStoreWidget merchant={baseMerchant} hostname="ogabassey.com" />
      )
    ).not.toThrow();

    await screen.findByTestId('google-store-widget-script');
  });
});

describe('resolveGoogleStoreWidgetPreference', () => {
  it('prefers the direct feature setting when present', () => {
    expect(
      resolveGoogleStoreWidgetPreference({
        ...baseMerchant,
        feature_settings: {
          google_store_widget_enabled: false,
          custom_settings: { google_store_widget_enabled: true },
        },
      })
    ).toBe(false);
  });

  it('falls back to custom settings when the direct feature setting is absent', () => {
    expect(
      resolveGoogleStoreWidgetPreference({
        ...baseMerchant,
        feature_settings: {
          custom_settings: { google_store_widget_enabled: true },
        },
      })
    ).toBe(true);
  });

  it('returns undefined when no explicit preference is configured', () => {
    expect(resolveGoogleStoreWidgetPreference(baseMerchant)).toBeUndefined();
  });
});
