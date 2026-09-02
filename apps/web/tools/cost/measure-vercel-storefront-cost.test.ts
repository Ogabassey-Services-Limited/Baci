import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { measureVercelStorefrontCost } from './measure-vercel-storefront-cost';
import { MAX_INPUT_ROWS } from './measure-vercel-storefront-cost-types';

const projectId = 'prj_y6kGI7ZzyFWU6tyZbaklPtVsXeqx';
const beforeSha = 'a'.repeat(40);
const afterSha = 'b'.repeat(40);
const roots: string[] = [];

async function fixtureFiles() {
  const root = await mkdtemp(join(tmpdir(), 'vercel-cost-measurement-'));
  roots.push(root);
  const beforePath = join(root, 'before.jsonl');
  const afterPath = join(root, 'after.jsonl');
  const cachePath = join(root, 'cache.jsonl');
  const beforeDbTracePath = join(root, 'before-db.jsonl');
  const afterDbTracePath = join(root, 'after-db.jsonl');
  const rows = [
    {
      ChargePeriodStart: '2026-08-01T00:00:00.000Z',
      ChargePeriodEnd: '2026-08-02T00:00:00.000Z',
      ConsumedQuantity: 10,
      EffectiveCost: 2.5,
      ServiceName: 'Fluid Active CPU',
      Tags: { ProjectId: projectId },
    },
    {
      ChargePeriodStart: '2026-08-01T00:00:00.000Z',
      ChargePeriodEnd: '2026-08-02T00:00:00.000Z',
      ConsumedQuantity: 100,
      EffectiveCost: 1,
      ServiceName: 'Function Invocations',
      Tags: { ProjectId: projectId },
    },
    {
      ChargePeriodStart: '2026-08-01T00:00:00.000Z',
      ChargePeriodEnd: '2026-08-02T00:00:00.000Z',
      ConsumedQuantity: 900,
      EffectiveCost: 9,
      ServiceName: 'Fluid Active CPU',
      Tags: { ProjectId: 'prj_other' },
    },
  ];
  await writeFile(
    beforePath,
    `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`
  );
  await writeFile(
    afterPath,
    `${JSON.stringify({ ...rows[0], ConsumedQuantity: 4, EffectiveCost: 1 })}\n${JSON.stringify({ ...rows[1], ConsumedQuantity: 40, EffectiveCost: 0.4 })}\n`
  );
  await writeFile(
    cachePath,
    `${JSON.stringify({ cacheStatus: 'HIT', ttfbMs: 12 })}\n${JSON.stringify({ cacheStatus: 'MISS', ttfbMs: 40 })}\n${JSON.stringify({ cacheStatus: 'STALE', ttfbMs: 20 })}\n${JSON.stringify({ cacheStatus: 'PRERENDER', ttfbMs: 18 })}\n`
  );
  await writeFile(
    beforeDbTracePath,
    `${JSON.stringify({ cohort: 'pdp', dbCalls: 4, dbTimeouts: 1 })}\n${JSON.stringify({ cohort: 'compare', dbCalls: 2, dbTimeouts: 0 })}\n`
  );
  await writeFile(
    afterDbTracePath,
    `${JSON.stringify({ cohort: 'pdp', dbCalls: 1, dbTimeouts: 0 })}\n${JSON.stringify({ cohort: 'compare', dbCalls: 1, dbTimeouts: 0 })}\n`
  );
  return {
    afterDbTracePath,
    afterPath,
    beforeDbTracePath,
    beforePath,
    cachePath,
  };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true }))
  );
});

