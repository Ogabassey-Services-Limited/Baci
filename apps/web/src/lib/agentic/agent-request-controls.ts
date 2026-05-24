import {
  AGENTIC_AGENT_ALLOWLIST_KEY,
  AGENTIC_AGENT_BLOCKED_ERROR,
  AGENTIC_AGENT_DENYLIST_KEY,
  AGENTIC_AGENT_IDENTITY_REQUIRED_ERROR,
  AGENTIC_AGENT_NOT_ALLOWLISTED_ERROR,
} from '@/lib/agentic/agent-request-controls.constants';
import { agenticRequestControlsSettingsSchema } from '@/schemas/agentic-request-controls-settings';

export {
  AGENTIC_AGENT_BLOCKED_ERROR,
  AGENTIC_AGENT_IDENTITY_REQUIRED_ERROR,
  AGENTIC_AGENT_NOT_ALLOWLISTED_ERROR,
};

export interface AgenticRequestControls {
  allowlist: string[];
  denylist: string[];
}

function normalizePattern(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizePatterns(values: string[]): string[] {
  const unique = new Set<string>();

  for (const value of values) {
    const normalized = normalizePattern(value);
    if (normalized) unique.add(normalized);
  }

  return [...unique];
}

export function readAgenticRequestControls(
  customSettings: unknown
): AgenticRequestControls {
  const parsed = agenticRequestControlsSettingsSchema.safeParse(customSettings);
  if (!parsed.success) {
    return { allowlist: [], denylist: [] };
  }

  const settings = parsed.data;
  return {
    allowlist: normalizePatterns(settings[AGENTIC_AGENT_ALLOWLIST_KEY]),
    denylist: normalizePatterns(settings[AGENTIC_AGENT_DENYLIST_KEY]),
  };
}

function includesAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

function getNormalizedAgentIdentities(headers: Headers): string[] {
  return [headers.get('agent-id'), headers.get('user-agent')]
    .map((value) => normalizePattern(value ?? ''))
    .filter((value): value is string => value !== null && value.length > 0);
}

export function verifyAgenticRequestAccess({
  controls,
  headers,
}: {
  controls: AgenticRequestControls;
  headers: Headers;
}): { ok: true } | { error: string; ok: false } {
  const normalizedIdentities = getNormalizedAgentIdentities(headers);
  const hasAllowlistControls = controls.allowlist.length > 0;
  const hasConfiguredControls =
    hasAllowlistControls || controls.denylist.length > 0;

  if (hasConfiguredControls && normalizedIdentities.length === 0) {
    return {
      ok: false,
      error: hasAllowlistControls
        ? AGENTIC_AGENT_NOT_ALLOWLISTED_ERROR
        : AGENTIC_AGENT_IDENTITY_REQUIRED_ERROR,
    };
  }

  if (
    normalizedIdentities.some((identity) =>
      includesAnyPattern(identity, controls.denylist)
    )
  ) {
    return { ok: false, error: AGENTIC_AGENT_BLOCKED_ERROR };
  }

  if (controls.allowlist.length === 0) {
    return { ok: true };
  }

  if (
    normalizedIdentities.some((identity) =>
      includesAnyPattern(identity, controls.allowlist)
    )
  ) {
    return { ok: true };
  }

  return { ok: false, error: AGENTIC_AGENT_NOT_ALLOWLISTED_ERROR };
}
