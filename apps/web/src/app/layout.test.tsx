import { render, screen } from '@testing-library/react';
import * as ReactDOM from 'react-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRootDynamicBody } = vi.hoisted(() => ({
  mockRootDynamicBody: vi.fn((props?: Record<string, never>) => {
    void props;
    return <div data-testid="root-dynamic-body" />;
  }),
}));

vi.mock('next/font/google', () => ({
  Inter: () => ({
    variable: 'font-inter',
  }),
}));

vi.mock('next/font/local', () => ({
  default: () => ({
    variable: 'font-naira',
  }),
}));

vi.mock('@/app/root-dynamic-body', () => ({
  RootDynamicBody: mockRootDynamicBody,
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="root-toaster" />,
}));

import RootLayout from '@/app/layout';

const prefetchDNSSpy = vi
  .spyOn(ReactDOM, 'prefetchDNS')
  .mockImplementation(() => undefined);

describe('RootLayout', () => {
  beforeEach(() => {
    mockRootDynamicBody.mockReset();
    prefetchDNSSpy.mockClear();
  });

  it('renders the page shell beside the root dynamic body', () => {
    render(
      <RootLayout>
        <main>Main content</main>
      </RootLayout>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Main content');
    expect(screen.getByTestId('root-toaster')).toBeInTheDocument();
    expect(screen.getByTestId('root-dynamic-body')).toBeInTheDocument();
    expect(mockRootDynamicBody).toHaveBeenCalledTimes(1);
    expect(mockRootDynamicBody.mock.calls[0]?.[0]).toEqual({});
  });

  it('applies the Inter and naira-subset font variables to the body', () => {
    render(
      <RootLayout>
        <main>Main content</main>
      </RootLayout>
    );

    expect(document.body.className).toContain('font-inter');
    expect(document.body.className).toContain('font-naira');
  });

  it('keeps the page shell visible when root dynamic providers suspend', () => {
    mockRootDynamicBody.mockImplementation(() => {
      throw new Promise(() => {
        // Intentionally unresolved to verify the root layout does not catch
        // the page shell behind a global loading screen.
      });
    });

    render(
      <RootLayout>
        <main>Main content</main>
      </RootLayout>
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Loading application...')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('root-toaster')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Main content');
  });

  it('keeps tenant-specific CDN hints out of the global document head', () => {
    const { container } = render(
      <RootLayout>
        <main>Main content</main>
      </RootLayout>
    );

    expect(
      container.querySelector(
        'link[rel="dns-prefetch"][href="https://cdn.ogabassey.com"]'
      )
    ).toBeNull();
    expect(
      container.querySelector(
        'link[rel="preconnect"][href="https://cdn.ogabassey.com"]'
      )
    ).toBeNull();
  });

  it('renders without a manual head tag in the root layout shell', () => {
    const { container } = render(
      <RootLayout>
        <main>Main content</main>
      </RootLayout>
    );

    expect(container.querySelector('head')).toBeNull();
  });

  it('does not emit a stale global DNS prefetch hint for Cloudinary images', () => {
    render(
      <RootLayout>
        <main>Main content</main>
      </RootLayout>
    );

    expect(prefetchDNSSpy).not.toHaveBeenCalledWith(
      'https://res.cloudinary.com'
    );
  });
});
