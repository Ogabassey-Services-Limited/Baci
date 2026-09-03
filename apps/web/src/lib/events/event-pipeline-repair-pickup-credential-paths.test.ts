import { describe, expect, it } from 'vitest';
import { eventPipelineRepairPickupCredentialPaths } from './event-pipeline-repair-pickup-credential-paths';

describe('eventPipelineRepairPickupCredentialPaths', () => {
  it('allows only the audited repair pickup credential paths', () => {
    expect(eventPipelineRepairPickupCredentialPaths.length).toBeGreaterThan(10);
    expect(eventPipelineRepairPickupCredentialPaths).toContainEqual([
      'apps/web/src/lib/repairs/repair-pickup-receiver-client.ts',
      'apps/web/src/lib/supabase/scoped-jwt.ts',
      'apps/web/src/lib/agentic/jwt-signing-material.ts',
      'apps/web/src/env.ts',
    ]);
  });
});
