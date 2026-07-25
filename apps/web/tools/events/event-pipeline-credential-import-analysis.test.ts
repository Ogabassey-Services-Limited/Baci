import { describe, expect, it } from 'vitest';
import { eventPipelineCredentialImportAnalysis } from './event-pipeline-credential-import-analysis';

describe('event pipeline credential import analysis', () => {
  it('allows imports limited to public environment accessors', () => {
    const importer = 'apps/web/src/lib/events/root.ts';
    const target = 'apps/web/src/env.ts';
    const sources = new Map([
      [importer, "import { getSupabaseUrl } from '@/env';"],
      [
        target,
        'export const getSupabaseUrl = () => null; export const getSupabaseServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;',
      ],
    ]);

    expect(
      eventPipelineCredentialImportAnalysis.edgeIsRelevant(
        importer,
        target,
        sources
      )
    ).toBe(false);
  });

  it('treats getAppUrl as a public accessor (not a credential edge)', () => {
    // Regression: server-side-analytics.ts imports only getAppUrl from env.ts.
    // getAppUrl reads NEXT_PUBLIC_APP_URL (public), so this edge must NOT be an
    // authority edge — otherwise every transitive consumer (e.g. the checkout
    // page) is dragged into the frozen authority closure.
    const importer = 'apps/web/src/lib/server-side-analytics.ts';
    const target = 'apps/web/src/env.ts';
    const sources = new Map([
      [importer, "import { getAppUrl } from '@/env';"],
      [
        target,
        'export const getAppUrl = () => process.env.NEXT_PUBLIC_APP_URL; export const getSupabaseServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;',
      ],
    ]);

    expect(
      eventPipelineCredentialImportAnalysis.edgeIsRelevant(
        importer,
        target,
        sources
      )
    ).toBe(false);
  });

  it('still flags a public accessor imported alongside a secret accessor', () => {
    // The allowlist must not weaken the freeze: mixing getAppUrl with a secret
    // accessor in the same import keeps the edge relevant (fail closed).
    const importer = 'apps/web/src/lib/events/root.ts';
    const target = 'apps/web/src/env.ts';
    const sources = new Map([
      [
        importer,
        "import { getAppUrl, getSupabaseServiceRoleKey } from '@/env';",
      ],
      [
        target,
        'export const getAppUrl = () => process.env.NEXT_PUBLIC_APP_URL; export const getSupabaseServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;',
      ],
    ]);

    expect(
      eventPipelineCredentialImportAnalysis.edgeIsRelevant(
        importer,
        target,
        sources
      )
    ).toBe(true);
  });

  it.each([
    "import {} from '@/env';",
    "export {} from '@/env';",
  ])('fails closed for an empty runtime environment clause: %s', (source) => {
    const importer = 'apps/web/src/lib/events/root.ts';
    const target = 'apps/web/src/env.ts';
    const sources = new Map([
      [importer, source],
      [
        target,
        'export const getSupabaseServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;',
      ],
    ]);

    expect(
      eventPipelineCredentialImportAnalysis.edgeIsRelevant(
        importer,
        target,
        sources
      )
    ).toBe(true);
  });

  it.each([
    "import { type EnvironmentShape } from '@/env';",
    "export { type EnvironmentShape } from '@/env';",
  ])('ignores a type-only environment clause: %s', (source) => {
    const importer = 'apps/web/src/lib/events/root.ts';
    const target = 'apps/web/src/env.ts';
    const sources = new Map([
      [importer, source],
      [
        target,
        'export type EnvironmentShape = string; export const getSupabaseServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;',
      ],
    ]);

    expect(
      eventPipelineCredentialImportAnalysis.edgeIsRelevant(
        importer,
        target,
        sources
      )
    ).toBe(false);
  });

  it('recognizes an imported credential-bearing export', () => {
    const importer = 'apps/web/src/lib/events/root.ts';
    const target = 'apps/web/src/lib/events/credential-source.ts';
    const sources = new Map([
      [importer, "import { secret } from './credential-source';"],
      [target, 'export const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;'],
    ]);

    expect(
      eventPipelineCredentialImportAnalysis.edgeIsRelevant(
        importer,
        target,
        sources
      )
    ).toBe(true);
  });

  it('fails closed when a credential read cannot be attributed to an export', () => {
    const importer = 'apps/web/src/lib/events/root.ts';
    const target = 'apps/web/src/lib/events/credential-source.ts';
    const sources = new Map([
      [importer, "import { safe } from './credential-source';"],
      [
        target,
        'const secret = process.env.SUPABASE_SERVICE_ROLE_KEY; export const safe = () => Boolean(secret);',
      ],
    ]);

    expect(
      eventPipelineCredentialImportAnalysis.edgeIsRelevant(
        importer,
        target,
        sources
      )
    ).toBe(true);
  });
});
