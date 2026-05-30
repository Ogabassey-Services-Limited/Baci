import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const calls: string[] = [];

vi.mock('next/navigation', () => ({
  notFound: () => {
    calls.push('notFound');
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import { StorefrontRouteNotFound } from './storefront-route-not-found';

describe('StorefrontRouteNotFound', () => {
  it('triggers notFound without rendering a body placeholder', () => {
    calls.length = 0;

    expect(() => render(<StorefrontRouteNotFound />)).toThrow('NEXT_NOT_FOUND');

    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((call) => call === 'notFound')).toBe(true);
  });
});
