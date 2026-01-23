import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import crypto from 'node:crypto';

// Mock Supabase to avoid real network calls
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    })),
  })),
}));

describe('MyCover Webhook', () => {
  const secret = 'test_secret';

  beforeEach(() => {
    vi.resetAllMocks();
    // Set environment variable for webhook secret
    process.env.MYCOVER_SECRET_KEY = secret;
  });

  it('should verify valid HMAC-SHA512 signature', async () => {
    const payload = JSON.stringify({ event: 'test', data: { policy_id: '123' } });
    const signature = crypto.createHmac('sha512', secret).update(payload).digest('hex');

    const req = new NextRequest('http://localhost/api/webhooks/mycover', {
      method: 'POST',
      body: payload,
      headers: {
        'x-mycover-signature': signature,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

   it('should verify valid HMAC-SHA256 signature', async () => {
    const payload = JSON.stringify({ event: 'test', data: { policy_id: '123' } });
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const req = new NextRequest('http://localhost/api/webhooks/mycover', {
      method: 'POST',
      body: payload,
      headers: {
        'x-mycover-signature': signature,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('should reject request with invalid signature (hard fail - 2026 best practice)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const payload = JSON.stringify({ event: 'test', data: { policy_id: '123' } });

    const req = new NextRequest('http://localhost/api/webhooks/mycover', {
      method: 'POST',
      body: payload,
      headers: {
        'x-mycover-signature': 'invalid_signature',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401); // Hardened to fail fast (2026 security best practice)

    // Verify error was logged (first argument contains the message)
    expect(consoleSpy).toHaveBeenCalled();
    const firstCallArgs = consoleSpy.mock.calls[0];
    expect(firstCallArgs[0]).toContain('Signature verification FAILED');

    const body = await res.json();
    expect(body.error).toBe('Invalid signature');
  });

  it('should verify using x-signature header as fallback', async () => {
    const payload = JSON.stringify({ event: 'test', data: { policy_id: '123' } });
    const signature = crypto.createHmac('sha512', secret).update(payload).digest('hex');

    const req = new NextRequest('http://localhost/api/webhooks/mycover', {
      method: 'POST',
      body: payload,
      headers: {
        'x-signature': signature,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
