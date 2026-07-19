import { describe, expect, it } from 'vitest';
import { serviceAuthorityGraphFindings } from './event-pipeline-service-authority-graph';

describe('event pipeline service authority graph', () => {
  it('treats a test-named bridge as production when a route reaches it', () => {
    const route = 'apps/web/src/app/api/fourth/route.ts';
    const bridge = 'apps/web/src/lib/events/authority-bridge.test.ts';
    const sources = new Map([
      [route, "import '@/lib/events/authority-bridge.test';"],
      [
        bridge,
        "import { createClient } from '@supabase/supabase-js/dist/index.mjs'; createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);",
      ],
    ]);
    expect(serviceAuthorityGraphFindings(sources)).toContain(
      `${bridge}: unauthorized sdk factory importer`
    );
  });
  it('rejects a credential-only test bridge reached by a production route', () => {
    const route = 'apps/web/src/app/api/fourth/route.ts';
    const bridge = 'apps/web/src/lib/events/credential-bridge.spec.ts';
    const sources = new Map([
      [route, "import '@/lib/events/credential-bridge.spec';"],
      [bridge, 'use(process.env.SUPABASE_SERVICE_ROLE_KEY);'],
    ]);
    expect(serviceAuthorityGraphFindings(sources)).toContain(
      `${bridge}: service-role credential read is forbidden`
    );
  });
  it('continues to ignore a standalone test-named authority module', () => {
    const test = 'apps/web/src/lib/events/standalone-authority.spec.ts';
    const sources = new Map([
      [
        test,
        "import { createClient } from '@supabase/supabase-js'; createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);",
      ],
    ]);
    expect(serviceAuthorityGraphFindings(sources)).toEqual([]);
  });
  it('allows the normal request-scoped server client used by dashboard settings', () => {
    const path = 'apps/web/src/app/dashboard/settings/actions.ts';
    const sources = new Map([
      [path, "import { createClient } from '@/lib/supabase/server';"],
      [
        'apps/web/src/lib/supabase/server.ts',
        'export const createClient = () => null;',
      ],
    ]);
    expect(serviceAuthorityGraphFindings(sources, [path])).toEqual([]);
  });
  // biome-ignore format: authority reference fixtures stay compact under the 300-line gate.
  it.each([
    ['apps/mobile-admin/hooks/useAuth.ts', "import type { Session, User } from '@supabase/supabase-js'; export type State = { session: Session; user: User };"],
    ['apps/web/src/app/api/fourth/route.ts', "export { type ServiceClient } from '@/lib/supabase/service';"],
    ['apps/web/src/app/api/fourth/route.ts', "export type { ServiceClient } from '@/lib/supabase/service';"],
  ])('allows a type-only authority reference from %s', (path, source) => {
    const sources = new Map([
      [path, source],
      ['apps/web/src/lib/supabase/service.ts', 'export type ServiceClient = object;'],
    ]);
    expect(serviceAuthorityGraphFindings(sources, [path])).toEqual([]);
  });
  it('allows an ordinary runtime SDK import without a service-role credential', () => {
    const path = 'apps/mobile-admin/lib/supabase.ts';
    const sources = new Map([
      [
        path,
        "import { createClient } from '@supabase/supabase-js'; createClient(url, anonKey);",
      ],
    ]);
    expect(serviceAuthorityGraphFindings(sources, [path])).toEqual([]);
  });
  it.each([
    '@/lib/supabase/admin',
    '@/lib/supabase/service',
  ])('still rejects canonical privileged factory %s', (specifier) => {
    const path = 'apps/web/src/lib/events/rogue-factory.ts';
    const target = specifier.endsWith('/admin')
      ? 'apps/web/src/lib/supabase/admin.ts'
      : 'apps/web/src/lib/supabase/service.ts';
    const sources = new Map([
      [path, `import '${specifier}';`],
      [target, 'export const createClient = () => null;'],
    ]);
    expect(serviceAuthorityGraphFindings(sources, [path])).toEqual([
      `${path}: unauthorized ${specifier.endsWith('/admin') ? 'admin' : 'service'} factory importer`,
    ]);
  });
  it('rejects a deep SDK service-role construction', () => {
    const path = 'apps/web/src/lib/events/rogue-sdk-client.ts';
    const sources = new Map([
      [
        path,
        "import { createClient } from '@supabase/supabase-js/dist/index.mjs'; createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);",
      ],
    ]);
    expect(serviceAuthorityGraphFindings(sources, [path])).toEqual(
      expect.arrayContaining([
        `${path}: service-role credential read is forbidden`,
        `${path}: unauthorized sdk factory importer`,
      ])
    );
  });
  it.each([
    [
      'relative import',
      "import { createServiceClient } from '../supabase/service';",
    ],
    [
      'require call',
      "const { createServiceClient } = require('@/lib/supabase/service');",
    ],
    [
      'computed dynamic import',
      "const directory = '@/lib/supabase/'; void import(directory + 'service');",
    ],
  ])('rejects a non-route %s of the privileged service factory', (_, source) => {
    const path = 'apps/web/src/lib/events/rogue-service-importer.ts';
    const sources = new Map([
      [path, source],
      [
        'apps/web/src/lib/supabase/service.ts',
        'export const createServiceClient = () => null;',
      ],
    ]);
    expect(serviceAuthorityGraphFindings(sources, [path])).toContain(
      `${path}: unauthorized service factory importer`
    );
  });
  it('subtracts inherited edges but rejects a new route to an inherited admin helper', () => {
    const route = 'apps/web/src/app/api/fourth/route.ts';
    const helper = 'apps/web/src/lib/inherited-admin.ts';
    const admin = 'apps/web/src/lib/supabase/admin.ts';
    // biome-ignore format: compact edge fixture preserves the 300-line test ceiling.
    const frozen = new Map([[route, 'export const unchangedAuthority = true;'], [helper, "import '@/lib/supabase/admin';"], [admin, 'export const createAdminClient = () => null;']]);
    const edited = new Map(frozen);
    edited.set(route, 'export const nonAuthorityEdit = true;');
    expect(serviceAuthorityGraphFindings(edited, [route], frozen)).toEqual([]);
    edited.set(route, "import '@/lib/inherited-admin';");
    // biome-ignore format: compact full-path assertion preserves the 300-line test ceiling.
    expect(serviceAuthorityGraphFindings(edited, [route], frozen)).toEqual([expect.stringContaining(`${route} -> ${helper} -> ${admin}`)]);
  });
  // biome-ignore format: paired frozen/current fixtures prove occurrence-aware authority subtraction.
  it.each([['first direct construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; createServiceClient('event-pipeline');"], ['additional direct construction', "import { createServiceClient } from '@/lib/supabase/service'; createServiceClient('event-pipeline');", "import { createServiceClient } from '@/lib/supabase/service'; createServiceClient('event-pipeline'); createServiceClient('event-pipeline');"], ['aliased ESM construction', "import { createServiceClient as make } from '@/lib/supabase/service';", "import { createServiceClient as make } from '@/lib/supabase/service'; make('event-pipeline');"], ['require construction', "require('@/lib/supabase/service');", "require('@/lib/supabase/service'); createServiceClient('event-pipeline');"], ['local alias construction', "import { createServiceClient } from '@/lib/supabase/service'; const make = createServiceClient;", "import { createServiceClient } from '@/lib/supabase/service'; const make = createServiceClient; make('event-pipeline');"], ['dynamic-import construction', "const { createServiceClient } = await import('@/lib/supabase/service');", "const { createServiceClient } = await import('@/lib/supabase/service'); createServiceClient('event-pipeline');"], ['bound construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; const bound = createServiceClient.bind(null); bound('event-pipeline');"], ['array-forwarded construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; const factories = [createServiceClient]; factories[0]('event-pipeline');"], ['array-destructured construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; const [make] = [createServiceClient]; make('event-pipeline');"], ['object-forwarded construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; const factories = { make: createServiceClient }; factories.make('event-pipeline');"], ['object-destructured construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; const { make } = { make: createServiceClient }; make('event-pipeline');"], ['IIFE-parameter construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; ((make) => make('event-pipeline'))(createServiceClient);"], ['IIFE-returned construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; const make = ((factory) => factory)(createServiceClient); make('event-pipeline');"], ['IIFE-chained construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; ((factory) => factory)(createServiceClient)('event-pipeline');"], ['call-forwarded construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; createServiceClient.call(null, 'event-pipeline');"], ['apply-forwarded construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; createServiceClient.apply(null, ['event-pipeline']);"], ['named identity construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; function forward(factory) { return factory; } const make = forward(createServiceClient); make('event-pipeline');"], ['named invoking-helper construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; function invoke(factory) { return factory('event-pipeline'); } invoke(createServiceClient);"], ['property-assigned construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; const bag = {}; bag.make = createServiceClient; bag.make('event-pipeline');"], ['block-IIFE-returned construction', "import { createServiceClient } from '@/lib/supabase/service';", "import { createServiceClient } from '@/lib/supabase/service'; const make = (function (factory) { return factory; })(createServiceClient); make('event-pipeline');"], ['call replacement', "import { createServiceClient } from '@/lib/supabase/service'; createServiceClient('event-pipeline');", "import { createServiceClient } from '@/lib/supabase/service'; createServiceClient.call(null, 'event-pipeline');"], ['bound replacement', "import { createServiceClient } from '@/lib/supabase/service'; createServiceClient('event-pipeline');", "import { createServiceClient } from '@/lib/supabase/service'; const bound = createServiceClient.bind(null); bound('event-pipeline');"], ['local-alias replacement', "import { createServiceClient } from '@/lib/supabase/service'; createServiceClient('event-pipeline');", "import { createServiceClient } from '@/lib/supabase/service'; const make = createServiceClient; make('event-pipeline');"]])('rejects a newly added %s behind inherited authority', (_, frozenSource, currentSource) => {
    const path = 'apps/web/src/lib/events/inherited-service-importer.ts';
    const service = 'apps/web/src/lib/supabase/service.ts';
    const frozen = new Map([[path, frozenSource], [service, 'export const createServiceClient = () => null;']]);
    const current = new Map(frozen);
    current.set(path, currentSource);
    expect(serviceAuthorityGraphFindings(current, [path])).toContain(`${path}: unauthorized service factory importer`);
    expect(serviceAuthorityGraphFindings(current, [path], frozen)).toContain(`${path}: unauthorized service factory importer`);
  });
  // biome-ignore format: compact structural-identity fixture preserves the 300-line test ceiling.
  it('keeps construction identity stable across non-authority edits', () => {
    const path = 'apps/web/src/lib/events/inherited-service-importer.ts'; const service = 'apps/web/src/lib/supabase/service.ts';
    const frozen = new Map([[path, "import { createServiceClient } from '@/lib/supabase/service'; createServiceClient('event-pipeline');"], [service, 'export const createServiceClient = () => null;']]);
    const current = new Map(frozen); current.set(path, `${frozen.get(path)} export const nonAuthorityEdit = true;`);
    expect(serviceAuthorityGraphFindings(current, [path])).toContain(`${path}: unauthorized service factory importer`);
    expect(serviceAuthorityGraphFindings(current, [path], frozen)).toEqual([]);
  });
  // biome-ignore format: exact import shapes distinguish safe aliases from credential authority.
  it.each([
    ["import { getSupabaseUrl as url, getSupabaseAnonKey as key } from '@/env';", false],
    ["export type { getSupabaseServiceRoleKey } from '@/env'; export { getSupabaseUrl as url, getSupabaseAnonKey as key } from '@/env';", false],
    ["export { getSupabaseUrl } from '@/env'; export { getSupabaseServiceRoleKey } from '@/env';", true],
    ["import { getSupabaseServiceRoleKey } from '@/env';", true],
    ["export { getSupabaseServiceRoleKey } from '@/env';", true],
    ["import * as env from '@/env';", true],
    ["void import('@/env');", true],
  ])('classifies credential bindings precisely', (source, forbidden) => {
    const route = 'apps/web/src/app/api/fourth/route.ts';
    // biome-ignore format: compact credential fixture preserves the 300-line test ceiling.
    const sources = new Map([[route, source], ['apps/web/src/env.ts', "export const getSupabaseUrl = () => 'url'; export const getSupabaseAnonKey = () => 'anon'; export const getSupabaseServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;"]]);
    const finding = serviceAuthorityGraphFindings(sources, [route]).some(
      (message) => message.includes('credential authority')
    );
    expect(finding).toBe(forbidden);
  });
  // biome-ignore format: credential export shapes stay compact under the 300-line gate.
  it.each([['a local export list', 'export const known = process.env.SUPABASE_SERVICE_ROLE_KEY; const hidden = process.env.SUPABASE_SERVICE_ROLE_KEY; export { hidden };', 'hidden'], ['a destructured export', 'export const known = process.env.SUPABASE_SERVICE_ROLE_KEY; export const { hidden } = { hidden: process.env.SUPABASE_SERVICE_ROLE_KEY };', 'hidden'], ['an unresolved export', 'export const known = process.env.SUPABASE_SERVICE_ROLE_KEY; export { missing };', 'missing']])('rejects credential access through %s', (_, targetSource, binding) => {
    const route = 'apps/web/src/app/api/fourth/route.ts';
    const target = 'apps/web/src/lib/events/credential-source.ts';
    const sources = new Map([[route, `import { ${binding} } from '@/lib/events/credential-source';`], [target, targetSource]]);
    expect(serviceAuthorityGraphFindings(sources, [route])).toContain(`${route}: API import graph reaches credential authority ${target}`);
  });
  it('rejects fourth-route indirect test-client authority', () => {
    const sources = new Map([
      [
        'apps/web/src/app/api/fourth/route.ts',
        "import '@/lib/events/service-facade';",
      ],
      [
        'apps/web/src/lib/events/service-facade.ts',
        "export * from '@/lib/events/event-pipeline-service-role-test-client';",
      ],
      [
        'apps/web/src/lib/events/event-pipeline-service-role-test-client.ts',
        'export const client = {};',
      ],
    ]);
    expect(serviceAuthorityGraphFindings(sources)).toEqual([
      expect.stringContaining(
        'apps/web/src/app/api/fourth/route.ts -> apps/web/src/lib/events/service-facade.ts -> apps/web/src/lib/events/event-pipeline-service-role-test-client.ts'
      ),
    ]);
  });
  it.each([
    [
      'server action',
      'apps/web/src/app/dashboard/orders/actions.ts',
      "'use server';\nimport { runDomainEventWorker } from '@/scripts/process-domain-events';",
    ],
    [
      'Pages API route',
      'apps/web/src/pages/api/process-events.ts',
      "import { runDomainEventWorker } from '@/scripts/process-domain-events'; export default function handler() {}",
    ],
    [
      'App Router page',
      'apps/web/src/app/worker-status/page.tsx',
      "import { runDomainEventWorker } from '@/scripts/process-domain-events'; export default function Page() { return null; }",
    ],
    [
      'Next instrumentation entrypoint',
      'apps/web/src/instrumentation.ts',
      "import { runDomainEventWorker } from '@/scripts/process-domain-events';",
    ],
  ])('rejects a %s that reaches a declared service worker', (_, surface, source) => {
    const worker = 'apps/web/src/scripts/process-domain-events.ts';
    const sources = new Map([
      [surface, source],
      [
        worker,
        "import { createServiceClient } from '@/lib/supabase/service'; export function runDomainEventWorker() { return createServiceClient('event-pipeline'); }",
      ],
      [
        'apps/web/src/lib/supabase/service.ts',
        'export const createServiceClient = () => null;',
      ],
    ]);
    expect(serviceAuthorityGraphFindings(sources)).toContain(
      `${surface}: production surface import graph reaches service authority ${worker}`
    );
  });
  it('allows the declared worker root and an ordinary internal worker module', () => {
    const worker = 'apps/web/src/scripts/process-domain-events.ts';
    const internal = 'apps/web/src/lib/events/domain-event-worker-loop.ts';
    const service = 'apps/web/src/lib/supabase/service.ts';
    const sources = new Map([
      [
        worker,
        "import '@/lib/events/domain-event-worker-loop'; import { createServiceClient } from '@/lib/supabase/service'; createServiceClient('event-pipeline');",
      ],
      [internal, "import '@/scripts/process-domain-events';"],
      [service, 'export const createServiceClient = () => null;'],
    ]);
    expect(serviceAuthorityGraphFindings(sources, [worker, internal])).toEqual(
      []
    );
  });
  it('rejects a JavaScript-family route that indirectly reaches service authority', () => {
    const route = 'apps/web/src/app/api/fourth/route.jsx';
    const sources = new Map([
      [route, "import '@/lib/events/service-facade'; export default null;"],
      [
        'apps/web/src/lib/events/service-facade.ts',
        "export * from '@/lib/events/event-pipeline-service-role-test-client';",
      ],
      [
        'apps/web/src/lib/events/event-pipeline-service-role-test-client.ts',
        'export const client = {};',
      ],
    ]);

    expect(serviceAuthorityGraphFindings(sources)).toEqual([
      expect.stringContaining(
        `${route} -> apps/web/src/lib/events/service-facade.ts -> apps/web/src/lib/events/event-pipeline-service-role-test-client.ts`
      ),
    ]);
  });

  it('rejects extra worker and test-client edges from approved routes', () => {
    const sources = new Map([
      [
        'apps/web/src/app/api/analytics/conversion/route.ts',
        "import '@/lib/events/event-pipeline-service-role-test-client';",
      ],
      [
        'apps/web/src/app/api/events/route.ts',
        "import '@/scripts/process-event-deliveries';",
      ],
      [
        'apps/web/src/lib/events/event-pipeline-service-role-test-client.ts',
        'export {};',
      ],
      ['apps/web/src/scripts/process-event-deliveries.ts', 'export {};'],
    ]);
    expect(serviceAuthorityGraphFindings(sources)).toHaveLength(2);
  });
});
