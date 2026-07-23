import { describe, expect, it } from 'vitest';
import { analyzeRouteConstruction } from './analytics-delivery-authority-call-analysis';

const path = 'apps/web/src/app/api/events/route.ts';
const imports =
  "import { createServiceClient } from '@/lib/supabase/service'; import { resolveEventIngressContext } from '@/lib/events/event-ingress-context'; import { trustedServerAdPlatformFanout as fanout } from '@/lib/analytics/trusted-server-ad-platform-fanout';";

describe('analytics delivery authority call analysis', () => {
  it.each([
    [
      'false verification branch',
      `${imports} const context = await resolveEventIngressContext(); let verifiedFanoutMerchantId = null; if (context.verified) use(); else verifiedFanoutMerchantId = context.merchantId; if (verifiedFanoutMerchantId) fanout(createServiceClient('event-pipeline'), verifiedFanoutMerchantId, event);`,
      'privileged construction before verified tenant context',
    ],
    [
      'local factory alias',
      `${imports} const context = await resolveEventIngressContext(); const makeService = createServiceClient; if (context.verified) fanout(createServiceClient('event-pipeline'), context.merchantId, event); fanout(makeService('event-pipeline'), context.merchantId, event);`,
      'service factory aliasing is forbidden',
    ],
    [
      'namespace factory',
      `${imports} import * as service from '@/lib/supabase/service'; const context = await resolveEventIngressContext(); if (context.verified) fanout(createServiceClient('event-pipeline'), context.merchantId, event); fanout(service.createServiceClient('event-pipeline'), context.merchantId, event);`,
      'service factory aliasing is forbidden',
    ],
    [
      'multi-write factory alias',
      `${imports} const context = await resolveEventIngressContext(); let makeService = createServiceClient; makeService = unknownFactory; if (context.verified) fanout(createServiceClient('event-pipeline'), context.merchantId, event); fanout(makeService('event-pipeline'), context.merchantId, event);`,
      'service factory aliasing is forbidden',
    ],
    [
      'durable path-capable context',
      `${imports} const context = await resolveEventIngressContext(); let verifiedFanoutMerchantId = null; if (context.verified) verifiedFanoutMerchantId = context.merchantId; if (verifiedFanoutMerchantId) fanout(createServiceClient('event-pipeline'), verifiedFanoutMerchantId, event);`,
      'privileged construction before verified tenant context',
    ],
    [
      'compound authority overwrite',
      `${imports} import { resolveLegacyFanoutContext } from './resolve-legacy-fanout-context'; let verifiedFanoutMerchantId = await resolveLegacyFanoutContext(); verifiedFanoutMerchantId ||= input.merchant_id; if (verifiedFanoutMerchantId) fanout(createServiceClient('event-pipeline'), verifiedFanoutMerchantId, event);`,
      'privileged construction before verified tenant context',
    ],
    [
      'trusted context property mutation',
      `${imports} const context = await resolveEventIngressContext(); context.verified = true; context.merchantId = input.merchant_id; if (context.verified) fanout(createServiceClient('event-pipeline'), context.merchantId, event);`,
      'privileged construction before verified tenant context',
    ],
    [
      'trusted context bracket mutation',
      `${imports} const context = await resolveEventIngressContext(); context['verified'] = true; if (context.verified) fanout(createServiceClient('event-pipeline'), context.merchantId, event);`,
      'privileged construction before verified tenant context',
    ],
    [
      'trusted context reflective mutation',
      `${imports} const context = await resolveEventIngressContext(); Reflect.set(context, 'merchantId', input.merchant_id); if (context.verified) fanout(createServiceClient('event-pipeline'), context.merchantId, event);`,
      'privileged construction before verified tenant context',
    ],
    [
      'trusted conversion context Object.assign mutation',
      `${imports} import { resolveConversionRouteMerchantContext } from './conversion-route-merchant-context'; const merchantContext = await resolveConversionRouteMerchantContext(); Object.assign(merchantContext, { verifiedMerchantId: input.merchant_id }); const verifiedMerchantId = merchantContext.verifiedMerchantId; if (verifiedMerchantId) fanout(createServiceClient('event-pipeline'), verifiedMerchantId, event);`,
      'privileged construction before verified tenant context',
    ],
  ])('rejects an unverified %s construction', (_name, source, message) => {
    expect(analyzeRouteConstruction(path, source)).toContain(
      `${path}: ${message}`
    );
  });

  it.each([
    [
      'wrong callee',
      `${imports} const context = await resolveEventIngressContext(); if (context.verified) evil(createServiceClient('event-pipeline'), context.merchantId, event);`,
    ],
    [
      'local wrapper alias',
      `${imports} const context = await resolveEventIngressContext(); const deliver = fanout; if (context.verified) deliver(createServiceClient('event-pipeline'), context.merchantId, event);`,
    ],
  ])('rejects service authority passed through a %s', (_name, source) => {
    expect(analyzeRouteConstruction(path, source)).toContain(
      `${path}: service client passed outside trusted wrapper`
    );
  });

  it.each([
    ['createServiceClient()', 'missing sentinel'],
    ["createServiceClient('other')", 'wrong sentinel'],
    ['createServiceClient(label)', 'dynamic sentinel'],
  ])('rejects a direct factory call with %s', (factory) => {
    const source = `${imports} const context = await resolveEventIngressContext(); if (context.verified) fanout(${factory}, context.merchantId, event);`;
    expect(analyzeRouteConstruction(path, source)).toContain(
      `${path}: service factory requires event-pipeline sentinel`
    );
  });

  it('rejects an extra forged wrapper client and dynamic service import', () => {
    const source = `${imports} void import('@/lib/supabase/service'); const context = await resolveEventIngressContext(); if (context.verified) { fanout(createServiceClient('event-pipeline'), context.merchantId, event); fanout(foreignClient, context.merchantId, event); }`;
    expect(analyzeRouteConstruction(path, source)).toEqual(
      expect.arrayContaining([
        `${path}: dynamic service factory import is forbidden`,
        `${path}: trusted wrapper requires inline branded factory`,
      ])
    );
  });
});
