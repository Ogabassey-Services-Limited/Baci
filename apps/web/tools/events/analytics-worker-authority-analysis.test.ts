import { describe, expect, it } from 'vitest';
import { analyzeAnalyticsWorkerAuthority } from './analytics-worker-authority-analysis';

const routerWorker = 'apps/web/src/scripts/process-domain-events.ts';
const deliveryWorker = 'apps/web/src/scripts/process-event-deliveries.ts';
const delivery = 'apps/web/src/lib/events/deliver-domain-event.ts';
const adapter = 'apps/web/src/lib/events/analytics-destination-adapter.ts';

function authorizedSources(): Map<string, string> {
  return new Map([
    [routerWorker, 'export const route = true;'],
    [deliveryWorker, "import '@/lib/events/deliver-domain-event';"],
    [delivery, "import './analytics-destination-adapter';"],
    [adapter, 'export const deliverAnalyticsEvent = true;'],
  ]);
}

describe('analyzeAnalyticsWorkerAuthority', () => {
  it('accepts the durable authority reachable only from declared workers', () => {
    expect(analyzeAnalyticsWorkerAuthority(authorizedSources())).toEqual([]);
  });

  it('rejects a non-worker graph that reaches durable analytics authority', () => {
    const sources = authorizedSources();
    const path = 'apps/web/src/lib/events/unauthorized-delivery.ts';
    sources.set(path, "import './deliver-domain-event';");

    expect(analyzeAnalyticsWorkerAuthority(sources)).toEqual([
      `${path}: non-worker graph reaches durable analytics authority: ${path} -> ${delivery} -> ${adapter}`,
    ]);
  });

  it('follows a test-named bridge reached by a production route', () => {
    const sources = authorizedSources();
    const bridge = 'apps/web/src/lib/events/delivery-bridge.test.ts';
    const route = 'apps/web/src/app/api/example/route.ts';
    sources.set(route, "import '@/lib/events/delivery-bridge.test';");
    sources.set(bridge, "import './analytics-destination-adapter';");

    expect(analyzeAnalyticsWorkerAuthority(sources)).toContain(
      `${route}: independently executable entrypoint reaches durable analytics authority: ${route} -> ${bridge} -> ${adapter}`
    );
  });

  it('continues to ignore a standalone test-named adapter importer', () => {
    const sources = authorizedSources();
    sources.set(
      'apps/web/src/lib/events/standalone-adapter.spec.ts',
      "import './analytics-destination-adapter';"
    );

    expect(analyzeAnalyticsWorkerAuthority(sources)).toEqual([]);
  });

  it('fails closed when a declared worker root is absent', () => {
    const sources = authorizedSources();
    sources.delete(deliveryWorker);

    expect(analyzeAnalyticsWorkerAuthority(sources)).toContain(
      `${deliveryWorker}: declared analytics worker root is missing`
    );
  });

  it('rejects a route that reaches worker authority through a shared use-server module', () => {
    const sources = authorizedSources();
    const shared = 'apps/web/src/lib/events/shared-delivery-action.ts';
    const route = 'apps/web/src/app/api/example/route.ts';
    sources.set(
      deliveryWorker,
      "import '@/lib/events/shared-delivery-action';"
    );
    sources.set(
      shared,
      "'use server';\nimport './analytics-destination-adapter';"
    );
    sources.set(route, "import '@/lib/events/shared-delivery-action';");

    expect(analyzeAnalyticsWorkerAuthority(sources)).toContain(
      `${route}: independently executable entrypoint reaches durable analytics authority: ${route} -> ${shared} -> ${adapter}`
    );
  });

  it('rejects an independently executable route imported by a worker', () => {
    const sources = authorizedSources();
    const route = 'apps/web/src/app/api/hidden/route.ts';
    sources.set(deliveryWorker, "import '@/app/api/hidden/route';");
    sources.set(route, "import '@/lib/events/analytics-destination-adapter';");

    expect(analyzeAnalyticsWorkerAuthority(sources)).toContain(
      `${route}: independently executable entrypoint reaches durable analytics authority: ${route} -> ${adapter}`
    );
  });

  it('rejects Next instrumentation authority imported by a worker', () => {
    const sources = authorizedSources();
    const instrumentation = 'apps/web/src/instrumentation.ts';
    sources.set(deliveryWorker, "import '../instrumentation';");
    sources.set(
      instrumentation,
      "import '@/lib/events/analytics-destination-adapter';"
    );

    expect(analyzeAnalyticsWorkerAuthority(sources)).toContain(
      `${instrumentation}: independently executable entrypoint reaches durable analytics authority: ${instrumentation} -> ${adapter}`
    );
  });

  it('rejects a metadata route imported by a worker', () => {
    const sources = authorizedSources();
    const sitemap = 'apps/web/src/app/sitemap.ts';
    sources.set(deliveryWorker, "import '../app/sitemap';");
    sources.set(
      sitemap,
      "import '@/lib/events/analytics-destination-adapter';"
    );

    expect(analyzeAnalyticsWorkerAuthority(sources)).toContain(
      `${sitemap}: independently executable entrypoint reaches durable analytics authority: ${sitemap} -> ${adapter}`
    );
  });

  it('rejects dual reachability through an extensionless dotted basename', () => {
    const sources = authorizedSources();
    const shared = 'apps/web/src/lib/events/shared.server.ts';
    const route = 'apps/web/src/app/api/example/route.ts';
    sources.set(deliveryWorker, "import '@/lib/events/shared.server.js';");
    sources.set(shared, "import './analytics-destination-adapter';");
    sources.set(route, "import '@/lib/events/shared.server';");

    expect(analyzeAnalyticsWorkerAuthority(sources)).toContain(
      `${route}: independently executable entrypoint reaches durable analytics authority: ${route} -> ${shared} -> ${adapter}`
    );
  });
});
