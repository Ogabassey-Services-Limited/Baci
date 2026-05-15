import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPatch } from '@/lib/api-client';
import { AgentCommerceControlsCard } from './agent-commerce-controls-card';

vi.mock('@/lib/api-client', () => ({
  apiPatch: vi.fn(),
}));

describe('AgentCommerceControlsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the current agent checkout setting from server data', () => {
    render(
      <AgentCommerceControlsCard
        initialCustomSettings={{
          agentic_agent_allowlist: ['OpenAI-Agent', 'Perplexity'],
          agentic_agent_denylist: 'BadBot, Legacy-Scraper',
        }}
        initialEnabled={true}
      />
    );

    const toggle = screen.getByRole('switch', {
      name: /agent checkout/i,
    });

    expect(toggle).toBeChecked();
    expect(screen.getByText('Accepting agent checkouts')).toBeInTheDocument();
    expect(screen.getByLabelText(/trusted agent user-agents/i)).toHaveValue(
      'openai-agent\nperplexity'
    );
    expect(screen.getByLabelText(/blocked agent user-agents/i)).toHaveValue(
      'badbot\nlegacy-scraper'
    );
  });

  it('shows the paused state when agent checkout is disabled', () => {
    render(<AgentCommerceControlsCard initialEnabled={false} />);

    const toggle = screen.getByRole('switch', {
      name: /agent checkout/i,
    });

    expect(toggle).not.toBeChecked();
    expect(screen.getByText('Agent checkout paused')).toBeInTheDocument();
  });

  it('persists disabled state through the merchant features API', async () => {
    const user = userEvent.setup();
    vi.mocked(apiPatch).mockResolvedValue({
      agentic_checkout_enabled: false,
    });

    render(<AgentCommerceControlsCard initialEnabled={true} />);

    const toggle = screen.getByRole('switch', {
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
    vi.mocked(apiPatch).mockResolvedValue({
      agentic_checkout_enabled: true,
    });

    render(<AgentCommerceControlsCard initialEnabled={false} />);

    const toggle = screen.getByRole('switch', {
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
    vi.mocked(apiPatch).mockRejectedValue(new Error('Unable to save setting'));

    render(<AgentCommerceControlsCard initialEnabled={true} />);

    const toggle = screen.getByRole('switch', {
      name: /agent checkout/i,
    });
    await user.click(toggle);

    expect(
      await screen.findByText('Unable to save setting')
    ).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });

  it('saves allowlist and denylist patterns without losing unrelated custom settings', async () => {
    const user = userEvent.setup();
    vi.mocked(apiPatch).mockResolvedValue({
      custom_settings: {
        agentic_agent_allowlist: ['openai-agent', 'chatgpt'],
        agentic_agent_denylist: ['badbot'],
        support_priority: 'high',
      },
    });

    render(
      <AgentCommerceControlsCard
        initialCustomSettings={{
          support_priority: 'high',
        }}
        initialEnabled={true}
      />
    );

    await user.type(
      screen.getByLabelText(/trusted agent user-agents/i),
      'OpenAI-Agent\nChatGPT\n'
    );
    await user.type(
      screen.getByLabelText(/blocked agent user-agents/i),
      'BadBot'
    );
    await user.click(
      screen.getByRole('button', { name: /save agent access controls/i })
    );

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/api/merchant/features', {
        custom_settings: {
          agentic_agent_allowlist: ['openai-agent', 'chatgpt'],
          agentic_agent_denylist: ['badbot'],
          support_priority: 'high',
        },
      })
    );
    expect(screen.getByText('Agent access controls saved')).toBeInTheDocument();
  });
});
