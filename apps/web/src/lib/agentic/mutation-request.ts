import { type NextRequest, NextResponse } from 'next/server';
import {
  getAgenticSigningSecrets,
  verifyAgenticRequestIntegrity,
} from '@/lib/agentic/request-integrity';

export type AgenticMutationRequest =
  | {
      apiVersion: string;
      body: unknown;
      idempotencyKey: string;
      method: string;
      ok: true;
      pathname: string;
      rawBody: string;
      requestId: string;
    }
  | { ok: false; response: NextResponse };

export async function readAgenticMutationRequest({
  requireIdempotency = true,
  request,
}: {
  requireIdempotency?: boolean;
  request: NextRequest;
}): Promise<AgenticMutationRequest> {
  const rawBody = await request.text();
  const integrity = verifyAgenticRequestIntegrity({
    body: rawBody,
    headers: request.headers,
    method: request.method,
    pathname: request.nextUrl.pathname,
    secrets: getAgenticSigningSecrets(),
  });

  if (!integrity.ok) {
    return {
      ok: false,
      response: buildIntegrityErrorResponse(integrity.error),
    };
  }

  const idempotencyKey = request.headers.get('idempotency-key')?.trim() ?? '';
  if (requireIdempotency && !idempotencyKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Missing idempotency key' },
        { status: 400 }
      ),
    };
  }

  try {
    return {
      apiVersion: integrity.apiVersion,
      body: rawBody.length > 0 ? JSON.parse(rawBody) : {},
      idempotencyKey,
      method: request.method,
      ok: true,
      pathname: request.nextUrl.pathname,
      rawBody,
      requestId: integrity.requestId,
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      ),
    };
  }
}

function buildIntegrityErrorResponse(error: string) {
  if (error === 'Missing signing secret') {
    return NextResponse.json(
      { error: 'Agentic request signing is not configured' },
      { status: 503 }
    );
  }

  const status = error.startsWith('Missing') ? 400 : 401;
  return NextResponse.json({ error }, { status });
}
