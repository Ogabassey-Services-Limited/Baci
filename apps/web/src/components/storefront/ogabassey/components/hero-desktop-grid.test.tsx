import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  } & Record<string, unknown>) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img
      {...Object.fromEntries(
        Object.entries(props).filter(
          ([key]) => key !== 'fill' && key !== 'priority'
        )
      )}
      alt={String(props.alt ?? '')}
      data-priority={String(Boolean(props.priority))}
    />
  ),
}));

import {
  FLASH_SALE_PROMO_IMAGE,
  NEW_ARRIVALS_PROMO_IMAGE,
} from './hero-data';
import { HeroDesktopGrid } from './hero-desktop-grid';

describe('HeroDesktopGrid', () => {
  it('disables prefetch on desktop hero links', () => {
    render(<HeroDesktopGrid getHref={(path) => `/ogabassey${path}`} />);

    for (const link of screen.getAllByRole('link', { name: /shop now|view specs/i })) {
      expect(link).toHaveAttribute('data-prefetch', 'false');
    }
  });

  it('allows desktop slide selection through the indicators', () => {
    render(<HeroDesktopGrid getHref={(path) => `/ogabassey${path}`} />);

    fireEvent.click(screen.getByRole('button', { name: /go to slide 2/i }));

    expect(screen.getByRole('button', { name: /go to slide 2/i })).toBeInTheDocument();
  });

  it('uses valid local assets for the secondary promo panels', () => {
    const { container } = render(
      <HeroDesktopGrid getHref={(path) => `/ogabassey${path}`} />
    );
    const sources = Array.from(container.querySelectorAll('img')).map((image) =>
      image.getAttribute('src')
    );

    expect(sources).toEqual(
      expect.not.arrayContaining([
        'https://cdn.ogabassey.com/products/flash-sale-banner.avif',
        'https://cdn.ogabassey.com/products/new-arrivals-banner.avif',
      ])
    );
    expect(sources).toEqual(
      expect.arrayContaining([
        FLASH_SALE_PROMO_IMAGE,
        NEW_ARRIVALS_PROMO_IMAGE,
      ])
    );
  });
});
