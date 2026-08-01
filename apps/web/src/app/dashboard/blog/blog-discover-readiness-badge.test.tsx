import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlogDiscoverReadinessBadge } from './blog-discover-readiness-badge';

describe('BlogDiscoverReadinessBadge', () => {
  it.each([
    ['ready', 'Discover ready'],
    ['missing_featured_image', 'Needs featured image'],
    ['missing_landscape_variant', 'Missing 16:9 variant'],
    ['unmanaged_featured_image', 'Needs managed image'],
    ['legacy_missing_metadata', 'Missing image metadata'],
  ] as const)('explains the %s Discover readiness state', (state, label) => {
    render(<BlogDiscoverReadinessBadge state={state} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
