import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRootDynamicBody } = vi.hoisted(() => ({
  mockRootDynamicBody: vi.fn((props?: Record<string, never>) => {
    void props;
    return <div data-testid="root-dynamic-body" />;
  }),
}));

vi.mock('next/font/google', () => ({
  Inter: () => ({
    variable: 'font-inter',
  }),
}));

vi.mock('@/app/root-dynamic-body', () => ({
  RootDynamicBody: mockRootDynamicBody,
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="root-toaster" />,
}));

import RootLayout from '@/app/layout';

describe('RootLayout', () => {
  beforeEach(() => {
    mockRootDynamicBody.mockReset();
  });

  it('renders the page shell beside the root dynamic body', () => {
    render(
      <RootLayout>
        <main>Main content</main>
      </RootLayout>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Main content');
    expect(screen.getByTestId('root-toaster')).toBeInTheDocument();
    expect(screen.getByTestId('root-dynamic-body')).toBeInTheDocument();
    expect(mockRootDynamicBody).toHaveBeenCalledTimes(1);
    expect(mockRootDynamicBody.mock.calls[0]?.[0]).toEqual({});
  });

  it('keeps the page shell visible when root dynamic providers suspend', () => {
    mockRootDynamicBody.mockImplementation(() => {
      throw new Promise(() => {
        // Intentionally unresolved to verify the root layout does not catch
        // the page shell behind a global loading screen.
      });
    });

    render(
      <RootLayout>
        <main>Main content</main>
      </RootLayout>
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Loading application...')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('root-toaster')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Main content');
  });
});
