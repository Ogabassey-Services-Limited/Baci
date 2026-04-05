import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

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
  it('renders the global app shell through the request-props wrapper', () => {
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
});
