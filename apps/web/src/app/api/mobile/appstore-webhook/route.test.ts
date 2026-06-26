import { createHmac, randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const SECRET = randomBytes(32).toString('hex');
const mockSecret = vi.fn<() => string | undefined>(() => SECRET);
vi.mock('@/env', () => ({
  getAppStoreConnectWebhookSecret: () => mockSecret(),
}));

const mockReconcile = vi.fn();
vi.mock('@/lib/ios-live-build-reconcile', () => ({
  reconcileIosLiveBuild: (...args: unknown[]) => mockReconcile(...args),
}));

const BODY = JSON.stringify({ data: { type: 'appStoreVersionState' } });

function webhookRequest(body: string, signature?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (signature !== undefined) headers['X-Apple-Signature'] = signature;
  return new NextRequest('http://localhost:3000/api/mobile/appstore-webhook', {
    method: 'POST',
    body,
    headers,
  });
}

function validSignature(body: string): string {
  return createHmac('sha256', SECRET).update(body, 'utf8').digest('hex');
}

describe('POST /api/mobile/appstore-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSecret.mockReturnValue(SECRET);
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'true');
    mockReconcile.mockResolvedValue({
      synced: true,
      platform: 'ios',
      build: 360,
      versionString: '2.1.360',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 500 when the webhook secret is not configured', async () => {
    mockSecret.mockReturnValue(undefined);

    const response = await POST(webhookRequest(BODY, validSignature(BODY)));

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

  it('skips reconcile when the update gate is disabled', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', 'false');

    const response = await POST(webhookRequest(BODY, validSignature(BODY)));
    const json = await response.json();

    expect(json).toEqual({ skipped: 'updates_disabled' });
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('reconciles and reports the synced build for a valid signed delivery', async () => {
    const response = await POST(webhookRequest(BODY, validSignature(BODY)));
    const json = await response.json();

    expect(mockReconcile).toHaveBeenCalledWith('app_store_connect_webhook');
    expect(json).toEqual({
      synced: true,
      platform: 'ios',
      build: 360,
      versionString: '2.1.360',
    });
  });

  it('passes through a no-op reconcile result', async () => {
    mockReconcile.mockResolvedValue({
      synced: false,
      skipped: 'no_live_version',
    });

    const response = await POST(webhookRequest(BODY, validSignature(BODY)));
    const json = await response.json();

    expect(json).toEqual({ skipped: 'no_live_version' });
  });

  it('returns 502 when reconcile throws', async () => {
    mockReconcile.mockRejectedValue(new Error('asc down'));

    const response = await POST(webhookRequest(BODY, validSignature(BODY)));

    expect(response.status).toBe(502);
  });
});
