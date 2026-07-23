import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { forwardRepairDeploymentReceiptSchema } from './forward-repair-deployment-receipt-schema';

async function receipt(): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(
      path.resolve(
        import.meta.dirname,
        '../fixtures/forward-repair-deployment-receipt.json'
      ),
      'utf8'
    )
  ) as Record<string, unknown>;
}

describe('forwardRepairDeploymentReceiptSchema', () => {
  it('accepts only the exact deployed repair pair', async () => {
    const parsed = forwardRepairDeploymentReceiptSchema.parse(await receipt());
    expect(parsed.repairs.map(({ logOrdinal }) => logOrdinal)).toEqual([2, 3]);
  });

  it('rejects changed release, job, digest, path, or ordinal evidence', async () => {
    const mutations: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        (value.release as Record<string, unknown>).mergeSha = '0'.repeat(40);
      },
      (value) => {
        (value.deployment as Record<string, unknown>).databaseJobId = 1;
      },
      (value) => {
        (value.deployment as Record<string, unknown>).sanitizedJobLogSha256 =
          '0'.repeat(64);
      },
      (value) => {
        const repairs = value.repairs as Record<string, unknown>[];
        repairs[0].path = repairs[1].path;
      },
      (value) => {
        const repairs = value.repairs as Record<string, unknown>[];
        repairs[0].logOrdinal = 1;
      },
    ];
    for (const mutate of mutations) {
      const value = await receipt();
      mutate(value);
      expect(
        forwardRepairDeploymentReceiptSchema.safeParse(value).success
      ).toBe(false);
    }
  });
});
