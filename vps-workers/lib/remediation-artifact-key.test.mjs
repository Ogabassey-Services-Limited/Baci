import assert from 'node:assert/strict';
import { it } from 'node:test';
import { remediationArtifactKeyFor } from './remediation-artifact-key.mjs';

it('returns a bounded safe key for the canonical remediation case', () => {
  const artifactKey = remediationArtifactKeyFor({
    caseKey: `vercel:vercel_timeout:${'shared/'.repeat(80)}`,
  });

  assert.match(artifactKey, /^vercel-vercel_timeout-/);
  assert.match(artifactKey, /^[a-zA-Z0-9_-]+$/);
  assert.ok(artifactKey.length <= 180);
});
