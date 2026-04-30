import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AGENTIC_API_VERSION,
  verifyAgenticRequestIntegrity,
} from '@/lib/agentic/request-integrity';

const secret = randomBytes(32).toString('hex');
const now = new Date('2026-04-30T12:00:00.000Z');

function sign({
  apiVersion = AGENTIC_API_VERSION,
  body,
  idempotencyKey = '',
  method = 'POST',
  pathname = '',
  requestId = 'req_123',
  timestamp,
}: {
  apiVersion?: string;
  body: string;
  idempotencyKey?: string;
  method?: string;
  pathname?: string;
  requestId?: string;
  timestamp: string;
}) {
  return createHmac('sha256', secret)
    .update(
      JSON.stringify({
        api_version: apiVersion,
        body,
        idempotency_key: idempotencyKey,
        method: method.toUpperCase(),
        pathname,
        request_id: requestId,
        timestamp,
      })
    )
    .digest('hex');
}

function signedHeaders({
  body,
  requestId = 'req_123',
  timestamp = '2026-04-30T12:00:00.000Z',
  apiVersion = AGENTIC_API_VERSION,
  idempotencyKey = '',
  method = 'POST',
  pathname = '',
  signature = sign({
    apiVersion,
    body,
    idempotencyKey,
    method,
    pathname,
    requestId,
    timestamp,
  }),
}: {
  apiVersion?: string;
  body: string;
  idempotencyKey?: string;
  method?: string;
  pathname?: string;
  requestId?: string;
  signature?: string;
  timestamp?: string;
}) {
  const headers = new Headers({
    'api-version': apiVersion,
    'request-id': requestId,
    signature,
    timestamp,
  });
  if (idempotencyKey) {
    headers.set('idempotency-key', idempotencyKey);
  }

  return headers;
}

describe('verifyAgenticRequestIntegrity', () => {
  it('accepts a valid signature, timestamp, request id, and api version', () => {
    const body = '{"items":[]}';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ body }),
        now,
        secrets: [secret],
      })
    ).toEqual({
      apiVersion: AGENTIC_API_VERSION,
      ok: true,
      requestId: 'req_123',
    });
  });

  it('rejects stale timestamps', () => {
    const body = '{"items":[]}';
    const timestamp = '2026-04-30T11:55:00.000Z';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ body, timestamp }),
        now,
        secrets: [secret],
      })
    ).toEqual({ error: 'Stale timestamp', ok: false });
  });

  it('rejects missing request ids', () => {
    const body = '{"items":[]}';
    const headers = signedHeaders({ body });
    headers.delete('request-id');

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers,
        now,
        secrets: [secret],
      })
    ).toEqual({ error: 'Missing request id', ok: false });
  });

  it('rejects unsupported api versions', () => {
    const body = '{"items":[]}';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ apiVersion: '2025-01-01', body }),
        now,
        secrets: [secret],
      })
    ).toEqual({ error: 'Unsupported api version', ok: false });
  });

  it('rejects bad signatures', () => {
    const body = '{"items":[]}';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ body, signature: 'bad' }),
        now,
        secrets: [secret],
      })
    ).toEqual({ error: 'Invalid signature', ok: false });
  });

  it('rejects signatures replayed with a different request id', () => {
    const body = '{"items":[]}';
    const headers = signedHeaders({ body });
    headers.set('request-id', 'req_changed');

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers,
        now,
        secrets: [secret],
      })
    ).toEqual({ error: 'Invalid signature', ok: false });
  });

  it('fails closed when signing secrets are missing', () => {
    const body = '{"items":[]}';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ body }),
        now,
        secrets: [],
      })
    ).toEqual({ error: 'Missing signing secret', ok: false });
  });
});
