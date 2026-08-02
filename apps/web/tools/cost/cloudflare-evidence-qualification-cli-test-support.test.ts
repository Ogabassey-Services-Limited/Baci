import { chmod, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  currentQualificationReadback,
  writeValidationArtifacts,
} from './cloudflare-evidence-qualification-cli-test-support';

describe('qualification CLI test support', () => {
  it('creates a self-bound readback and private validation artifacts', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'baci-qualification-support-')
    );
    await chmod(directory, 0o700);
    try {
      const receipt = currentQualificationReadback();
      expect(receipt.runBinding.measurementPayloadSha256).toMatch(
        /^[a-f0-9]{64}$/
      );

      const paths = await writeValidationArtifacts(directory, receipt);
      for (const path of Object.values(paths).filter(
        (value): value is string => typeof value === 'string'
      )) {
        const file = await stat(path);
        expect(file.mode & 0o777).toBe(0o600);
      }
      await expect(
        readFile(paths.receipt, 'utf8').then((value) => JSON.parse(value))
      ).resolves.toEqual(receipt);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
