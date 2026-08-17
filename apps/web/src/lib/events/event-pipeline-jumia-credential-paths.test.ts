import { describe, expect, it } from 'vitest';
import {
  clientCredentialSuffixes,
  eventPipelineJumiaCredentialPaths,
  jumiaApiRoutesUsingClient,
} from './event-pipeline-jumia-credential-paths';

describe('eventPipelineJumiaCredentialPaths', () => {
  it('includes every audited API-route credential suffix', () => {
    for (const route of jumiaApiRoutesUsingClient) {
      for (const suffix of clientCredentialSuffixes) {
        expect(eventPipelineJumiaCredentialPaths).toContainEqual([
          route,
          ...suffix,
        ]);
      }
    }
  });

  it('includes callback and client persistence paths', () => {
    expect(eventPipelineJumiaCredentialPaths).toContainEqual([
      'apps/web/src/app/api/marketplace/jumia/callback/runtime-impl.ts',
      'apps/web/src/env.ts',
    ]);
    expect(eventPipelineJumiaCredentialPaths).toContainEqual([
      'apps/web/src/lib/jumia/client.ts',
      'apps/web/src/lib/jumia/jumia-client-token-persistence.ts',
      'apps/web/src/lib/jumia/helpers.ts',
      'apps/web/src/env.ts',
    ]);
  });
});
