import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processAiStorefrontJobs } from './process-ai-storefront-jobs';

const mocks = vi.hoisted(() => ({
  processStorefrontLayoutJob: vi.fn(),
}));

vi.mock('@/lib/ai-storefront/process-storefront-layout-job', () => ({
  processStorefrontLayoutJob: mocks.processStorefrontLayoutJob,
}));

vi.mock('@/env', () => ({
  getOllamaStorefrontModel: () => 'gemma4:e4b',
}));

interface RunnerSupabaseMockOptions {
  queryError?: Error;
  claimError?: Error;
  completeError?: Error;
  completeLostLease?: boolean;
  failError?: Error;
  failLostLease?: boolean;
}

function createRunnerSupabaseMock(options: RunnerSupabaseMockOptions = {}) {
  const updates: unknown[] = [];
  const selectedEqCalls: unknown[][] = [];
  let updateCount = 0;
  const job = {
    id: 'job-1',
    merchant_id: 'merchant-1',
    input: {
      pageSlug: 'home',
      businessName: 'Bassey Phones',
      businessType: 'electronics',
      brandColors: null,
      createdPageConfigUpdatedAt: null,
    },
    attempts: 0,
    max_attempts: 3,
    created_at: '2026-04-28T10:00:00.000Z',
    metadata: {},
    status: 'pending',
  };

  const supabase = {
    updates,
    selectedEqCalls,
    from: vi.fn((table: string) => {
      if (table !== 'ai_jobs') throw new Error(`Unexpected table ${table}`);

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn(function eq(this: unknown, ...args: unknown[]) {
          selectedEqCalls.push(args);
          return this;
        }),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: options.queryError ? null : [job],
          error: options.queryError ?? null,
        }),
        update: vi.fn((payload: unknown) => {
          updates.push(payload);
          updateCount += 1;
          const isClaimUpdate = updateCount === 1;
          const isFailureUpdate =
            typeof payload === 'object' &&
            payload !== null &&
            'error' in payload;
          const updateError = isClaimUpdate
            ? options.claimError
            : isFailureUpdate
              ? options.failError
              : options.completeError;
          const lostLease = isClaimUpdate
            ? false
            : isFailureUpdate
              ? options.failLostLease
              : options.completeLostLease;
          return {
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: updateError || lostLease ? null : job,
              error: updateError ?? null,
            }),
          };
        }),
      };
    }),
  };

  return supabase;
}

describe('processAiStorefrontJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.processStorefrontLayoutJob.mockResolvedValue({
      generatedConfig: { content: [], root: { title: 'Home' }, zones: {} },
      applied: false,
    });
  });

  it('claims only storefront generation jobs with a batch size of one', async () => {
    const supabase = createRunnerSupabaseMock();

    await processAiStorefrontJobs({
      supabase,
      now: new Date('2026-04-28T10:10:00.000Z'),
      workerId: 'worker-1',
    });

    expect(supabase.selectedEqCalls).toContainEqual([
      'type',
      'storefront_layout_generation',
    ]);
    expect(mocks.processStorefrontLayoutJob).toHaveBeenCalledTimes(1);
    expect(supabase.updates[0]).toEqual(
      expect.objectContaining({
        status: 'processing',
        locked_by: 'worker-1',
        lease_expires_at: expect.any(String),
      })
    );
    expect(supabase.updates[1]).toEqual(
      expect.objectContaining({
        status: 'completed',
        locked_by: null,
        lease_expires_at: null,
      })
    );
  });

  it('retries failed jobs and records failure metadata', async () => {
    mocks.processStorefrontLayoutJob.mockRejectedValueOnce(
      new Error('Generated page config failed validation')
    );
    const supabase = createRunnerSupabaseMock();

    await processAiStorefrontJobs({
      supabase,
      now: new Date('2026-04-28T10:10:00.000Z'),
      workerId: 'worker-1',
    });

    expect(supabase.updates[1]).toEqual(
      expect.objectContaining({
        status: 'pending',
        attempts: 1,
        error: 'Generated page config failed validation',
        locked_by: null,
      })
    );
    expect(supabase.updates[1]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          validationOrGenerationError: 'Generated page config failed validation',
        }),
      })
    );
  });

  it('throws when the claim query returns an error', async () => {
    const supabase = createRunnerSupabaseMock({
      claimError: new Error('claim failed'),
    });

    await expect(
      processAiStorefrontJobs({
        supabase,
        now: new Date('2026-04-28T10:10:00.000Z'),
        workerId: 'worker-1',
      })
    ).rejects.toThrow('Failed to claim storefront job job-1: claim failed');
  });

  it('throws when the pending job query fails', async () => {
    const supabase = createRunnerSupabaseMock({
      queryError: new Error('query failed'),
    });

    await expect(
      processAiStorefrontJobs({
        supabase,
        now: new Date('2026-04-28T10:10:00.000Z'),
        workerId: 'worker-1',
      })
    ).rejects.toThrow('Failed to load storefront jobs: query failed');
  });

  it('throws when completed-job persistence fails', async () => {
    const supabase = createRunnerSupabaseMock({
      completeError: new Error('update failed'),
    });

    await expect(
      processAiStorefrontJobs({
        supabase,
        now: new Date('2026-04-28T10:10:00.000Z'),
        workerId: 'worker-1',
      })
    ).rejects.toThrow(
      'Failed to persist completed storefront job job-1: update failed'
    );
  });

  it('throws when completed-job persistence loses the active lease', async () => {
    const supabase = createRunnerSupabaseMock({
      completeLostLease: true,
    });

    await expect(
      processAiStorefrontJobs({
        supabase,
        now: new Date('2026-04-28T10:10:00.000Z'),
        workerId: 'worker-1',
      })
    ).rejects.toThrow(
      'Failed to persist completed storefront job job-1: active lease was lost'
    );
  });

  it('throws when failed-job persistence fails', async () => {
    mocks.processStorefrontLayoutJob.mockRejectedValueOnce(
      new Error('generation failed')
    );
    const supabase = createRunnerSupabaseMock({
      failError: new Error('failure update failed'),
    });

    await expect(
      processAiStorefrontJobs({
        supabase,
        now: new Date('2026-04-28T10:10:00.000Z'),
        workerId: 'worker-1',
      })
    ).rejects.toThrow(
      'Failed to persist failed storefront job job-1: failure update failed'
    );
  });

  it('throws when failed-job persistence loses the active lease', async () => {
    mocks.processStorefrontLayoutJob.mockRejectedValueOnce(
      new Error('generation failed')
    );
    const supabase = createRunnerSupabaseMock({
      failLostLease: true,
    });

    await expect(
      processAiStorefrontJobs({
        supabase,
        now: new Date('2026-04-28T10:10:00.000Z'),
        workerId: 'worker-1',
      })
    ).rejects.toThrow(
      'Failed to persist failed storefront job job-1: active lease was lost'
    );
  });
});
