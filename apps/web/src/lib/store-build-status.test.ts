import { describe, expect, it } from 'vitest';
import { buildStoreBuildStatus } from '@/lib/store-build-status';

describe('buildStoreBuildStatus', () => {
  it('reports no starter store when storefront data is missing', () => {
    expect(buildStoreBuildStatus(false, null, true)).toEqual(
      expect.objectContaining({
        starterStoreReady: false,
        aiStatus: 'not_started',
        latestJobId: null,
        canApplyAiDraft: false,
      })
    );
  });

  it('reports starter-only state when no storefront AI job exists', () => {
    expect(buildStoreBuildStatus(true, null, true)).toEqual(
      expect.objectContaining({
        starterStoreReady: true,
        aiStatus: 'not_started',
        latestJobId: null,
        canApplyAiDraft: false,
      })
    );
  });

  it('marks completed unapplied storefront jobs as ready', () => {
    expect(
      buildStoreBuildStatus(
        true,
        {
          id: 'job-1',
          status: 'completed',
          result_applied_at: null,
        },
        true
      )
    ).toEqual(
      expect.objectContaining({
        starterStoreReady: true,
        aiStatus: 'ready',
        latestJobId: 'job-1',
        canApplyAiDraft: true,
      })
    );
  });

  it('allows preview but not apply for view-only staff', () => {
    expect(
      buildStoreBuildStatus(
        true,
        {
          id: 'job-1',
          status: 'completed',
          result_applied_at: null,
        },
        false
      )
    ).toEqual(
      expect.objectContaining({
        aiStatus: 'ready',
        latestJobId: 'job-1',
        canApplyAiDraft: false,
      })
    );
  });

  it.each([
    ['pending', 'pending'],
    ['processing', 'processing'],
    ['failed', 'failed'],
  ] as const)('maps %s jobs to %s build status', (jobStatus, aiStatus) => {
    expect(
      buildStoreBuildStatus(
        true,
        {
          id: `job-${jobStatus}`,
          status: jobStatus,
          result_applied_at: null,
        },
        true
      )
    ).toEqual(
      expect.objectContaining({
        aiStatus,
        latestJobId: `job-${jobStatus}`,
        canApplyAiDraft: false,
      })
    );
  });

  it('marks completed applied jobs as applied', () => {
    expect(
      buildStoreBuildStatus(
        true,
        {
          id: 'job-applied',
          status: 'completed',
          result_applied_at: '2026-04-28T10:00:00.000Z',
        },
        true
      )
    ).toEqual(
      expect.objectContaining({
        aiStatus: 'applied',
        latestJobId: 'job-applied',
        canApplyAiDraft: false,
      })
    );
  });
});
