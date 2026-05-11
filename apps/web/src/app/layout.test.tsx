import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRootDynamicBody = vi.fn(({ children }: { children: ReactNode }) => (
  <>{children}</>
));

vi.mock('next/font/google', () => ({
  Inter: () => ({
    variable: 'font-inter',
  }),
}));

vi.mock('@/app/root-dynamic-body', () => ({
  RootDynamicBody: (props: { children: ReactNode }) =>
    mockRootDynamicBody(props),
}));

import RootLayout from '@/app/layout';

describe('RootLayout', () => {
  beforeEach(() => {
    mockRootDynamicBody.mockReset();
    mockRootDynamicBody.mockImplementation(
      ({ children }: { children: ReactNode }) => <>{children}</>
    );
  });

  it('renders the global app shell through the root dynamic body', () => {
    render(
      <RootLayout>
        <main>Main content</main>
      </RootLayout>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Main content');
    expect(mockRootDynamicBody).toHaveBeenCalledTimes(1);
    expect(mockRootDynamicBody.mock.calls[0]?.[0]).toEqual({
      children: expect.anything(),
    });
  });

  it('renders a root fallback while the dynamic body is pending', () => {
    mockRootDynamicBody.mockImplementation(() => {
      throw new Promise(() => {
        // Intentionally unresolved to keep the suspense fallback visible.
      });
    });

    render(
      <RootLayout>
        <main>Main content</main>
      </RootLayout>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading application');
  });
});
