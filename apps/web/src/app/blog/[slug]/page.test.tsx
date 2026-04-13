import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSingle = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              single: (...args: unknown[]) => mockSingle(...args),
            }),
          }),
        }),
      }),
    }),
  })),
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => null,
  Calendar: () => null,
  Clock: () => null,
  Eye: () => null,
}));

vi.mock('next/image', () => ({
  default: () => null,
}));

vi.mock('next/link', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

vi.mock('@/components/app-body', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/platform/footer', () => ({
  PlatformFooter: () => null,
}));

vi.mock('@/components/platform/header', () => ({
  PlatformHeader: () => null,
}));

vi.mock('@/components/ui/safe-html', () => ({
  SafeHtml: () => null,
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (value: string) => value,
}));

import BlogPostPage from './page';

describe('platform blog post page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the local page fallback while the post query is pending', () => {
    mockSingle.mockReturnValue(
      new Promise(() => {
        // Keep the page content pending so the Suspense fallback renders.
      })
    );

    render(
      <BlogPostPage
        params={Promise.resolve({
          slug: 'test-post',
        })}
      />
    );

    expect(screen.getByText('Loading article…')).toBeInTheDocument();
  });
});
