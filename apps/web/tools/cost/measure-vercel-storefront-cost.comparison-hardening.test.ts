import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { measureVercelStorefrontCost } from './measure-vercel-storefront-cost';
import {
  createMeasurementFixtureFiles,
  MEASUREMENT_AFTER_SHA,
  MEASUREMENT_BEFORE_SHA,
  MEASUREMENT_PROJECT_ID,
} from './measure-vercel-storefront-cost.test-support';

const roots: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('measureVercelStorefrontCost comparison hardening', () => {
  it('bugfix: requires requested windows on both sides or neither', async () => {
    const { afterPath, beforePath } =
      await createMeasurementFixtureFiles(roots);
    await expect(
      measureVercelStorefrontCost({
        after: {
          inputPath: afterPath,
          window: {
            deploymentSha: MEASUREMENT_AFTER_SHA,
            label: 'after',
          },
        },
        before: {
          inputPath: beforePath,
          window: {
            deploymentSha: MEASUREMENT_BEFORE_SHA,
            label: 'before',
            requestedWindowEnd: '2026-08-02T00:00:00.000Z',
            requestedWindowStart: '2026-08-01T00:00:00.000Z',
          },
        },
        projectId: MEASUREMENT_PROJECT_ID,
      })
    ).rejects.toThrow(
      'before and after measurement windows must both supply requested windows or neither'
    );
  });

  it('bugfix: suppresses relative percentages for non-positive cost baselines', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vercel-cost-neg-base-'));
    roots.push(root);
    const beforePath = join(root, 'before.jsonl');
    const afterPath = join(root, 'after.jsonl');
    await writeFile(
      beforePath,
      `${JSON.stringify({
        ChargePeriodStart: '2026-08-01T00:00:00.000Z',
        ChargePeriodEnd: '2026-08-02T00:00:00.000Z',
        ConsumedQuantity: 0,
        EffectiveCost: -1,
        ServiceName: 'Function Invocations',
        Tags: { ProjectId: MEASUREMENT_PROJECT_ID },
      })}\n`
    );
    await writeFile(
      afterPath,
      `${JSON.stringify({
        ChargePeriodStart: '2026-08-01T00:00:00.000Z',
        ChargePeriodEnd: '2026-08-02T00:00:00.000Z',
        ConsumedQuantity: 0,
        EffectiveCost: 0,
        ServiceName: 'Function Invocations',
        Tags: { ProjectId: MEASUREMENT_PROJECT_ID },
      })}\n`
    );

    const result = await measureVercelStorefrontCost({
      after: {
        inputPath: afterPath,
        window: { deploymentSha: MEASUREMENT_AFTER_SHA, label: 'after' },
      },
      before: {
        inputPath: beforePath,
        window: { deploymentSha: MEASUREMENT_BEFORE_SHA, label: 'before' },
      },
      projectId: MEASUREMENT_PROJECT_ID,
    });

    expect(result.comparison?.projectEffectiveCostUsd).toEqual({
      absoluteDelta: 1,
      after: 0,
      before: -1,
      relativeChangePct: null,
    });
  });

  it('bugfix: rejects EffectiveCost totals outside the safe integer range', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vercel-cost-overflow-'));
    roots.push(root);
    const path = join(root, 'overflow.jsonl');
    await writeFile(
      path,
      `${JSON.stringify({
        ChargePeriodStart: '2026-08-01T00:00:00.000Z',
        ChargePeriodEnd: '2026-08-02T00:00:00.000Z',
        ConsumedQuantity: 0,
        EffectiveCost: Number.MAX_SAFE_INTEGER,
        ServiceName: 'Function Invocations',
        Tags: { ProjectId: MEASUREMENT_PROJECT_ID },
      })}\n${JSON.stringify({
        ChargePeriodStart: '2026-08-01T00:00:00.000Z',
        ChargePeriodEnd: '2026-08-02T00:00:00.000Z',
        ConsumedQuantity: 0,
        EffectiveCost: 2,
        ServiceName: 'Function Invocations',
        Tags: { ProjectId: MEASUREMENT_PROJECT_ID },
      })}\n`
    );

    await expect(
      measureVercelStorefrontCost({
        before: {
          inputPath: path,
          window: { deploymentSha: MEASUREMENT_BEFORE_SHA, label: 'before' },
        },
        projectId: MEASUREMENT_PROJECT_ID,
      })
    ).rejects.toThrow(
      'billing export EffectiveCost total is out of safe range'
    );
  });
});
