import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RepairDevicePicker } from './RepairDevicePicker';

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

const groups = [
  {
    brand: 'Apple',
    devices: [
      {
        id: 'd1',
        brand: 'Apple',
        model: 'iPhone 13 Pro Max',
        slug: 'apple-iphone-13-pro-max',
        deviceType: 'Smartphone' as const,
        imageUrl: null,
        productId: null,
      },
      {
        id: 'd2',
        brand: 'Apple',
        model: 'MacBook Pro 14',
        slug: 'apple-macbook-pro-14',
        deviceType: 'Laptop' as const,
        imageUrl: null,
        productId: null,
      },
    ],
  },
  {
    brand: 'Samsung',
    devices: [
      {
        id: 'd3',
        brand: 'Samsung',
        model: 'Galaxy S23',
        slug: 'samsung-galaxy-s23',
        deviceType: 'Smartphone' as const,
        imageUrl: null,
        productId: null,
      },
    ],
  },
];

describe('RepairDevicePicker', () => {
  it('renders every device across all brands by default', () => {
    render(
      <RepairDevicePicker
        basePath="/ogabassey"
        groups={groups}
        notListedHref="/ogabassey/repair"
      />
    );

    expect(
      screen.getByRole('link', { name: /iphone 13 pro max/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /macbook pro 14/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /galaxy s23/i })
    ).toBeInTheDocument();
  });

  it('filters devices to a single brand when a brand chip is selected', async () => {
    const user = userEvent.setup();
    render(
      <RepairDevicePicker
        basePath="/ogabassey"
        groups={groups}
        notListedHref="/ogabassey/repair"
      />
    );

    await user.click(screen.getByRole('button', { name: 'Samsung' }));

    expect(
      screen.queryByRole('link', { name: /iphone 13 pro max/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /galaxy s23/i })
    ).toBeInTheDocument();
  });

  it('filters devices by search query across brand and model', async () => {
    const user = userEvent.setup();
    render(
      <RepairDevicePicker
        basePath="/ogabassey"
        groups={groups}
        notListedHref="/ogabassey/repair"
      />
    );

    await user.type(
      screen.getByRole('searchbox', { name: /search devices/i }),
      'macbook'
    );

    expect(
      screen.getByRole('link', { name: /macbook pro 14/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /galaxy s23/i })
    ).not.toBeInTheDocument();
  });

  it('shows an empty state with the not-listed CTA when nothing matches', async () => {
    const user = userEvent.setup();
    render(
      <RepairDevicePicker
        basePath="/ogabassey"
        groups={groups}
        notListedHref="/ogabassey/repair"
      />
    );

    await user.type(
      screen.getByRole('searchbox', { name: /search devices/i }),
      'nokia 3310'
    );

    expect(screen.getByText(/no devices found/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /describe your repair/i })[0]
    ).toHaveAttribute('href', '/ogabassey/repair');
  });

  it('always renders a device-not-listed fallback link even with results', () => {
    render(
      <RepairDevicePicker
        basePath="/ogabassey"
        groups={groups}
        notListedHref="/ogabassey/repair"
      />
    );

    expect(
      screen.getByRole('link', { name: /describe your repair/i })
    ).toHaveAttribute('href', '/ogabassey/repair');
  });

  it('renders a friendly message when the catalogue has no devices at all', () => {
    render(
      <RepairDevicePicker
        basePath="/ogabassey"
        groups={[]}
        notListedHref="/ogabassey/repair"
      />
    );

    expect(screen.getByText(/no devices found/i)).toBeInTheDocument();
  });
});
