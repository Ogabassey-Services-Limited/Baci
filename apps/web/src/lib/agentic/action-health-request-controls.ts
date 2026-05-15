import type { SupabaseClient } from '@supabase/supabase-js';

const AGENTIC_AGENT_ALLOWLIST_KEY = 'agentic_agent_allowlist';
const AGENTIC_AGENT_DENYLIST_KEY = 'agentic_agent_denylist';

export interface ActionHealthRequestControlSummary {
  allowlistCount: number;
  denylistCount: number;
  error: unknown | null;
  isAgenticCheckoutEnabled: boolean;
}

function parsePatternList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

export async function getActionHealthRequestControlSummary(
  supabase: SupabaseClient,
  merchantId: string
): Promise<ActionHealthRequestControlSummary> {
  const { data, error } = await supabase
    .from('merchant_feature_settings')
    .select('agentic_checkout_enabled, custom_settings')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error) {
    return {
      allowlistCount: 0,
      denylistCount: 0,
      error,
      isAgenticCheckoutEnabled: false,
    };
  }

  if (!data) {
    return {
      allowlistCount: 0,
      denylistCount: 0,
      error: null,
      isAgenticCheckoutEnabled: true,
    };
  }

  const customSettings =
    data.custom_settings && typeof data.custom_settings === 'object'
      ? (data.custom_settings as Record<string, unknown>)
      : {};

  return {
    allowlistCount: parsePatternList(
      customSettings[AGENTIC_AGENT_ALLOWLIST_KEY]
    ).length,
    denylistCount: parsePatternList(customSettings[AGENTIC_AGENT_DENYLIST_KEY])
      .length,
    error: null,
    isAgenticCheckoutEnabled: data.agentic_checkout_enabled !== false,
  };
}
