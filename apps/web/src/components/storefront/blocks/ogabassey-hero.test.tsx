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

    consoleError.mockRestore();
  });
});
