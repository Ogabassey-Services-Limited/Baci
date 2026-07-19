import { describe, expect, it } from 'vitest';
import { serviceAuthorityGraphFindings } from './event-pipeline-service-authority-graph';

const path = 'apps/web/src/lib/events/changed-authority-root.ts';
const facade = 'apps/web/src/lib/events/service-facade.ts';
const service = 'apps/web/src/lib/supabase/service.ts';
const serviceSource = 'export const createServiceClient = () => null;';

function findings(
  currentSource: string,
  frozenSource = 'export const safe = true;'
): string[] {
  const frozen = new Map([
    [path, frozenSource],
    [facade, "export * from '@/lib/supabase/service';"],
    [service, serviceSource],
  ]);
  const current = new Map(frozen);
  current.set(path, currentSource);
  return serviceAuthorityGraphFindings(current, [path], frozen);
}

describe('event pipeline static service authority reachability', () => {
  it.each([
    [
      'aliased require literal',
      "const load = require; load('@/lib/events/service-facade');",
    ],
    ['dynamic import literal', "void import('@/lib/events/service-facade');"],
    ['direct local facade import', "import '@/lib/events/service-facade';"],
  ])('rejects a new %s through a local facade', (_, currentSource) => {
    expect(findings(currentSource).join('\n')).toContain(
      `${path} -> ${facade} -> ${service}`
    );
  });

  it('rejects a direct aliased require of the service factory', () => {
    expect(
      findings("const load = require; load('@/lib/supabase/service');")
    ).toContain(`${path}: unauthorized service factory importer`);
  });

  it.each([
    ['empty import', "import {} from '@/lib/supabase/service';"],
    ['empty re-export', "export {} from '@/lib/supabase/service';"],
  ])('rejects an %s of the service factory', (_, source) => {
    expect(findings(source)).toContain(
      `${path}: unauthorized service factory importer`
    );
  });

  it('checks every incoming edge when safe and privileged branches share a credential target', () => {
    const route = 'apps/web/src/app/api/fourth/route.ts';
    const safe = 'apps/web/src/lib/events/safe-env-branch.ts';
    const privileged = 'apps/web/src/lib/events/privileged-env-branch.ts';
    const env = 'apps/web/src/env.ts';
    const sources = new Map([
      [
        route,
        "import '@/lib/events/safe-env-branch'; import '@/lib/events/privileged-env-branch';",
      ],
      [safe, "import { getSupabaseUrl } from '@/env';"],
      [privileged, "import { getSupabaseServiceRoleKey } from '@/env';"],
      [
        env,
        "export const getSupabaseUrl = () => 'url'; export const getSupabaseServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;",
      ],
    ]);

    expect(serviceAuthorityGraphFindings(sources).join('\n')).toContain(
      `${route} -> ${privileged} -> ${env}`
    );
  });

  it('subtracts identical inherited static reachability after an arbitrary flow edit', () => {
    const inherited =
      "import { createServiceClient } from '@/lib/supabase/service';";

    expect(
      findings(
        `${inherited} if (enabled) left.send(createServiceClient);`,
        inherited
      )
    ).toEqual([]);
  });

  it('freezes changed inherited authority bytes only inside the requested envelope', () => {
    const inherited =
      "import { createServiceClient } from '@/lib/supabase/service';";
    const frozen = new Map([
      [path, inherited],
      [service, serviceSource],
    ]);
    const current = new Map(frozen);
    current.set(path, `${inherited}\n// formatting only`);

    expect(serviceAuthorityGraphFindings(current, [path], frozen)).toEqual([]);
    expect(
      serviceAuthorityGraphFindings(
        current,
        [path],
        frozen,
        new Set([path]),
        frozen
      )
    ).toContain(
      `${path}: inherited event-pipeline authority source bytes changed`
    );
  });

  it('fails closed instead of inferring a missing authority-byte baseline', () => {
    const inherited =
      "import { createServiceClient } from '@/lib/supabase/service';";
    const frozen = new Map([
      [path, inherited],
      [service, serviceSource],
    ]);
    const current = new Map(frozen);
    current.set(path, `${inherited}\n// changed bytes`);

    expect(
      serviceAuthorityGraphFindings(current, [path], frozen, new Set([path]))
    ).toContain(
      'event-pipeline: authority-byte baseline is required for inherited path freezing'
    );
  });

  it('freezes removal of inherited authority inside the requested envelope', () => {
    const inherited =
      "import { createServiceClient } from '@/lib/supabase/service';";
    const frozen = new Map([
      [path, inherited],
      [service, serviceSource],
    ]);
    const current = new Map(frozen);
    current.set(path, 'export const safe = true;');

    expect(
      serviceAuthorityGraphFindings(
        current,
        [path],
        frozen,
        new Set([path]),
        frozen
      )
    ).toContain(
      `${path}: inherited event-pipeline authority source bytes changed`
    );
  });

  it('freezes authority resurrected after a newer byte baseline removed it', () => {
    const inherited = "import '@/lib/supabase/service';";
    const frozen = new Map([
      [path, inherited],
      [service, serviceSource],
    ]);
    const authorityByteBaseline = new Map(frozen);
    authorityByteBaseline.set(path, 'export const safe = true;');
    const current = new Map(frozen);

    expect(
      serviceAuthorityGraphFindings(
        authorityByteBaseline,
        [path],
        frozen,
        new Set([path]),
        authorityByteBaseline
      )
    ).toEqual([]);
    expect(
      serviceAuthorityGraphFindings(
        current,
        [path],
        frozen,
        new Set([path]),
        authorityByteBaseline
      )
    ).toContain(
      `${path}: inherited event-pipeline authority source bytes changed`
    );
  });

  it('keeps type-only service references outside the runtime graph', () => {
    expect(
      findings("export type { ServiceClient } from '@/lib/supabase/service';")
    ).toEqual([]);
  });

  it('allows a manifested service importer', () => {
    const worker = 'apps/web/src/scripts/process-domain-events.ts';
    const sources = new Map([
      [
        worker,
        "import { createServiceClient } from '@/lib/supabase/service'; createServiceClient('event-pipeline');",
      ],
      [service, serviceSource],
    ]);

    expect(serviceAuthorityGraphFindings(sources, [worker])).toEqual([]);
  });
});
