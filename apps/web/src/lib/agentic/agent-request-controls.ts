import { z } from 'zod';
import {
  AGENTIC_AGENT_ALLOWLIST_KEY,
  AGENTIC_AGENT_BLOCKED_ERROR,
  AGENTIC_AGENT_DENYLIST_KEY,
  AGENTIC_AGENT_NOT_ALLOWLISTED_ERROR,
} from '@/lib/agentic/agent-request-controls.constants';

export { AGENTIC_AGENT_BLOCKED_ERROR, AGENTIC_AGENT_NOT_ALLOWLISTED_ERROR };

export interface AgenticRequestControls {
  allowlist: string[];
  denylist: string[];
}

const agenticRequestControlsSettingsSchema = z.object({
  [AGENTIC_AGENT_ALLOWLIST_KEY]: z
    .union([z.array(z.string()), z.string()])
    .optional(),
  [AGENTIC_AGENT_DENYLIST_KEY]: z
    .union([z.array(z.string()), z.string()])
    .optional(),
});

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

function parsePatternList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return normalizePatterns(
      value.filter((entry): entry is string => typeof entry === 'string')
    );
  }

  if (typeof value === 'string') {
    return normalizePatterns(value.split(','));
  }

  return [];
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
    allowlist: parsePatternList(settings[AGENTIC_AGENT_ALLOWLIST_KEY]),
    denylist: parsePatternList(settings[AGENTIC_AGENT_DENYLIST_KEY]),
  };
}

function includesAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

export function verifyAgenticRequestAccess({
  controls,
  headers,
}: {
  controls: AgenticRequestControls;
  headers: Headers;
}): { ok: true } | { error: string; ok: false } {
  const normalizedUserAgent =
    normalizePattern(headers.get('user-agent') ?? '') ?? '';
  const hasConfiguredControls =
    controls.allowlist.length > 0 || controls.denylist.length > 0;

  if (hasConfiguredControls && normalizedUserAgent.length === 0) {
    return { ok: false, error: AGENTIC_AGENT_NOT_ALLOWLISTED_ERROR };
  }

  if (
    normalizedUserAgent &&
    includesAnyPattern(normalizedUserAgent, controls.denylist)
  ) {
    return { ok: false, error: AGENTIC_AGENT_BLOCKED_ERROR };
  }

  if (controls.allowlist.length === 0) {
    return { ok: true };
  }

  if (
    normalizedUserAgent &&
    includesAnyPattern(normalizedUserAgent, controls.allowlist)
  ) {
    return { ok: true };
  }

  return { ok: false, error: AGENTIC_AGENT_NOT_ALLOWLISTED_ERROR };
}
