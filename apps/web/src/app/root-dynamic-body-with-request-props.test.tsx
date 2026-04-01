import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockHeaders = new Headers();
const mockRootDynamicBody = vi.fn(
  ({
    children,
  }: {
    children: ReactNode;
    forcedTheme?: string;
    nonce?: string;
  }) => <>{children}</>
);

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeaders),
}));

vi.mock('@/app/root-dynamic-body', () => ({
  RootDynamicBody: (props: {
    children: ReactNode;
    forcedTheme?: string;
    nonce?: string;
  }) => mockRootDynamicBody(props),
  isStorefrontRequest: (headersList: Headers) =>
    Boolean(
      headersList.get('x-merchant-slug') || headersList.get('x-custom-domain')
    ),
}));

import { RootDynamicBodyWithRequestProps } from '@/app/root-dynamic-body-with-request-props';

describe('RootDynamicBodyWithRequestProps', () => {
  beforeEach(() => {
    mockHeaders = new Headers();
    mockRootDynamicBody.mockClear();
  });

  it('forwards nonce and storefront theme derived from request headers', async () => {
    mockHeaders = new Headers({
      'x-merchant-slug': 'ogabassey',
      'x-nonce': 'nonce-123',
    });

    render(
      await RootDynamicBodyWithRequestProps({
        children: <main>Main content</main>,
      })
    );

    expect(screen.getByRole('main')).toHaveTextContent('Main content');
    expect(mockRootDynamicBody).toHaveBeenCalledWith({
      children: expect.anything(),
      forcedTheme: 'light',
      nonce: 'nonce-123',
    });
  });

  it('leaves nonce and forcedTheme undefined for non-storefront requests', async () => {
    render(
      await RootDynamicBodyWithRequestProps({
        children: <main>Main content</main>,
      })
    );

    expect(mockRootDynamicBody).toHaveBeenCalledWith({
      children: expect.anything(),
      forcedTheme: undefined,
      nonce: undefined,
    });
  });
});
