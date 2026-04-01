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

import RootLayout from './layout';

describe('RootLayout', () => {
  it('renders the global app shell without request-scoped props', () => {
    render(
      <RootLayout>
        <main>Main content</main>
      </RootLayout>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Main content');
    expect(mockRootDynamicBody).toHaveBeenCalled();
    expect(mockRootDynamicBody.mock.calls[0]?.[0]).toEqual({
      children: expect.anything(),
    });
  });

  it('surfaces RootDynamicBody render failures', () => {
    mockRootDynamicBody.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const onRecoverableError = vi.fn();

    render(
      <RootLayout>
        <main>Main content</main>
      </RootLayout>,
      { onRecoverableError }
    );

    expect(mockRootDynamicBody).toHaveBeenCalled();
    expect(onRecoverableError).toHaveBeenCalled();
    expect(onRecoverableError.mock.calls[0]?.[0]).toMatchObject({
      cause: expect.objectContaining({
        message: 'boom',
      }),
    });
  });
});
