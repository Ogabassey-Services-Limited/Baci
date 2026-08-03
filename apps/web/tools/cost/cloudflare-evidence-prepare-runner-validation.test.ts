import { afterEach, describe, expect, it, vi } from 'vitest';

const importReviewedEvidenceModule = vi.hoisted(() => vi.fn());
vi.mock('./cloudflare-evidence-reviewed-module-loader', () => ({
  importReviewedEvidenceModule,
}));

import { validatePreparedEvidenceRunnerFactory } from './cloudflare-evidence-prepare-runner-validation';

const descriptor = {
  path: '/workspace/read-revocation.ts',
  sha256: 'a'.repeat(64),
  files: [],
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('validatePreparedEvidenceRunnerFactory', () => {
  it('accepts the reviewed read-revocation adapter factory', async () => {
    importReviewedEvidenceModule.mockImplementation(
      async (_workspaceRoot, _path, _files, use) =>
        use({ createRevocationReadbackClient: () => undefined })
    );

    await expect(
      validatePreparedEvidenceRunnerFactory(
        '/workspace',
        descriptor,
        'readRevocation'
      )
    ).resolves.toBeUndefined();
  });

  it('rejects a reviewed read-revocation module without its factory', async () => {
    importReviewedEvidenceModule.mockImplementation(
      async (_workspaceRoot, _path, _files, use) => use({})
    );

    await expect(
      validatePreparedEvidenceRunnerFactory(
        '/workspace',
        descriptor,
        'readRevocation'
      )
    ).rejects.toThrow('authenticated read-token revocation module is invalid');
  });
});
