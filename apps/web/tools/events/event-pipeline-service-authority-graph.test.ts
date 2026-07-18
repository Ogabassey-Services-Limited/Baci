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

  it('allows the type-only SDK import used by the mobile useAuth hook', () => {
    const path = 'apps/mobile-admin/hooks/useAuth.ts';
    const sources = new Map([
      [
        path,
        "import type { Session, User } from '@supabase/supabase-js'; export type State = { session: Session; user: User };",
      ],
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
      'apps/web/src/app/api/fourth/route.ts: API import graph reaches service authority apps/web/src/lib/events/event-pipeline-service-role-test-client.ts',
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

  it('allows a declared service route to reach the canonical factory directly', () => {
    const route =
      'apps/web/src/app/api/payments/credit-direct/webhook/route.ts';
    const service = 'apps/web/src/lib/supabase/service.ts';
    const sources = new Map([
      [route, "import { createServiceClient } from '@/lib/supabase/service';"],
      [service, 'export const createServiceClient = () => null;'],
    ]);

    expect(serviceAuthorityGraphFindings(sources, [route])).toEqual([]);
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
      `${route}: API import graph reaches service authority apps/web/src/lib/events/event-pipeline-service-role-test-client.ts`,
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
