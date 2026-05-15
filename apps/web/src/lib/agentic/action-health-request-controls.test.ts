import { describe, expect, it, vi } from 'vitest';
import { getActionHealthRequestControlSummary } from './action-health-request-controls';

function createSupabaseMock({
  data,
  error = null,
}: {
  data: unknown;
  error?: unknown;
}) {
  const maybeSingle = vi.fn(() => Promise.resolve({ data, error }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    from,
    _spies: { eq, from, maybeSingle, select },
  };
}

describe('getActionHealthRequestControlSummary', () => {
  it('counts allowlist and denylist patterns from strings and arrays', async () => {
    const supabase = createSupabaseMock({
      data: {
        agentic_checkout_enabled: false,
        custom_settings: {
          agentic_agent_allowlist: '  chatgpt, ,perplexity  ',
          agentic_agent_denylist: ['legacy-bot', ' ', 'stale-client'],
        },
      },
    });

    const summary = await getActionHealthRequestControlSummary(
      supabase as never,
      'merchant-1'
    );

    expect(summary).toEqual({
      allowlistCount: 2,
      denylistCount: 2,
      error: null,
      isAgenticCheckoutEnabled: false,
    });
    expect(supabase._spies.from).toHaveBeenCalledWith(
      'merchant_feature_settings'
    );
    expect(supabase._spies.select).toHaveBeenCalledWith(
      'agentic_checkout_enabled, custom_settings'
    );
    expect(supabase._spies.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
  });

  it('returns defaults when the feature settings lookup fails', async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: { message: 'db unavailable' },
    });

    const summary = await getActionHealthRequestControlSummary(
      supabase as never,
      'merchant-1'
    );

    expect(summary).toEqual({
      allowlistCount: 0,
      denylistCount: 0,
      error: { message: 'db unavailable' },
      isAgenticCheckoutEnabled: false,
    });
  });

  it('returns defaults when no feature-settings row exists', async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    const summary = await getActionHealthRequestControlSummary(
      supabase as never,
      'merchant-1'
    );

    expect(summary).toEqual({
      allowlistCount: 0,
      denylistCount: 0,
      error: null,
      isAgenticCheckoutEnabled: false,
    });
  });

  it('handles missing or malformed custom settings safely', async () => {
    const supabase = createSupabaseMock({
      data: {
        agentic_checkout_enabled: true,
        custom_settings: null,
      },
    });

    const summary = await getActionHealthRequestControlSummary(
      supabase as never,
      'merchant-1'
    );

    expect(summary).toEqual({
      allowlistCount: 0,
      denylistCount: 0,
      error: null,
      isAgenticCheckoutEnabled: true,
    });
  });
});