describe('measureVercelStorefrontCost', () => {
  it('filters the project, aggregates billable services, and compares cache probes', async () => {
    const {
      afterDbTracePath,
      afterPath,
      beforeDbTracePath,
      beforePath,
      cachePath,
    } = await fixtureFiles();

    const result = await measureVercelStorefrontCost({
      after: {
        inputPath: afterPath,
        window: {
          dbTracePath: afterDbTracePath,
          deploymentSha: afterSha,
          label: 'after',
          requestedWindowEnd: '2026-09-01T00:00:00.000Z',
          requestedWindowStart: '2026-08-02T00:00:00.000Z',
        },
      },
      before: {
        inputPath: beforePath,
        window: {
          cacheProbePath: cachePath,
          dbTracePath: beforeDbTracePath,
          deploymentSha: beforeSha,
          label: 'before',
          requestedWindowEnd: '2026-08-01T00:00:00.000Z',
          requestedWindowStart: '2026-07-01T00:00:00.000Z',
        },
      },
      projectId,
    });

    expect(result.before.ignoredRows).toBe(1);
    expect(result.comparisonStatus).toBe('complete');
    expect(result.before.metrics.projectEffectiveCostUsd).toBe(3.5);
    expect(result.before.metrics.services.fluidActiveCpuHours).toBe(10);
    expect(result.before.metrics.services.functionInvocations).toBe(100);
    expect(result.before.cacheProbe).toMatchObject({
      cacheStatusRows: 4,
      cacheHitRows: 3,
      cacheHitRatio: 3 / 4,
      p50TtfbMs: 18,
      p95TtfbMs: 40,
    });
    expect(result.before.dbTrace).toMatchObject({
      dbCalls: 6,
      dbCallsPerRequest: 3,
      dbTimeouts: 1,
      byCohort: {
        pdp: { dbCalls: 4, dbTimeouts: 1, rows: 1 },
      },
    });
    expect(result.comparison?.projectEffectiveCostUsd).toEqual({
      absoluteDelta: -2.1,
      after: 1.4,
      before: 3.5,
      relativeChangePct: -60,
    });
    expect(result.comparison?.functionInvocations.absoluteDelta).toBe(-60);
    expect(result.comparison?.dbCalls).toEqual({
      absoluteDelta: -4,
      after: 2,
      before: 6,
      relativeChangePct: -66.666667,
    });
    expect(result.comparison?.dbTimeouts).toEqual({
      absoluteDelta: -1,
      after: 0,
      before: 1,
      relativeChangePct: -100,
    });
  });

  it('does not claim savings when no after window is supplied', async () => {
    const { beforePath } = await fixtureFiles();
    const result = await measureVercelStorefrontCost({
      before: {
        inputPath: beforePath,
        window: { deploymentSha: beforeSha, label: 'before' },
      },
      projectId,
    });

    expect(result.after).toBeNull();
    expect(result.comparisonStatus).toBe('not_available');
    expect(result.comparison).toBeNull();
    expect(result.limitations).toContain(
      'No after window was supplied, so no before/after savings claim is produced.'
    );
    expect(result.limitations).toContain(
      'Comparison is incomplete without both before and after DB traces; Vercel billing exports do not contain database-call counts. Provide bounded DB trace JSONL inputs or collect the same fields from Supabase telemetry.'
    );
  });

  it.each([
    ['before-only', true, false],
    ['after-only', false, true],
  ] as const)('marks an asymmetric %s DB trace comparison incomplete without DB deltas', async (_label, includeBeforeTrace, includeAfterTrace) => {
    const { afterPath, beforePath, beforeDbTracePath, afterDbTracePath } =
      await fixtureFiles();
    const result = await measureVercelStorefrontCost({
      after: {
        inputPath: afterPath,
        window: {
          dbTracePath: includeAfterTrace ? afterDbTracePath : undefined,
          deploymentSha: afterSha,
          label: 'after',
        },
      },
      before: {
        inputPath: beforePath,
        window: {
          dbTracePath: includeBeforeTrace ? beforeDbTracePath : undefined,
          deploymentSha: beforeSha,
          label: 'before',
        },
      },
      projectId,
    });

    expect(result.comparisonStatus).toBe('incomplete');
    expect(result.comparison).not.toHaveProperty('dbCalls');
    expect(result.limitations).toContain(
      'Comparison is incomplete without both before and after DB traces; Vercel billing exports do not contain database-call counts. Provide bounded DB trace JSONL inputs or collect the same fields from Supabase telemetry.'
    );
  });

  it('normalizes offset billing timestamps before comparing charge periods', async () => {
    const { beforePath } = await fixtureFiles();
    const offsetPath = beforePath.replace('before.jsonl', 'offset.jsonl');
    await writeFile(
      offsetPath,
      `${JSON.stringify({
        ChargePeriodStart: '2026-08-01T01:00:00+01:00',
        ChargePeriodEnd: '2026-08-01T02:00:00+01:00',
        ConsumedQuantity: 1,
        EffectiveCost: 1,
        ServiceName: 'Function Invocations',
        Tags: { ProjectId: projectId },
      })}\n${JSON.stringify({
        ChargePeriodStart: '2026-08-01T00:30:00Z',
        ChargePeriodEnd: '2026-08-01T01:30:00Z',
        ConsumedQuantity: 1,
        EffectiveCost: 1,
        ServiceName: 'Function Invocations',
        Tags: { ProjectId: projectId },
      })}\n`
    );

    const result = await measureVercelStorefrontCost({
      before: {
        inputPath: offsetPath,
        window: { deploymentSha: beforeSha, label: 'before' },
      },
      projectId,
    });

    expect(result.before.observedChargePeriod).toEqual({
      end: '2026-08-01T01:30:00.000Z',
      start: '2026-08-01T00:00:00.000Z',
    });
  });

  it('rejects malformed or unbounded billing input', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vercel-cost-invalid-'));
    roots.push(root);
    const invalidPath = join(root, 'invalid.jsonl');
    await writeFile(invalidPath, '{"EffectiveCost":"not-a-number"}\n');
    await expect(
      measureVercelStorefrontCost({
        before: {
          inputPath: invalidPath,
          window: { deploymentSha: beforeSha, label: 'before' },
        },
        projectId,
      })
    ).rejects.toThrow('billing row has an invalid ChargePeriodStart');

    const oversizedPath = join(root, 'oversized.jsonl');
    const validRow = JSON.stringify({
      ChargePeriodStart: '2026-08-01T00:00:00.000Z',
      ChargePeriodEnd: '2026-08-02T00:00:00.000Z',
      ConsumedQuantity: 1,
      EffectiveCost: 1,
      ServiceName: 'Function Invocations',
      Tags: { ProjectId: projectId },
    });
    await writeFile(
      oversizedPath,
      `${`${validRow}\n`.repeat(MAX_INPUT_ROWS + 1)}`
    );
    await expect(
      measureVercelStorefrontCost({
        before: {
          inputPath: oversizedPath,
          window: { deploymentSha: beforeSha, label: 'before' },
        },
        projectId,
      })
    ).rejects.toThrow('exceeds the 100000-row bound');
  });
});
