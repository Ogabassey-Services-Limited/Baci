import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({ default: () => 'img' }));
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

import { OgabasseyHero } from './ogabassey-hero';

describe('OgabasseyHero', () => {
  it('exports a valid component', () => {
    expect(OgabasseyHero).toBeDefined();
    expect(typeof OgabasseyHero).toBe('function');
  });

  it('renders generated placeholder slides without duplicate key warnings', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    // `try`/`finally` guarantees the spy is always restored even if an
    // assertion above throws — otherwise the spy would leak into later tests.
    try {
      render(
        <OgabasseyHero
          slides={[
            { image: '/placeholder.png', title: 'Welcome' },
            { image: '/placeholder.png', title: 'New Arrivals' },
          ]}
        />
      );

      expect(
        consoleError.mock.calls.some(([message]) =>
          String(message).includes('Encountered two children with the same key')
        )
      ).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('renders duplicate placeholder slides without duplicate key warnings', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      // Same image + same (missing) title would previously collide under the
      // old content-hash-only key. The index-prefixed key keeps them unique.
      render(
        <OgabasseyHero
          slides={[
            { image: '/placeholder.png' },
            { image: '/placeholder.png' },
            { image: '/placeholder.png' },
          ]}
        />
      );

      expect(
        consoleError.mock.calls.some(([message]) =>
          String(message).includes('Encountered two children with the same key')
        )
      ).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });
});
