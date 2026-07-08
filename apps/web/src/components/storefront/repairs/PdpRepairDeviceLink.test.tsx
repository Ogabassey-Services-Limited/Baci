import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PdpRepairDeviceLink } from './PdpRepairDeviceLink';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

const mockMaybeSingle = vi.fn();
const mockEq3 = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEq2 = vi.fn(() => ({ eq: mockEq3 }));
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/cached-data', () => ({
  getPublicSupabaseClient: () => ({ from: mockFrom }),
}));

const enabledMerchant = {
  id: 'merchant-1',
  business_type: 'electronics',
  feature_settings: { repairs_catalog_enabled: true },
  slug: 'ogabassey',
};

describe('PdpRepairDeviceLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a link to the device repair page when a linked device is found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { slug: 'apple-iphone-13-pro-max' },
      error: null,
    });

    render(
      await PdpRepairDeviceLink({
        basePath: '/ogabassey',
        merchant: enabledMerchant,
        productId: 'product-1',
      })
    );

    expect(
      screen.getByRole('link', { name: /repair this device/i })
    ).toHaveAttribute('href', '/ogabassey/repairs/apple-iphone-13-pro-max');
  });

  it('renders nothing when the repairs catalogue flag is off', async () => {
    const { container } = render(
      await PdpRepairDeviceLink({
        basePath: '/ogabassey',
        merchant: { ...enabledMerchant, feature_settings: {} },
        productId: 'product-1',
      })
    );

    expect(container).toBeEmptyDOMElement();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('renders nothing when no device links to this product', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { container } = render(
      await PdpRepairDeviceLink({
        basePath: '/ogabassey',
        merchant: enabledMerchant,
        productId: 'product-2',
      })
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing (fails open) when the lookup errors', async () => {
    mockMaybeSingle.mockRejectedValueOnce(new Error('db down'));

    const { container } = render(
      await PdpRepairDeviceLink({
        basePath: '/ogabassey',
        merchant: enabledMerchant,
        productId: 'product-1',
      })
    );

    expect(container).toBeEmptyDOMElement();
  });
});
