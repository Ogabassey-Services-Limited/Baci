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
});
