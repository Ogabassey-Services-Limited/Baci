import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const calls: string[] = [];

vi.mock('next/navigation', () => ({
  notFound: () => {
    calls.push('notFound');
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('./storefront-dynamic-metadata-marker', () => ({
  StorefrontDynamicMetadataMarker: () => {
    calls.push('marker');
    return <div aria-label="dynamic metadata marker" role="status" />;
  },
}));

import { StorefrontNotFoundWithDynamicMetadataMarker } from './storefront-not-found-with-dynamic-metadata-marker';

describe('StorefrontNotFoundWithDynamicMetadataMarker', () => {
  it('renders the dynamic metadata marker before triggering notFound', () => {
    calls.length = 0;

    expect(() =>
      render(<StorefrontNotFoundWithDynamicMetadataMarker />)
    ).toThrow('NEXT_NOT_FOUND');

    expect(calls).toContain('marker');
    expect(calls).toContain('notFound');
    expect(calls.indexOf('marker')).toBeLessThan(calls.indexOf('notFound'));
  });
});
