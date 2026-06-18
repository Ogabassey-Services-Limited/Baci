import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestError, register } from './instrumentation';

const registerOTelMock = vi.hoisted(() => vi.fn());
const captureServerExceptionMock = vi.hoisted(() => vi.fn());

vi.mock('@vercel/otel', () => ({
  registerOTel: registerOTelMock,
}));

vi.mock('@/lib/posthog/server', () => ({
  captureServerException: captureServerExceptionMock,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('instrumentation register', () => {
  it('registers Vercel OpenTelemetry in the Node.js runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('VERCEL_ENV', 'preview');

    await register();

    expect(registerOTelMock).toHaveBeenCalledWith({
      attributes: {
        'deployment.environment': 'preview',
      },
      serviceName: 'baci-web',
    });
  });

  it('does not register OpenTelemetry outside the Node.js runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');

    await register();

    expect(registerOTelMock).not.toHaveBeenCalled();
  });
});

describe('onRequestError', () => {
  it('captures Next.js request errors with route context in the Node.js runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    const error = new Error('render failed');
    const request = {
      headers: {
        host: 'Ogabassey.com',
        'x-merchant-domain': 'Ogabassey.com',
        'x-merchant-slug': 'Ogabassey',
      },
      method: 'POST',
      path: '/checkout?email=buyer@example.com#payment',
    } as Parameters<typeof onRequestError>[1];
    const context = {
      renderSource: 'react-server-components',
      revalidateReason: undefined,
      routePath: '/checkout',
      routeType: 'render',
      routerKind: 'App Router',
    } as Parameters<typeof onRequestError>[2];

    await onRequestError(error, request, context);

    expect(captureServerExceptionMock).toHaveBeenCalledWith(error, {
      render_source: 'react-server-components',
      merchant_domain: 'ogabassey.com',
      merchant_slug: 'ogabassey',
      request_method: 'POST',
      request_host: 'ogabassey.com',
      request_path: '/checkout',
      revalidate_reason: undefined,
      route_path: '/checkout',
      route_type: 'render',
      router_kind: 'App Router',
    });
  });

  it('does not capture request errors outside the Node.js runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');

    await onRequestError(
      new Error('edge error'),
      {
        headers: {},
        method: 'GET',
        path: '/store',
      } as Parameters<typeof onRequestError>[1],
      {} as Parameters<typeof onRequestError>[2]
    );

    expect(captureServerExceptionMock).not.toHaveBeenCalled();
  });
});
