import { describe, expect, it } from 'vitest';
import {
  loadOwnerAcceptanceAuthority,
  loadQualificationArtifactAuthority,
} from './cloudflare-evidence-qualification-authority-loader';

describe('qualification authority loader boundaries', () => {
  it('requires an independently reviewed owner authority descriptor', async () => {
    await expect(
      loadOwnerAcceptanceAuthority({}, '1'.repeat(40))
    ).rejects.toThrow(
      'independently authenticated owner acceptance readback is required'
    );
  });

  it('requires an independently reviewed artifact authority descriptor', async () => {
    await expect(
      loadQualificationArtifactAuthority({}, '1'.repeat(40))
    ).rejects.toThrow('reviewed qualification artifact authority is required');
  });
});
