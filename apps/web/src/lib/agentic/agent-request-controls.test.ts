import { describe, expect, it } from 'vitest';
import {
  AGENTIC_AGENT_BLOCKED_ERROR,
  AGENTIC_AGENT_IDENTITY_REQUIRED_ERROR,
  AGENTIC_AGENT_NOT_ALLOWLISTED_ERROR,
  readAgenticRequestControls,
  verifyAgenticRequestAccess,
} from '@/lib/agentic/agent-request-controls';

describe('agent request controls', () => {
  it('normalizes allowlist and denylist patterns from custom settings', () => {
    const controls = readAgenticRequestControls({
      agentic_agent_allowlist: [' OpenAI-Agent ', '', 'OPENAI-AGENT'],
      agentic_agent_denylist: 'BadBot, Another-Bot ',
    });

    expect(controls).toEqual({
      allowlist: ['openai-agent'],
      denylist: ['badbot', 'another-bot'],
    });
  });

  it('returns empty controls for invalid custom settings shapes', () => {
    const controls = readAgenticRequestControls([
      'agentic_agent_allowlist',
      'openai-agent',
    ]);

    expect(controls).toEqual({
      allowlist: [],
      denylist: [],
    });
  });

  it('retains valid controls when one control field is malformed', () => {
    const controls = readAgenticRequestControls({
      agentic_agent_allowlist: null,
      agentic_agent_denylist: ['Blocked-Bot', null, ''],
    });

    expect(controls).toEqual({
      allowlist: [],
      denylist: ['blocked-bot'],
    });
  });

  it('allows requests when no allowlist is configured', () => {
    const result = verifyAgenticRequestAccess({
      controls: { allowlist: [], denylist: [] },
      headers: new Headers({
        'user-agent': 'Some Agent/1.0',
      }),
    });

    expect(result).toEqual({ ok: true });
  });

  it('rejects requests that match the denylist', () => {
    const result = verifyAgenticRequestAccess({
      controls: { allowlist: [], denylist: ['blocked-agent'] },
      headers: new Headers({
        'user-agent': 'Blocked-Agent/1.0',
      }),
    });

    expect(result).toEqual({
      ok: false,
      error: AGENTIC_AGENT_BLOCKED_ERROR,
    });
  });

  it('rejects blank user-agent when denylist controls are configured', () => {
    const result = verifyAgenticRequestAccess({
      controls: { allowlist: [], denylist: ['blocked-agent'] },
      headers: new Headers(),
    });

    expect(result).toEqual({
      ok: false,
      error: AGENTIC_AGENT_IDENTITY_REQUIRED_ERROR,
    });
  });

  it('rejects requests not on allowlist when allowlist is configured', () => {
    const result = verifyAgenticRequestAccess({
      controls: { allowlist: ['trusted-agent'], denylist: [] },
      headers: new Headers({
        'user-agent': 'other-agent/1.0',
      }),
    });

    expect(result).toEqual({
      ok: false,
      error: AGENTIC_AGENT_NOT_ALLOWLISTED_ERROR,
    });
  });

  it('allows requests that match allowlist entries', () => {
    const result = verifyAgenticRequestAccess({
      controls: { allowlist: ['openai'], denylist: [] },
      headers: new Headers({
        'user-agent': 'OpenAI-Agent/2026.05',
      }),
    });

    expect(result).toEqual({ ok: true });
  });

  it('rejects blank user-agent when allowlist controls are configured', () => {
    const result = verifyAgenticRequestAccess({
      controls: { allowlist: ['openai'], denylist: [] },
      headers: new Headers({
        'user-agent': '  ',
      }),
    });

    expect(result).toEqual({
      ok: false,
      error: AGENTIC_AGENT_NOT_ALLOWLISTED_ERROR,
    });
  });
});
