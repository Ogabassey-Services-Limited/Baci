import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importReviewedEvidenceModule } from './cloudflare-evidence-reviewed-module-loader';

describe('importReviewedEvidenceModule', () => {
  it('imports the supplied byte closure rather than the source paths', async () => {
    const workspaceRoot = resolve(process.cwd());
    const loaded = (await importReviewedEvidenceModule(
      workspaceRoot,
      resolve(workspaceRoot, 'authority.mjs'),
      [
        {
          path: resolve(workspaceRoot, 'authority.mjs'),
          source: Buffer.from(
            'export { value } from "./authority-dependency.mjs";'
          ),
        },
        {
          path: resolve(workspaceRoot, 'authority-dependency.mjs'),
          source: Buffer.from('export const value = 42;'),
        },
      ]
    )) as { value: number };
    expect(loaded.value).toBe(42);
  });

  it('retains the private closure while a factory performs a deferred import', async () => {
    const workspaceRoot = resolve(process.cwd());
    const value = await importReviewedEvidenceModule(
      workspaceRoot,
      resolve(workspaceRoot, 'factory.mjs'),
      [
        {
          path: resolve(workspaceRoot, 'factory.mjs'),
          source: Buffer.from(
            'export async function create() { return (await import("./factory-dependency.mjs")).value; }'
          ),
        },
        {
          path: resolve(workspaceRoot, 'factory-dependency.mjs'),
          source: Buffer.from('export const value = 42;'),
        },
      ],
      async (loaded) => {
        if (
          !loaded ||
          typeof loaded !== 'object' ||
          !('create' in loaded) ||
          typeof loaded.create !== 'function'
        )
          throw new Error('factory fixture is invalid');
        return loaded.create();
      }
    );
    expect(value).toBe(42);
  });

  it('rejects a closure entry outside the workspace', async () => {
    const workspaceRoot = resolve(process.cwd());
    await expect(
      importReviewedEvidenceModule(workspaceRoot, '/tmp/authority.mjs', [])
    ).rejects.toThrow('outside the workspace');
  });
});
