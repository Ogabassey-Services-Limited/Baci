import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RepairDeviceDetailView } from './RepairDeviceDetailView';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  // biome-ignore lint/a11y/useAltText: alt is spread through props by the caller
  // biome-ignore lint/performance/noImgElement: mock implementation requires img
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

const device = {
  id: 'device-1',
  brand: 'Apple',
  model: 'iPhone 13 Pro Max',
  slug: 'apple-iphone-13-pro-max',
  deviceType: 'Smartphone' as const,
  imageUrl: null,
  productId: null,
};

const quotes = [
  {
    id: 'quote-1',
    serviceTypeId: 'st-1',
    serviceTypeName: 'Screen Replacement',
    price: 25000,
    isFromPrice: true,
    partQuality: 'OEM',
    turnaround: null,
    warrantyDays: null,
    description: null,
  },
  {
    id: 'quote-2',
    serviceTypeId: 'st-2',
    serviceTypeName: 'Battery Replacement',
    price: 15000,
    isFromPrice: false,
    partQuality: null,
    turnaround: null,
    warrantyDays: null,
    description: null,
  },
];

describe('RepairDeviceDetailView', () => {
  it('renders the device name, brand and type in the header', () => {
    render(
      <RepairDeviceDetailView
        basePath="/ogabassey"
        currency="NGN"
        detail={{ device, quotes, product: null }}
      />
    );

    expect(
      screen.getByRole('heading', { name: /apple iphone 13 pro max/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Smartphone')).toBeInTheDocument();
  });

  it('renders a quote card per active quote with correct booking links', () => {
    render(
      <RepairDeviceDetailView
        basePath="/ogabassey"
        currency="NGN"
        detail={{ device, quotes, product: null }}
      />
    );

    expect(screen.getByText('Screen Replacement')).toBeInTheDocument();
    expect(screen.getByText('Battery Replacement')).toBeInTheDocument();

    const bookLinks = screen.getAllByRole('link', {
      name: /book this repair/i,
    });
    expect(bookLinks[0]).toHaveAttribute(
      'href',
      '/ogabassey/repair?device=apple-iphone-13-pro-max&quote=quote-1'
    );
    expect(bookLinks[1]).toHaveAttribute(
      'href',
      '/ogabassey/repair?device=apple-iphone-13-pro-max&quote=quote-2'
    );
  });

  it('shows the linked product specs snippet and a View device link when a product is linked', () => {
    render(
      <RepairDeviceDetailView
        basePath="/ogabassey"
        currency="NGN"
        detail={{
          device: { ...device, productId: 'product-1' },
          quotes,
          product: {
            id: 'product-1',
            slug: 'apple-iphone-13-pro-max-256gb',
            name: 'iPhone 13 Pro Max 256GB',
            imageUrl: 'https://cdn.example.com/iphone.jpg',
            keySpecs: [
              { label: 'Display', value: '6.7"' },
              { label: 'Storage', value: '256GB' },
            ],
          },
        }}
      />
    );

    expect(screen.getByText('Display')).toBeInTheDocument();
    expect(screen.getByText('6.7"')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view device/i })).toHaveAttribute(
      'href',
      '/ogabassey/products/apple-iphone-13-pro-max-256gb'
    );
  });

  it('omits the product section entirely when no product is linked', () => {
    render(
      <RepairDeviceDetailView
        basePath="/ogabassey"
        currency="NGN"
        detail={{ device, quotes, product: null }}
      />
    );

    expect(
      screen.queryByRole('link', { name: /view device/i })
    ).not.toBeInTheDocument();
  });

  it('renders a friendly empty state and a free-text fallback link when there are no active quotes', () => {
    render(
      <RepairDeviceDetailView
        basePath="/ogabassey"
        currency="NGN"
        detail={{ device, quotes: [], product: null }}
      />
    );

    expect(screen.getByText(/no repair options/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /describe your repair/i })
    ).toHaveAttribute(
      'href',
      '/ogabassey/repair?device=apple-iphone-13-pro-max'
    );
  });

  it('links back to the full device catalogue', () => {
    render(
      <RepairDeviceDetailView
        basePath="/ogabassey"
        currency="NGN"
        detail={{ device, quotes, product: null }}
      />
    );

    expect(screen.getByRole('link', { name: /all devices/i })).toHaveAttribute(
      'href',
      '/ogabassey/repairs'
    );
  });
});
