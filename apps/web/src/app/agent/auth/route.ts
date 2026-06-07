import { NextResponse } from 'next/server';
import { buildRequestBaseUrl } from '@/lib/storefront-host';
import { agentAuthRegistrationRequestSchema } from '@/schemas/agent-auth-registration-request';

const RESPONSE_HEADERS = { 'Cache-Control': 'no-store' };

function buildRegistrationResponse(baseUrl: string) {
  return {
    status: 'manual_approval_required',
    registration_policy: 'manual_approval',
    registration_type: 'agent-provider',
    credential_type: 'api_key',
    credential_format: 'bearer_hmac',
    documentation: `${baseUrl}/auth.md`,
    claim_uri: `${baseUrl}/.well-known/agent-auth/claim`,
    revocation_uri: `${baseUrl}/.well-known/agent-auth/revoke`,
    message:
      'Approved integrations are provisioned after review; this endpoint does not issue credentials automatically.',
  };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function GET(request: Request): NextResponse {
  return NextResponse.json(
    buildRegistrationResponse(buildRequestBaseUrl(request)),
    {
      headers: RESPONSE_HEADERS,
    }
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  // Public Auth.md registration discovery only: this validates request shape
  // and returns manual-review instructions, but does not mutate state or issue
  // credentials, so there is no session-bound CSRF action to protect.
  const parsedRequest = agentAuthRegistrationRequestSchema.safeParse(
    await readJson(request)
  );

  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'INVALID_INPUT' },
      { headers: RESPONSE_HEADERS, status: 400 }
    );
  }

  return NextResponse.json(
    buildRegistrationResponse(buildRequestBaseUrl(request)),
    {
      headers: RESPONSE_HEADERS,
    }
  );
}
