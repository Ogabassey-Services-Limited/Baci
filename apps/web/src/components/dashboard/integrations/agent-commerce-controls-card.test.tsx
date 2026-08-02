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
        merchantId="22222222-2222-4222-8222-222222222222"
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
    expect(
      screen.getByLabelText(/trusted agent ids or user-agents/i)
    ).toHaveValue('openai-agent\nperplexity');
    expect(
      screen.getByLabelText(/blocked agent ids or user-agents/i)
    ).toHaveValue('badbot\nlegacy-scraper');
  });

  it('shows the paused state when agent checkout is disabled', () => {
    render(
      <AgentCommerceControlsCard
        initialEnabled={false}
        merchantId="22222222-2222-4222-8222-222222222222"
      />
    );

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

    render(
      <AgentCommerceControlsCard
        initialEnabled={true}
        merchantId="22222222-2222-4222-8222-222222222222"
      />
    );

    const toggle = screen.getByRole('switch', {
      name: /agent checkout/i,
    });
    await user.click(toggle);

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/api/merchant/features', {
        agentic_checkout_enabled: false,
        merchantId: '22222222-2222-4222-8222-222222222222',
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

    render(
      <AgentCommerceControlsCard
        initialEnabled={false}
        merchantId="22222222-2222-4222-8222-222222222222"
      />
    );

    const toggle = screen.getByRole('switch', {
      name: /agent checkout/i,
    });
    await user.click(toggle);

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/api/merchant/features', {
        agentic_checkout_enabled: true,
        merchantId: '22222222-2222-4222-8222-222222222222',
      })
    );
    expect(toggle).toBeChecked();
    expect(screen.getByText('Accepting agent checkouts')).toBeInTheDocument();
  });

  it('rolls back the toggle and shows an error when saving fails', async () => {
    const user = userEvent.setup();
    vi.mocked(apiPatch).mockRejectedValue(new Error('Unable to save setting'));

    render(
      <AgentCommerceControlsCard
        initialEnabled={true}
        merchantId="22222222-2222-4222-8222-222222222222"
      />
    );

    const toggle = screen.getByRole('switch', {
      name: /agent checkout/i,
    });
    await user.click(toggle);

    expect(
      await screen.findByText('Unable to save setting')
    ).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });

  it('resets to merchant B and ignores merchant A toggle completion', async () => {
    const user = userEvent.setup();
    let resolveRequest:
      | ((value: { agentic_checkout_enabled: boolean }) => void)
      | undefined;
    vi.mocked(apiPatch).mockReturnValue(
      new Promise<{ agentic_checkout_enabled: boolean }>((resolve) => {
        resolveRequest = resolve;
      })
    );

    const { rerender } = render(
      <AgentCommerceControlsCard
        initialEnabled={true}
        merchantId="merchant-a"
      />
    );
    const toggle = screen.getByRole('switch', { name: /agent checkout/i });
    await user.click(toggle);

    rerender(
      <AgentCommerceControlsCard
        initialEnabled={true}
        merchantId="merchant-b"
      />
    );

    expect(toggle).toBeChecked();
    expect(toggle).not.toBeDisabled();

    if (!resolveRequest)
      throw new Error('Expected the toggle request to start');
    resolveRequest({ agentic_checkout_enabled: false });

    await waitFor(() => {
      expect(toggle).toBeChecked();
    });
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
        merchantId="22222222-2222-4222-8222-222222222222"
        initialCustomSettings={{
          support_priority: 'high',
        }}
        initialEnabled={true}
      />
    );

    await user.type(
      screen.getByLabelText(/trusted agent ids or user-agents/i),
      'OpenAI-Agent\nChatGPT\n'
    );
    await user.type(
      screen.getByLabelText(/blocked agent ids or user-agents/i),
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
        merchantId: '22222222-2222-4222-8222-222222222222',
      })
    );
    expect(screen.getByText('Agent access controls saved')).toBeInTheDocument();
  });

  it('does not carry A custom settings or a stale save message into merchant B', async () => {
    const user = userEvent.setup();
    let resolveRequest:
      | ((value: { custom_settings: Record<string, unknown> }) => void)
      | undefined;
    vi.mocked(apiPatch).mockReturnValue(
      new Promise<{ custom_settings: Record<string, unknown> }>((resolve) => {
        resolveRequest = resolve;
      })
    );

    const { rerender } = render(
      <AgentCommerceControlsCard
        initialEnabled={false}
        initialCustomSettings={{
          agentic_agent_allowlist: ['merchant-a-agent'],
        }}
        merchantId="merchant-a"
      />
    );
    await user.click(
      screen.getByRole('button', { name: /save agent access controls/i })
    );

    rerender(
      <AgentCommerceControlsCard
        initialEnabled={false}
        initialCustomSettings={{
          agentic_agent_allowlist: ['merchant-b-agent'],
        }}
        merchantId="merchant-b"
      />
    );

    expect(
      screen.getByLabelText(/trusted agent ids or user-agents/i)
    ).toHaveValue('merchant-b-agent');
    expect(
      screen.queryByText('Agent access controls saved')
    ).not.toBeInTheDocument();

    if (!resolveRequest)
      throw new Error('Expected the controls request to start');
    resolveRequest({
      custom_settings: { agentic_agent_allowlist: ['merchant-a-response'] },
    });

    await waitFor(() => {
      expect(
        screen.getByLabelText(/trusted agent ids or user-agents/i)
      ).toHaveValue('merchant-b-agent');
    });
    expect(
      screen.queryByText('Agent access controls saved')
    ).not.toBeInTheDocument();
  });
});
