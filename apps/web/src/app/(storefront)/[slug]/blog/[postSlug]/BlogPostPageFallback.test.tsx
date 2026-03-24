import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./BlogPostBodyFallback', () => ({
  BlogPostBodyFallback: () => <div data-testid="body-fallback" />,
}));

import { BlogPostPageFallback } from './BlogPostPageFallback';

describe('BlogPostPageFallback', () => {
  it('renders skeleton structure', () => {
    const { container } = render(<BlogPostPageFallback />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('includes the body fallback component', () => {
    const { getByTestId } = render(<BlogPostPageFallback />);
    expect(getByTestId('body-fallback')).toBeInTheDocument();
  });
});
