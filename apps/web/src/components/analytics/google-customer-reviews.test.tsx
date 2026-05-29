import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MerchantData } from '@/hooks/merchant/types';
import { GoogleCustomerReviews } from './google-customer-reviews';

vi.mock('next/script', () => ({
  default: ({
    children,
    id,
    src,
  }: {
    children?: string;
    id?: string;
    src?: string;
  }) => (
    <script data-testid={id} src={src}>
      {children}
    </script>
  ),
}));

const merchant: MerchantData = {
  id: 'merchant-1',
  user_id: 'user-1',
  business_name: 'Ogabassey',
  business_type: 'electronics',
  slug: 'ogabassey',
  feature_settings: {
    custom_settings: {
      google_merchant_id: '112524323',
    },
  },
};

describe('GoogleCustomerReviews', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render until the Merchant Center ID is configured', () => {
    const { container } = render(
      <GoogleCustomerReviews
        merchant={{ ...merchant, feature_settings: undefined }}
        orderId="order-123"
        email="buyer@example.com"
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('serializes the opt-in payload with Merchant Center ID and product GTINs', () => {
    const { getByTestId } = render(
      <GoogleCustomerReviews
        merchant={merchant}
        orderId="order-123"
        email="buyer@example.com"
        country="NG"
        deliveryDate="2026-06-02"
        products={[{ gtin: ' 0123456789012 ' }, { gtin: null }]}
      />
    );

    const script = getByTestId('gcr-opt-in');

    expect(script.textContent).toContain('"merchant_id":112524323');
    expect(script.textContent).toContain('"order_id":"order-123"');
    expect(script.textContent).toContain('"email":"buyer@example.com"');
    expect(script.textContent).toContain('"delivery_country":"NG"');
    expect(script.textContent).toContain(
      '"products":[{"gtin":"0123456789012"}]'
    );
  });

  it('escapes JSON payload content before inlining the opt-in script', () => {
    const { getByTestId } = render(
      <GoogleCustomerReviews
        merchant={merchant}
        orderId={'order-<script>alert(1)</script>&'}
        email="buyer@example.com"
        products={[{ gtin: 'gtin-><&' }]}
      />
    );

    const script = getByTestId('gcr-opt-in');

    expect(script.textContent).toContain('order-\\u003cscript\\u003e');
    expect(script.textContent).toContain('gtin-\\u003e\\u003c\\u0026');
    expect(script.textContent).not.toContain('<script>');
  });

  it('uses the default country and estimated delivery date when omitted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T12:00:00.000Z'));

    const { getByTestId } = render(
      <GoogleCustomerReviews
        merchant={merchant}
        orderId="order-123"
        email="buyer@example.com"
      />
    );

    const script = getByTestId('gcr-opt-in');

    expect(script.textContent).toContain('"delivery_country":"NG"');
    expect(script.textContent).toContain(
      '"estimated_delivery_date":"2026-05-31"'
    );
  });

  it('omits products when no usable GTINs are present', () => {
    const { getByTestId } = render(
      <GoogleCustomerReviews
        merchant={merchant}
        orderId="order-123"
        email="buyer@example.com"
        products={[{ gtin: '' }, { gtin: null }]}
      />
    );

    expect(getByTestId('gcr-opt-in').textContent).not.toContain('"products"');
  });

  it('renders the Google platform script with the opt-in onload callback', () => {
    const { getByTestId, container } = render(
      <GoogleCustomerReviews
        merchant={merchant}
        orderId="order-123"
        email="buyer@example.com"
      />
    );
    const scripts = Array.from(container.querySelectorAll('script'));

    expect(getByTestId('gcr-platform')).toHaveAttribute(
      'src',
      'https://apis.google.com/js/platform.js?onload=renderOptIn'
    );
    expect(scripts.map((script) => script.dataset.testid)).toEqual([
      'gcr-opt-in',
      'gcr-platform',
    ]);
  });
});
