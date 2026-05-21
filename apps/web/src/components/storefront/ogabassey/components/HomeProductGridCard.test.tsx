import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img {...props} alt={String(props.alt ?? '')} />
  ),
}));

import { HomeProductGridCard } from './HomeProductGridCard';

const baseProduct: Product = {
  id: 'product-1',
  name: 'iPhone 17 Pro Max',
  price: '₦2,100,000',
  image: '/iphone.jpg',
  category: 'Smartphones',
  slug: 'iphone-17-pro-max',
  categories: {
    id: 'cat-smartphones',
    name: 'Smartphones',
    slug: 'smartphones',
  },
  description: 'Flagship phone with top-tier camera and performance.',
  condition: 'New',
  images: ['/iphone-black.jpg'],
};

describe('HomeProductGridCard', () => {
  let observerCallback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }

      observe() {
        return;
      }

      disconnect() {
        return;
      }

      unobserve() {
        return;
      }

      takeRecords() {
        return [];
      }
    }

    global.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    observerCallback = null;
    delete (
      globalThis as { IntersectionObserver?: typeof IntersectionObserver }
    ).IntersectionObserver;
  });

  it('links to the storefront product details route', () => {
    render(<HomeProductGridCard basePath="/ogabassey" product={baseProduct} />);

    expect(screen.getByRole('link', { name: /iPhone 17 Pro Max/i })).toHaveAttribute(
      'href',
      '/ogabassey/smartphones/iphone-17-pro-max'
    );
  });

  it('waits to mount deferred images until the card is near the viewport', () => {
    render(<HomeProductGridCard product={baseProduct} deferImageLoading={true} />);

    expect(screen.queryByAltText(baseProduct.name)).not.toBeInTheDocument();

    act(() => {
      observerCallback?.(
        [
          {
            isIntersecting: true,
            target: screen.getByText(baseProduct.name),
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    });

    expect(screen.getByAltText(baseProduct.name)).toBeInTheDocument();
  });

  it('keeps lazy product images visible after they load', () => {
    const globalsCss = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

    expect(globalsCss).not.toMatch(
      /img\[loading="lazy"\]\s*{[^}]*opacity:\s*0\b/s
    );
  });
});
