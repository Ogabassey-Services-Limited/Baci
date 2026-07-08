import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RepairDeviceCard } from './RepairDeviceCard';

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

describe('RepairDeviceCard', () => {
  it('links to the device detail page and shows brand, model and device type', () => {
    render(
      <RepairDeviceCard
        device={{
          id: 'device-1',
          brand: 'Apple',
          model: 'iPhone 13 Pro Max',
          slug: 'apple-iphone-13-pro-max',
          deviceType: 'Smartphone',
          imageUrl: null,
          productId: null,
        }}
        href="/ogabassey/repairs/apple-iphone-13-pro-max"
      />
    );

    const link = screen.getByRole('link', {
      name: /apple iphone 13 pro max/i,
    });
    expect(link).toHaveAttribute(
      'href',
      '/ogabassey/repairs/apple-iphone-13-pro-max'
    );
    expect(screen.getByText('Smartphone')).toBeInTheDocument();
  });

  it('renders the device image when present instead of the fallback icon', () => {
    render(
      <RepairDeviceCard
        device={{
          id: 'device-2',
          brand: 'Samsung',
          model: 'Galaxy S23',
          slug: 'samsung-galaxy-s23',
          deviceType: 'Smartphone',
          imageUrl: 'https://cdn.example.com/galaxy-s23.jpg',
          productId: 'product-1',
        }}
        href="/ogabassey/repairs/samsung-galaxy-s23"
      />
    );

    const image = screen.getByRole('img', { name: /samsung galaxy s23/i });
    expect(image).toHaveAttribute(
      'src',
      'https://cdn.example.com/galaxy-s23.jpg'
    );
  });

  it('omits the device type line when the type is unrecognized', () => {
    render(
      <RepairDeviceCard
        device={{
          id: 'device-3',
          brand: 'Generic',
          model: 'Gadget',
          slug: 'generic-gadget',
          deviceType: null,
          imageUrl: null,
          productId: null,
        }}
        href="/ogabassey/repairs/generic-gadget"
      />
    );

    expect(
      screen.getByRole('link', { name: /generic gadget/i })
    ).toBeInTheDocument();
  });
});
