import { act, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(min-width: 768px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: () => ({ basePath: '/ogabassey' }),
}));

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
    />
  ),
}));

vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();

    if (source.includes('hero-desktop-grid')) {
      return () => <div data-testid="desktop-hero-grid">Desktop hero</div>;
    }

    return () => null;
  },
}));

vi.mock('./hero-utility-panel', () => ({
  HeroUtilityPanel: () => <div data-testid="utility-panel">Utility panel</div>,
}));

vi.mock('./AdUnit', () => ({
  AdUnit: ({ placementKey }: { placementKey: string }) => (
    <div data-testid={`ad-${placementKey}`} />
  ),
}));

import { Hero } from './Hero';

describe('Hero', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders the utility panel chunk in the hero shell', () => {
    render(<Hero />);

    expect(screen.getByTestId('utility-panel')).toBeInTheDocument();
  });

  it('loads the desktop hero chunk only after desktop viewport detection', () => {
    mockMatchMedia(true);

    render(<Hero />);

    expect(screen.getByTestId('desktop-hero-grid')).toBeInTheDocument();
  });

});
