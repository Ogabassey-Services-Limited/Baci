import { render, screen } from '@testing-library/react';
import { isValidElement, type ReactNode, Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoginClient = vi.hoisted(() =>
  vi.fn((props: { defaultEmail: string; redirectTo: string }) => (
    <div>
      <div aria-label="email" role="status">
        email:{props.defaultEmail}
      </div>
      <div aria-label="redirect" role="status">
        redirect:{props.redirectTo}
      </div>
    </div>
  ))
);

vi.mock('@/app/login/login-client', () => ({
  default: mockLoginClient,
}));

import LoginLoadingFallback from '@/app/login/login-loading-fallback';
import LoginPage, { LoginPageContent, metadata } from '@/app/login/page';

describe('LoginPage', () => {
  beforeEach(() => {
    mockLoginClient.mockClear();
  });

  it('passes canonical redirect and email search params to the login client', async () => {
    render(
      await LoginPageContent({
        searchParams: Promise.resolve({
          email: 'admin@example.com',
          redirect: '/admin',
        }),
      })
    );

    expect(screen.getByRole('status', { name: 'email' })).toHaveTextContent(
      'email:admin@example.com'
    );
    expect(screen.getByRole('status', { name: 'redirect' })).toHaveTextContent(
      'redirect:/admin'
    );
  });

  it('prefers canonical redirect over legacy redirectTo', async () => {
    render(
      await LoginPageContent({
        searchParams: Promise.resolve({
          redirect: '/merchant',
          redirectTo: '/admin',
        }),
      })
    );

    expect(screen.getByRole('status', { name: 'redirect' })).toHaveTextContent(
      'redirect:/merchant'
    );
  });

  it('keeps legacy redirectTo compatibility when canonical redirect is absent', async () => {
    render(
      await LoginPageContent({
        searchParams: Promise.resolve({
          redirectTo: '/admin',
        }),
      })
    );

    expect(screen.getByRole('status', { name: 'redirect' })).toHaveTextContent(
      'redirect:/admin'
    );
  });

  it('falls back to dashboard and an empty email when optional params are absent', async () => {
    render(
      await LoginPageContent({
        searchParams: Promise.resolve({}),
      })
    );

    expect(screen.getByRole('status', { name: 'email' })).toHaveTextContent(
      'email:'
    );
    expect(screen.getByRole('status', { name: 'redirect' })).toHaveTextContent(
      'redirect:/dashboard'
    );
  });

  it('handles redirects without an email param', async () => {
    render(
      await LoginPageContent({
        searchParams: Promise.resolve({ redirect: '/dashboard' }),
      })
    );

    expect(screen.getByRole('status', { name: 'email' })).toHaveTextContent(
      'email:'
    );
    expect(screen.getByRole('status', { name: 'redirect' })).toHaveTextContent(
      'redirect:/dashboard'
    );
  });

  it.each([
    ['redirect object', { redirect: { nested: true } }],
    ['redirect null', { redirect: null }],
    ['email object', { email: { nested: true }, redirect: '/admin' }],
    ['email null', { email: null, redirect: '/admin' }],
    ['very long redirect', { redirect: `/${'a'.repeat(5000)}` }],
  ])('handles malformed %s search params without crashing', async (_label, params) => {
    render(
      await LoginPageContent({
        searchParams: Promise.resolve(
          params as Record<string, string | string[] | undefined>
        ),
      })
    );

    expect(screen.getByRole('status', { name: 'email' })).toHaveTextContent(
      /^email:/
    );
    expect(screen.getByRole('status', { name: 'redirect' })).toHaveTextContent(
      /^redirect:/
    );
  });

  it('uses the first redirect and email value when search params are arrays', async () => {
    render(
      await LoginPageContent({
        searchParams: Promise.resolve({
          email: ['first@example.com', 'second@example.com'],
          redirect: ['/admin', '/dashboard'],
        }),
      })
    );

    expect(screen.getByRole('status', { name: 'email' })).toHaveTextContent(
      'email:first@example.com'
    );
    expect(screen.getByRole('status', { name: 'redirect' })).toHaveTextContent(
      'redirect:/admin'
    );
  });

  it('sanitizes unsafe redirect search params on the server', async () => {
    render(
      await LoginPageContent({
        searchParams: Promise.resolve({
          redirect: 'https://evil.example/admin',
        }),
      })
    );

    expect(screen.getByRole('status', { name: 'redirect' })).toHaveTextContent(
      'redirect:/dashboard'
    );
  });

  it('surfaces rejected search params instead of masking the failure', async () => {
    await expect(
      LoginPageContent({
        searchParams: Promise.reject(new Error('search params failed')),
      })
    ).rejects.toThrow('search params failed');
  });

  it('wraps request search params in the login loading boundary', () => {
    const element = LoginPage({ searchParams: Promise.resolve({}) });

    expect(isValidElement<{ fallback: ReactNode }>(element)).toBe(true);
    if (!isValidElement<{ fallback: ReactNode }>(element)) {
      throw new Error('Expected login page to return a React element');
    }

    expect(element.type).toBe(Suspense);
    expect(element.props.fallback).toEqual(<LoginLoadingFallback />);
  });

  it('marks the route as noindex to keep auth pages out of Search Console', () => {
    expect(metadata.robots).not.toBeNull();
    expect(typeof metadata.robots).toBe('object');
    expect(metadata.robots).toEqual(
      expect.objectContaining({
        index: false,
        follow: false,
      })
    );
  });
});
