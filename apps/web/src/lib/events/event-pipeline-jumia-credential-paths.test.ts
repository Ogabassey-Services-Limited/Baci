import { describe, expect, it } from 'vitest';
import { eventPipelineJumiaCredentialPaths } from './event-pipeline-jumia-credential-paths';

describe('eventPipelineJumiaCredentialPaths', () => {
  it('allows only the audited Jumia OAuth credential paths', () => {
    expect(eventPipelineJumiaCredentialPaths).toHaveLength(13);
    expect(eventPipelineJumiaCredentialPaths).toContainEqual([
      'apps/web/src/app/api/marketplace/jumia/callback/runtime-impl.ts',
      'apps/web/src/env.ts',
    ]);
  });
});
