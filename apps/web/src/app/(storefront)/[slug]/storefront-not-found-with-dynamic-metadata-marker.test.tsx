import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const calls: string[] = [];

vi.mock('next/navigation', () => ({
  notFound: () => {
    calls.push('notFound');
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import { StorefrontNotFoundWithDynamicMetadataMarker } from './storefront-not-found-with-dynamic-metadata-marker';

describe('StorefrontNotFoundWithDynamicMetadataMarker', () => {
  it('triggers notFound without rendering a body marker', () => {
    calls.length = 0;

    expect(() =>
      render(<StorefrontNotFoundWithDynamicMetadataMarker />)
    ).toThrow('NEXT_NOT_FOUND');

    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((call) => call === 'notFound')).toBe(true);
  });
});
