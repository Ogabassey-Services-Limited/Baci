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

vi.mock('./root-dynamic-body', () => ({
  RootDynamicBody: (props: { children: ReactNode }) =>
    mockRootDynamicBody(props),
}));

import RootLayout from './layout';

describe('RootLayout', () => {
  it('renders the global app shell without request-scoped props', () => {
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
