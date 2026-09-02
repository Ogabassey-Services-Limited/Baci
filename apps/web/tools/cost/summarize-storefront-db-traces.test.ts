import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_INPUT_ROWS } from './measure-vercel-storefront-cost-types';
import { summarizeStorefrontDbTraces } from './summarize-storefront-db-traces';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true }))
  );
});

describe('summarizeStorefrontDbTraces', () => {
  it('aggregates bounded calls, timeouts, and route cohorts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'storefront-db-trace-'));
    roots.push(root);
    const path = join(root, 'trace.jsonl');
    await writeFile(
      path,
      `${JSON.stringify({ cohort: 'pdp', dbCalls: 3, dbTimeouts: 1 })}\n${JSON.stringify({ cohort: 'pdp', dbCalls: 1, dbTimeouts: 0 })}\n${JSON.stringify({ dbCalls: 2, dbTimeouts: 0 })}\n`
    );

    await expect(summarizeStorefrontDbTraces(path)).resolves.toMatchObject({
      dbCalls: 6,
      dbCallsPerRequest: 2,
      dbTimeoutRate: 0.166667,
      dbTimeouts: 1,
      rows: 3,
      byCohort: {
        pdp: {
          dbCalls: 4,
          dbCallsPerRequest: 2,
          dbTimeoutRate: 0.25,
          dbTimeouts: 1,
          rows: 2,
        },
      },
    });
  });

  it('fails closed for malformed rows and unbounded input', async () => {
    const root = await mkdtemp(join(tmpdir(), 'storefront-db-trace-invalid-'));
    roots.push(root);
    const invalidPath = join(root, 'invalid.jsonl');
    await writeFile(invalidPath, '{"dbCalls":1,"dbTimeouts":2}\n');
    await expect(summarizeStorefrontDbTraces(invalidPath)).rejects.toThrow(
      'more timeouts than calls'
    );

    const oversizedPath = join(root, 'oversized.jsonl');
    await writeFile(
      oversizedPath,
      `${JSON.stringify({ dbCalls: 1 })}\n`.repeat(MAX_INPUT_ROWS + 1)
    );
    await expect(summarizeStorefrontDbTraces(oversizedPath)).rejects.toThrow(
      'exceeds the 100000-row bound'
    );
  });
});
