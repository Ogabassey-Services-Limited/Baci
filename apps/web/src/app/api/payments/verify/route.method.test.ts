import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { GET, POST } from './route';

describe('/api/payments/verify method boundary', () => {
  it('rejects GET so verification cannot be triggered by prefetch or forged navigation', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(body.error).toContain('Use POST');
  });

  it('requires a JSON POST body before validating a reference', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/payments/verify', {
        body: 'reference=txn-ref-123',
        headers: { 'Content-Type': 'text/plain' },
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(415);
    expect(body.error).toBe('Expected application/json request body');
  });

  it('rejects malformed JSON before any reconciliation work can run', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/payments/verify', {
        body: '{not-json',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid JSON body');
  });

  it('validates the JSON reference field before loading payment state', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/payments/verify', {
        body: JSON.stringify({ reference: '' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid reference');
  });
});
