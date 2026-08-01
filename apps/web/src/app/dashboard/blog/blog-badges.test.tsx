import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlogDiscoverReadinessBadge } from './blog-discover-readiness-badge';
import { BlogPostStatusBadge } from './blog-post-status-badge';

describe('blog badges', () => {
  it.each([
    ['published', 'Published'],
    ['archived', 'Archived'],
    ['draft', 'Draft'],
  ] as const)('renders the %s post status label', (status, label) => {
    render(<BlogPostStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('renders a remediation label for a Discover issue', () => {
    render(<BlogDiscoverReadinessBadge state="missing_landscape_variant" />);
    expect(screen.getByText('Missing 16:9 variant')).toBeInTheDocument();
  });
});
