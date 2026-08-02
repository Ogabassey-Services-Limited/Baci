import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BlogPagination } from './blog-pagination';

describe('BlogPagination', () => {
  it('shows the page range and applies bounded page changes', async () => {
    const user = userEvent.setup();
    const setPage = vi.fn();
    render(<BlogPagination hasMore page={2} setPage={setPage} total={45} />);

    expect(
      screen.getByText('Showing 21 to 40 of 45 results')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(setPage.mock.calls[0]?.[0](2)).toBe(1);
    expect(setPage.mock.calls[1]?.[0](2)).toBe(3);
  });

  it('disables unavailable navigation', () => {
    render(
      <BlogPagination hasMore={false} page={1} setPage={vi.fn()} total={0} />
    );

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
