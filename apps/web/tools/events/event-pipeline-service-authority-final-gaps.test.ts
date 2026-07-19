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
