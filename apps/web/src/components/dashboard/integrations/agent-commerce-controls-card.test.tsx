import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, apiPatch } from '@/lib/api-client';
import { AgentCommerceControlsCard } from './agent-commerce-controls-card';

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
}));

describe('AgentCommerceControlsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and displays the current agent checkout setting', async () => {
    vi.mocked(apiGet).mockResolvedValue({
      agentic_checkout_enabled: true,
    });

    render(<AgentCommerceControlsCard />);

    const toggle = await screen.findByRole('switch', {
      name: /agent checkout/i,
    });

    expect(toggle).toBeChecked();
    expect(screen.getByText('Accepting agent checkouts')).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/api/merchant/features');
  });

  it('shows the paused state when agent checkout is disabled', async () => {
    vi.mocked(apiGet).mockResolvedValue({
      agentic_checkout_enabled: false,
    });

    render(<AgentCommerceControlsCard />);

    const toggle = await screen.findByRole('switch', {
      name: /agent checkout/i,
    });

    expect(toggle).not.toBeChecked();
    expect(screen.getByText('Agent checkout paused')).toBeInTheDocument();
  });

  it('shows an error state when controls cannot be loaded', async () => {
    vi.mocked(apiGet).mockRejectedValue(
      new Error('Unable to load agent checkout controls')
    );

    render(<AgentCommerceControlsCard />);

    expect(
      await screen.findByText('Unable to load agent checkout controls')
    ).toBeInTheDocument();
  });

  it('persists disabled state through the merchant features API', async () => {
    const user = userEvent.setup();
    vi.mocked(apiGet).mockResolvedValue({
      agentic_checkout_enabled: true,
    });
    vi.mocked(apiPatch).mockResolvedValue({
      agentic_checkout_enabled: false,
    });

    render(<AgentCommerceControlsCard />);

    const toggle = await screen.findByRole('switch', {
      name: /agent checkout/i,
    });
    await user.click(toggle);

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/api/merchant/features', {
        agentic_checkout_enabled: false,
      })
    );
    expect(toggle).not.toBeChecked();
    expect(screen.getByText('Agent checkout paused')).toBeInTheDocument();
  });

  it('persists enabled state through the merchant features API', async () => {
    const user = userEvent.setup();
    vi.mocked(apiGet).mockResolvedValue({
      agentic_checkout_enabled: false,
    });
    vi.mocked(apiPatch).mockResolvedValue({
      agentic_checkout_enabled: true,
    });

    render(<AgentCommerceControlsCard />);

    const toggle = await screen.findByRole('switch', {
      name: /agent checkout/i,
    });
    await user.click(toggle);

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/api/merchant/features', {
        agentic_checkout_enabled: true,
      })
    );
    expect(toggle).toBeChecked();
    expect(screen.getByText('Accepting agent checkouts')).toBeInTheDocument();
  });

  it('rolls back the toggle and shows an error when saving fails', async () => {
    const user = userEvent.setup();
    vi.mocked(apiGet).mockResolvedValue({
      agentic_checkout_enabled: true,
    });
    vi.mocked(apiPatch).mockRejectedValue(new Error('Unable to save setting'));

    render(<AgentCommerceControlsCard />);

    const toggle = await screen.findByRole('switch', {
      name: /agent checkout/i,
    });
    await user.click(toggle);

    expect(
      await screen.findByText('Unable to save setting')
    ).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });
});
