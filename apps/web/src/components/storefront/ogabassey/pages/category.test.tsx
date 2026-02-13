import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({ default: () => 'img' }));
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

import { OgabasseyV2CategoryPage } from './category';

describe('OgabasseyV2CategoryPage', () => {
  it('exports a valid component', () => {
    expect(OgabasseyV2CategoryPage).toBeDefined();
    expect(typeof OgabasseyV2CategoryPage).toBe('function');
  });
});
