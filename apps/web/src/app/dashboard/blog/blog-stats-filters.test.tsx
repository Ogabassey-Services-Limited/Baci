import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BlogStatsFilters } from './blog-stats-filters';

describe('BlogStatsFilters', () => {
  it('forwards status, remediation, and search actions', async () => {
    const user = userEvent.setup();
    const onDiscoverRemediation = vi.fn();
    const onSearchChange = vi.fn();
    const onStatusChange = vi.fn();
    render(
      <BlogStatsFilters
        discoverRemediationCount={2}
        onDiscoverRemediation={onDiscoverRemediation}
        onSearchChange={onSearchChange}
        onStatusChange={onStatusChange}
        searchQuery=""
        stats={{ drafts: 2, pageViews: 25, published: 3, total: 5 }}
        statusFilter="all"
      />
    );

    await user.click(screen.getByText('Published'));
    await user.type(screen.getByPlaceholderText('Search posts...'), 'bags');
    await user.click(
      screen.getByRole('button', { name: /update image metadata/i })
    );

    expect(onStatusChange).toHaveBeenCalledWith('published');
    expect(onSearchChange).toHaveBeenLastCalledWith('s');
    expect(onDiscoverRemediation).toHaveBeenCalledOnce();
  });
});
