import { describe, expect, it } from 'vitest';
import {
  AGENTIC_AGENT_ALLOWLIST_KEY,
  AGENTIC_AGENT_DENYLIST_KEY,
} from '@/lib/agentic/agent-request-controls.constants';
import { agenticRequestControlsSettingsSchema } from '@/schemas/agentic-request-controls-settings';

describe('agenticRequestControlsSettingsSchema', () => {
  it('parses valid string and array pattern lists', () => {
    const parsed = agenticRequestControlsSettingsSchema.parse({
      [AGENTIC_AGENT_ALLOWLIST_KEY]: ['openai-agent', ' trusted-agent '],
      [AGENTIC_AGENT_DENYLIST_KEY]: 'bad-bot,another-bot',
    });

    expect(parsed).toEqual({
      [AGENTIC_AGENT_ALLOWLIST_KEY]: ['openai-agent', ' trusted-agent '],
      [AGENTIC_AGENT_DENYLIST_KEY]: ['bad-bot', 'another-bot'],
    });
  });

  it('coerces malformed control values to empty lists without rejecting the object', () => {
    const parsed = agenticRequestControlsSettingsSchema.parse({
      [AGENTIC_AGENT_ALLOWLIST_KEY]: null,
      [AGENTIC_AGENT_DENYLIST_KEY]: ['blocked-bot', null, 5],
    });

    expect(parsed).toEqual({
      [AGENTIC_AGENT_ALLOWLIST_KEY]: [],
      [AGENTIC_AGENT_DENYLIST_KEY]: ['blocked-bot'],
    });
  });

  it('rejects non-object settings payloads', () => {
    const result = agenticRequestControlsSettingsSchema.safeParse('invalid');
    expect(result.success).toBe(false);
  });
});
