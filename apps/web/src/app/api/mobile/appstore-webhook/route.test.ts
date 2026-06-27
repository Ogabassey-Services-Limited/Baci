import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const STOREFRONT_SECRET = 'whsec_storefront_value';
const ADMIN_SECRET = 'whsec_admin_value';
const mockSecret = vi.fn<(app?: 'storefront' | 'admin') => string | undefined>(
  (app = 'storefront') => (app === 'admin' ? ADMIN_SECRET : STOREFRONT_SECRET)
);
vi.mock('@/env', () => ({
  getAppStoreConnectWebhookSecret: (app?: 'storefront' | 'admin') =>
    mockSecret(app),
}));

const mockReconcile = vi.fn();
vi.mock('@/lib/ios-live-build-reconcile', () => ({
  reconcileIosLiveBuild: (...args: unknown[]) => mockReconcile(...args),
}));

const BODY = JSON.stringify({ data: { type: 'appStoreVersionState' } });

function webhookRequest(
  body: string,
  signature?: string,
  app?: string
): NextRequest {
  const headers: Record<string, string> = {};
  if (signature !== undefined) headers['X-Apple-Signature'] = signature;
  const url = new URL('http://localhost:3000/api/mobile/appstore-webhook');
  if (app !== undefined) url.searchParams.set('app', app);
  return new NextRequest(url, { method: 'POST', body, headers });
}

function signatureFor(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

describe('POST /api/mobile/appstore-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSecret.mockImplementation((app = 'storefront') =>
      app === 'admin' ? ADMIN_SECRET : STOREFRONT_SECRET
    );
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');
    vi.stubEnv('MOBILE_ADMIN_UPDATES_ENABLED', 'true');
    mockReconcile.mockResolvedValue({
      synced: true,
      app: 'storefront',
      platform: 'ios',
      build: 360,
      versionString: '2.1.360',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 400 for an unknown app query param', async () => {
    const response = await POST(
      webhookRequest(BODY, signatureFor(BODY, STOREFRONT_SECRET), 'desktop')
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: 'Unknown app' });
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('returns 500 when the webhook secret is not configured', async () => {
    mockSecret.mockReturnValue(undefined);

    const response = await POST(
      webhookRequest(BODY, signatureFor(BODY, STOREFRONT_SECRET))
    );

    expect(response.status).toBe(500);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid signature', async () => {
    const response = await POST(webhookRequest(BODY, 'deadbeef'));

    expect(response.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('returns 401 when the signature header is missing', async () => {
    const response = await POST(webhookRequest(BODY));

    expect(response.status).toBe(401);
  });

  it('still reconciles live builds when user prompts are disabled', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'false');

    const response = await POST(
      webhookRequest(BODY, signatureFor(BODY, STOREFRONT_SECRET))
    );
    const json = await response.json();

    expect(mockReconcile).toHaveBeenCalledWith(
      'storefront',
      'app_store_connect_webhook'
    );
    expect(json).toEqual({
      synced: true,
      app: 'storefront',
      platform: 'ios',
      build: 360,
      versionString: '2.1.360',
    });
  });

  it('reconciles and reports the synced build for a valid signed storefront delivery', async () => {
    const response = await POST(
      webhookRequest(BODY, signatureFor(BODY, STOREFRONT_SECRET))
    );
    const json = await response.json();

    expect(mockReconcile).toHaveBeenCalledWith(
      'storefront',
      'app_store_connect_webhook'
    );
    expect(json).toEqual({
      synced: true,
      app: 'storefront',
      platform: 'ios',
      build: 360,
      versionString: '2.1.360',
    });
  });

  it('verifies with the admin secret and reconciles the admin app', async () => {
    mockReconcile.mockResolvedValue({
      synced: true,
      app: 'admin',
      platform: 'ios',
      build: 22,
      versionString: '2.0.1',
    });

    const response = await POST(
      webhookRequest(BODY, signatureFor(BODY, ADMIN_SECRET), 'admin')
    );
    const json = await response.json();

    expect(mockSecret).toHaveBeenCalledWith('admin');
    expect(mockReconcile).toHaveBeenCalledWith(
      'admin',
      'app_store_connect_webhook'
    );
    expect(json).toEqual({
      synced: true,
      app: 'admin',
      platform: 'ios',
      build: 22,
      versionString: '2.0.1',
    });
  });

  it('rejects an admin delivery signed with the storefront secret', async () => {
    const response = await POST(
      webhookRequest(BODY, signatureFor(BODY, STOREFRONT_SECRET), 'admin')
    );

    expect(response.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('passes through a no-op reconcile result', async () => {
    mockReconcile.mockResolvedValue({
      synced: false,
      skipped: 'no_live_version',
    });

    const response = await POST(
      webhookRequest(BODY, signatureFor(BODY, STOREFRONT_SECRET))
    );
    const json = await response.json();

    expect(json).toEqual({ skipped: 'no_live_version' });
  });

  it('returns 502 when reconcile throws', async () => {
    mockReconcile.mockRejectedValue(new Error('asc down'));

    const response = await POST(
      webhookRequest(BODY, signatureFor(BODY, STOREFRONT_SECRET))
    );

    expect(response.status).toBe(502);
  });
});
