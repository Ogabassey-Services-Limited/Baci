import { describe, expect, it } from 'vitest';
import {
  hasReviewedQualificationArtifactIdentity,
  isQualificationControlEvidenceInScope,
} from './cloudflare-evidence-qualification-control-scope';
import {
  readback,
  reviewedArtifacts,
} from './qualify-cloudflare-evidence-sources.test-fixtures';

describe('qualification control scope', () => {
  it('accepts the reviewed account/script control receipts', () => {
    expect(
      isQualificationControlEvidenceInScope(
        readback.controlEvidence,
        'account',
        readback.scriptName
      )
    ).toBe(true);
    expect(
      hasReviewedQualificationArtifactIdentity(
        reviewedArtifacts,
        readback.scriptName,
        'account'
      )
    ).toBe(true);
  });

  it('rejects an account or script scope substitution', () => {
    expect(
      isQualificationControlEvidenceInScope(
        {
          ...readback.controlEvidence,
          topology: readback.controlEvidence.topology.map((receipt, index) =>
            index === 0
              ? {
                  ...receipt,
                  endpoint: receipt.endpoint.replace(
                    '/accounts/account/',
                    '/accounts/other/'
                  ),
                }
              : receipt
          ),
        },
        'account',
        readback.scriptName
      )
    ).toBe(false);
    expect(
      hasReviewedQualificationArtifactIdentity(
        reviewedArtifacts.map((artifact, index) =>
          index === 0 ? { ...artifact, scriptName: 'other-worker' } : artifact
        ),
        readback.scriptName,
        'account'
      )
    ).toBe(false);
  });
});
