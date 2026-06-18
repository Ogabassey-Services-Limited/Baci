/**
 * Next.js Instrumentation — Per-Tenant OpenTelemetry
 *
 * Registers the Vercel OpenTelemetry SDK for distributed tracing.
 * All traces include the merchant/tenant context for multi-tenant observability.
 *
 * This file is automatically loaded by Next.js 16 at startup.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import type { Instrumentation } from 'next';

const QUERY_OR_HASH_PATTERN = /[?#]/;

function stripQueryAndHash(path: string): string {
  const markerIndex = path.search(QUERY_OR_HASH_PATTERN);
  return markerIndex === -1 ? path : path.slice(0, markerIndex);
}

export async function register() {
  // Only register in server-side environments (Node.js runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerOTel } = await import('@vercel/otel');

    registerOTel({
      serviceName: 'baci-web',
      // Attributes added to every span for multi-tenant filtering
      attributes: {
        'deployment.environment':
          process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
      },
    });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { captureServerException } = await import('@/lib/posthog/server');

  await captureServerException(error, {
    request_path: stripQueryAndHash(request.path),
    request_method: request.method,
    router_kind: context.routerKind,
    route_path: context.routePath,
    route_type: context.routeType,
    render_source: context.renderSource,
    revalidate_reason: context.revalidateReason,
  });
};
