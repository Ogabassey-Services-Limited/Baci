import { describe, expect, it } from 'vitest';
import { resolveAgenticPaystackDvaMode } from './agentic-paystack-dva-mode-value';

describe('resolveAgenticPaystackDvaMode', () => {
  it('resolves the two exact configured values', () => {
    const enabledEnv = {
      AGENTIC_PAYSTACK_DVA_MODE: 'enabled',
      NODE_ENV: 'production',
    } as const;
    const pausedEnv = {
      AGENTIC_PAYSTACK_DVA_MODE: 'paused',
      NODE_ENV: 'production',
    } as const;

    const enabled = resolveAgenticPaystackDvaMode(enabledEnv);
    const paused = resolveAgenticPaystackDvaMode(pausedEnv);

    expect(enabled).toBe('enabled');
    expect(paused).toBe('paused');
  });

  it('defaults only a missing non-production value', () => {
    const env = { NODE_ENV: 'test' } as const;

    const mode = resolveAgenticPaystackDvaMode(env);

    expect(mode).toBe('enabled');
  });

  it('rejects an invalid non-production value', () => {
    const env = {
      AGENTIC_PAYSTACK_DVA_MODE: 'unknown',
      NODE_ENV: 'test',
    } as const;

    const resolve = () => resolveAgenticPaystackDvaMode(env);

    expect(resolve).toThrow(
      'AGENTIC_PAYSTACK_DVA_MODE must be exactly "enabled" or "paused"'
    );
  });

  it.each([
    undefined,
    '',
    ' enabled ',
    'PAUSED',
    'unknown',
  ])('rejects production value %j', (mode) => {
    const env = {
      AGENTIC_PAYSTACK_DVA_MODE: mode,
      NODE_ENV: 'production' as const,
    };

    const resolve = () =>
      resolveAgenticPaystackDvaMode({
        ...env,
      });

    expect(resolve).toThrow(
      'AGENTIC_PAYSTACK_DVA_MODE must be exactly "enabled" or "paused"'
    );
  });
});
