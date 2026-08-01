import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlogPostStatusBadge } from './blog-post-status-badge';

describe('BlogPostStatusBadge', () => {
  it.each([
    ['published', 'Published'],
    ['archived', 'Archived'],
    ['draft', 'Draft'],
  ] as const)('renders the %s publication status', (status, label) => {
    render(<BlogPostStatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
