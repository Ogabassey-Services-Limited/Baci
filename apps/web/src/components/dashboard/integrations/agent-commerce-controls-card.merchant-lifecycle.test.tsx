import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPatch } from '@/lib/api-client';
import { AgentCommerceControlsCard } from './agent-commerce-controls-card';

vi.mock('@/lib/api-client', () => ({ apiPatch: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('AgentCommerceControlsCard merchant lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ignores a stale toggle after switching A to B and back to A', async () => {
    const user = userEvent.setup();
    const request = deferred<{ agentic_checkout_enabled: boolean }>();
    vi.mocked(apiPatch).mockReturnValueOnce(request.promise);
    const { rerender } = render(
      <AgentCommerceControlsCard
        initialEnabled={true}
        merchantId="merchant-a"
      />
    );

    await user.click(screen.getByRole('switch', { name: /agent checkout/i }));
    rerender(
      <AgentCommerceControlsCard
        initialEnabled={false}
        merchantId="merchant-b"
      />
    );
    rerender(
      <AgentCommerceControlsCard
        initialEnabled={true}
        merchantId="merchant-a"
      />
    );
    await act(async () => {
      request.resolve({ agentic_checkout_enabled: false });
      await request.promise;
    });

    expect(
      screen.getByRole('switch', { name: /agent checkout/i })
    ).toBeChecked();
    expect(screen.queryByText(/unable to save/i)).not.toBeInTheDocument();
  });

  it('ignores stale access controls after switching A to B and back to A', async () => {
    const user = userEvent.setup();
    const request = deferred<{
      custom_settings: Record<string, unknown>;
    }>();
    vi.mocked(apiPatch).mockReturnValueOnce(request.promise);
    const { rerender } = render(
      <AgentCommerceControlsCard
        initialCustomSettings={{ agentic_agent_allowlist: ['original-a'] }}
        initialEnabled={true}
        merchantId="merchant-a"
      />
    );

    await user.click(
      screen.getByRole('button', { name: /save agent access controls/i })
    );
    rerender(
      <AgentCommerceControlsCard
        initialCustomSettings={{ agentic_agent_allowlist: ['merchant-b'] }}
        initialEnabled={true}
        merchantId="merchant-b"
      />
    );
    rerender(
      <AgentCommerceControlsCard
        initialCustomSettings={{ agentic_agent_allowlist: ['current-a'] }}
        initialEnabled={true}
        merchantId="merchant-a"
      />
    );
    await act(async () => {
      request.resolve({
        custom_settings: { agentic_agent_allowlist: ['stale-a'] },
      });
      await request.promise;
    });

    expect(
      screen.getByLabelText(/trusted agent ids or user-agents/i)
    ).toHaveValue('current-a');
    expect(
      screen.queryByText('Agent access controls saved')
    ).not.toBeInTheDocument();
  });
});
