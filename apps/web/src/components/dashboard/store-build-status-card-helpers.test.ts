import { describe, expect, it } from 'vitest';
import {
  getFallbackProgress,
  getStatusLabel,
  isApplyResponsePayload,
  readApplyResponse,
} from './store-build-status-card-helpers';

describe('store build status card helpers', () => {
  it.each([
    ['not_started', 20],
    ['pending', 45],
    ['processing', 70],
    ['ready', 100],
    ['applied', 100],
    ['failed', 100],
  ] as const)('maps %s to %s progress', (status, progress) => {
    expect(getFallbackProgress(status)).toBe(progress);
  });

  it('labels ready and failed states for merchants', () => {
    expect(getStatusLabel('ready')).toBe('AI design ready');
    expect(getStatusLabel('failed')).toBe('Starter store ready');
  });

  it('validates apply response payload shape', () => {
    expect(
      isApplyResponsePayload({
        error: 'AI draft is stale',
        code: 'ai_draft_stale',
        lastUpdated: null,
      })
    ).toBe(true);
    expect(isApplyResponsePayload({ error: 500 })).toBe(false);
  });

  it('returns an empty object for malformed apply responses', async () => {
    const response = new Response('not json');

    await expect(readApplyResponse(response)).resolves.toEqual({});
  });
});
