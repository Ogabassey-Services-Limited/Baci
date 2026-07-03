import type { CaptureResult } from 'posthog-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dropRecoveredChunkExceptionCapture } from './chunk-recovery-exception-filter';

const mockIsChunkRecoveryReloadPending = vi.fn();

vi.mock('@/lib/chunk-load-recovery', () => ({
  isChunkRecoveryReloadPending: (...args: unknown[]) =>
    mockIsChunkRecoveryReloadPending(...args),
}));

function createExceptionCapture(
  entries: Array<{ type?: string; value?: string }>
): CaptureResult {
  return {
    event: '$exception',
    properties: { $exception_list: entries },
  } as unknown as CaptureResult;
}

const chunkCapture = () =>
  createExceptionCapture([
    {
      type: 'ChunkLoadError',
      value:
        'Failed to load chunk /_next/static/chunks/app.js?dpl=deploy-1 from module 42',
    },
  ]);

describe('dropRecoveredChunkExceptionCapture', () => {
  beforeEach(() => {
    mockIsChunkRecoveryReloadPending.mockReset().mockReturnValue(false);
  });

  it('drops chunk-load exceptions while a recovery reload is navigating', () => {
    mockIsChunkRecoveryReloadPending.mockReturnValue(true);

    expect(dropRecoveredChunkExceptionCapture(chunkCapture())).toBeNull();
  });

  it('keeps chunk-load exceptions when no reload is pending', () => {
    const capture = chunkCapture();

    expect(dropRecoveredChunkExceptionCapture(capture)).toBe(capture);
  });

  it('never drops non-chunk exceptions, even while a reload is pending', () => {
    mockIsChunkRecoveryReloadPending.mockReturnValue(true);
    const capture = createExceptionCapture([
      { type: 'TypeError', value: 'maximumFractionDigits is out of range' },
    ]);

    expect(dropRecoveredChunkExceptionCapture(capture)).toBe(capture);
  });

  it('never drops non-exception events, even while a reload is pending', () => {
    mockIsChunkRecoveryReloadPending.mockReturnValue(true);
    const capture = {
      event: '$pageview',
      properties: {},
    } as unknown as CaptureResult;

    expect(dropRecoveredChunkExceptionCapture(capture)).toBe(capture);
  });

  it('passes through null captures untouched', () => {
    expect(dropRecoveredChunkExceptionCapture(null)).toBeNull();
  });

  it('tolerates malformed exception lists', () => {
    mockIsChunkRecoveryReloadPending.mockReturnValue(true);
    const missingList = {
      event: '$exception',
      properties: {},
    } as unknown as CaptureResult;
    const stringList = {
      event: '$exception',
      properties: { $exception_list: 'not-an-array' },
    } as unknown as CaptureResult;
    const junkEntries = createExceptionCapture([
      null as unknown as { type?: string },
      { type: undefined, value: undefined },
    ]);

    expect(dropRecoveredChunkExceptionCapture(missingList)).toBe(missingList);
    expect(dropRecoveredChunkExceptionCapture(stringList)).toBe(stringList);
    expect(dropRecoveredChunkExceptionCapture(junkEntries)).toBe(junkEntries);
  });

  it('detects the chunk failure from any entry in the exception list', () => {
    mockIsChunkRecoveryReloadPending.mockReturnValue(true);
    const capture = createExceptionCapture([
      { type: 'Error', value: 'wrapper error' },
      { type: 'ChunkLoadError', value: 'Loading chunk app/layout failed.' },
    ]);

    expect(dropRecoveredChunkExceptionCapture(capture)).toBeNull();
  });
});
