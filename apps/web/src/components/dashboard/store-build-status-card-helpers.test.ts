import { describe, expect, it } from 'vitest';
import {
  getFallbackProgress,
  getStatusAccent,
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

  it.each([
    ['pending', 'Store design queued'],
    ['processing', 'Building your store'],
    ['ready', 'AI design ready'],
    ['applied', 'AI design applied'],
    ['failed', 'Starter store ready'],
    ['not_started', 'Starter store ready'],
  ] as const)('labels %s for merchants', (status, label) => {
    expect(getStatusLabel(status)).toBe(label);
  });

  it('falls back to the generic label for unknown statuses', () => {
    expect(getStatusLabel('unknown' as never)).toBe('Store build status');
  });

  it('maps status accents for active and failed states', () => {
    expect(getStatusAccent('processing')).toBe(
      'border-primary/20 bg-primary/5'
    );
    expect(getStatusAccent('failed')).toBe('border-amber-200 bg-amber-50/60');
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

  it('reads successful apply response payloads', async () => {
    const response = Response.json({
      lastUpdated: '2026-04-28T10:30:00.000Z',
    });

    await expect(readApplyResponse(response)).resolves.toEqual({
      lastUpdated: '2026-04-28T10:30:00.000Z',
    });
  });

  it('reads error apply response payloads', async () => {
    const response = Response.json({
      error: 'AI draft is stale',
      code: 'ai_draft_stale',
      message: 'Review before replacing your current draft.',
    });

    await expect(readApplyResponse(response)).resolves.toEqual({
      error: 'AI draft is stale',
      code: 'ai_draft_stale',
      message: 'Review before replacing your current draft.',
    });
  });
});
