import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockRootDynamicBodyWithRequestProps = vi.fn(
  ({ children }: { children: ReactNode }) => <>{children}</>
);

vi.mock('next/font/google', () => ({
  Inter: () => ({
    variable: 'font-inter',
  }),
}));

vi.mock('@/app/root-dynamic-body-with-request-props', () => ({
  RootDynamicBodyWithRequestProps: (props: { children: ReactNode }) =>
    mockRootDynamicBodyWithRequestProps(props),
}));

import RootLayout from '@/app/layout';

describe('RootLayout', () => {
  afterEach(() => {
    mockRootDynamicBodyWithRequestProps.mockClear();
  });

  it('renders the global app shell through the request-props wrapper', () => {
    render(
      <RootLayout>
        <main>Main content</main>
      </RootLayout>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Main content');
    expect(mockRootDynamicBodyWithRequestProps).toHaveBeenCalledTimes(1);
    expect(mockRootDynamicBodyWithRequestProps.mock.calls[0]?.[0]).toEqual({
      children: expect.anything(),
    });
  });
});
