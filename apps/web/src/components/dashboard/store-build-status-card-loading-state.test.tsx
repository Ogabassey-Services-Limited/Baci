import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StoreBuildStatusCardLoadingState } from './store-build-status-card-loading-state';

describe('StoreBuildStatusCardLoadingState', () => {
  it('renders loading progress', () => {
    render(<StoreBuildStatusCardLoadingState loading />);

    expect(screen.getByText('Checking store build status…')).toBeVisible();
  });

  it('renders a retry action for load failures', () => {
    const retry = vi.fn();
    render(
      <StoreBuildStatusCardLoadingState
        loadError="Failed to load store build status."
        onRetry={retry}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
