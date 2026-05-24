import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ACP_STABLE_AGENTIC_API_VERSION,
  AGENTIC_API_VERSION,
  verifyAgenticRequestIntegrity,
} from '@/lib/agentic/request-integrity';

const secret = Array.from({ length: 32 }, (_, index) =>
  index.toString(16).padStart(2, '0')
).join('');
const now = new Date('2026-04-30T12:00:00.000Z');

function sign({
  agentId = '',
  apiVersion = AGENTIC_API_VERSION,
  body,
  idempotencyKey = '',
  method = 'POST',
  pathname = '',
  requestId = 'req_123',
  timestamp,
}: {
  agentId?: string;
  apiVersion?: string;
  body: string;
  idempotencyKey?: string;
  method?: string;
  pathname?: string;
  requestId?: string;
  timestamp: string;
}) {
  const payload: Record<string, string> = {
    api_version: apiVersion,
    body,
    idempotency_key: idempotencyKey,
    method: method.toUpperCase(),
    pathname,
    request_id: requestId,
    timestamp,
  };
  if (agentId) {
    payload.agent_id = agentId;
  }

  return createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

function signedHeaders({
  agentId = '',
  body,
  requestId = 'req_123',
  timestamp = '2026-04-30T12:00:00.000Z',
  apiVersion = AGENTIC_API_VERSION,
  idempotencyKey = '',
  method = 'POST',
  pathname = '',
  signature = sign({
    agentId,
    apiVersion,
    body,
    idempotencyKey,
    method,
    pathname,
    requestId,
    timestamp,
  }),
}: {
  agentId?: string;
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
  if (agentId) {
    headers.set('agent-id', agentId);
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
      agentId: null,
      apiVersion: AGENTIC_API_VERSION,
      ok: true,
      requestId: 'req_123',
    });
  });

  it('accepts and returns an optional signed agent id', () => {
    const body = '{"items":[]}';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ agentId: 'openai:chatgpt', body }),
        now,
        secrets: [secret],
      })
    ).toEqual({
      agentId: 'openai:chatgpt',
      apiVersion: AGENTIC_API_VERSION,
      ok: true,
      requestId: 'req_123',
    });
  });

  it('rejects signatures replayed after removing the signed agent id', () => {
    const body = '{"items":[]}';
    const headers = signedHeaders({ agentId: 'openai:chatgpt', body });
    headers.delete('agent-id');

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers,
        now,
        secrets: [secret],
      })
    ).toEqual({ error: 'Invalid signature', ok: false });
  });

  it('rejects malformed signed agent ids', () => {
    const body = '{"items":[]}';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ agentId: 'bad agent', body }),
        now,
        secrets: [secret],
      })
    ).toEqual({ error: 'Invalid agent id format', ok: false });
  });

  it('accepts signed agent ids at the maximum length', () => {
    const agentId = 'a'.repeat(128);
    const body = '{"items":[]}';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ agentId, body }),
        now,
        secrets: [secret],
      })
    ).toEqual({
      agentId,
      apiVersion: AGENTIC_API_VERSION,
      ok: true,
      requestId: 'req_123',
    });
  });

  it('rejects signed agent ids above the maximum length', () => {
    const body = '{"items":[]}';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ agentId: 'a'.repeat(129), body }),
        now,
        secrets: [secret],
      })
    ).toEqual({ error: 'Agent id too long', ok: false });
  });

  it('accepts the upstream stable ACP api version', () => {
    const body = '{"items":[]}';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({
          apiVersion: ACP_STABLE_AGENTIC_API_VERSION,
          body,
        }),
        now,
        secrets: [secret],
      })
    ).toEqual({
      agentId: null,
      apiVersion: ACP_STABLE_AGENTIC_API_VERSION,
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
