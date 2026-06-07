import { NextResponse } from 'next/server';
import { buildRequestBaseUrl } from '@/lib/storefront-host';
import { agentAuthActionRequestSchema } from '@/schemas/agent-auth-action-request';

const RESPONSE_HEADERS = { 'Cache-Control': 'no-store' };

type AgentAuthAction = 'claim' | 'revoke';
type AgentAuthActionRouteProps = {
  params: Promise<{ action: string }>;
};

function getSupportedAction(value: string): AgentAuthAction | null {
  if (value === 'claim' || value === 'revoke') return value;

  return null;
}

function buildActionResponse(baseUrl: string, action: AgentAuthAction) {
  return {
    status:
      action === 'claim' ? 'manual_claim_required' : 'revocation_received',
    action,
    registration_policy: 'manual_approval',
    documentation: `${baseUrl}/auth.md`,
    message:
      action === 'claim'
        ? 'Approved integrations complete account claims through manual review; this endpoint does not upgrade credentials automatically.'
        : 'Revocation notices are accepted for approved integrations and reviewed out of band.',
  };
}

function getRecordBody(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  props: AgentAuthActionRouteProps
): Promise<NextResponse> {
  const action = getSupportedAction((await props.params).action);

  if (action === null) {
    return NextResponse.json(
      { error: 'Not Found' },
      { headers: RESPONSE_HEADERS, status: 404 }
    );
  }

  return NextResponse.json(
    buildActionResponse(buildRequestBaseUrl(request), action),
    {
      headers: RESPONSE_HEADERS,
    }
  );
}

export async function POST(
  request: Request,
  props: AgentAuthActionRouteProps
): Promise<NextResponse> {
  // Public Auth.md action discovery only: this validates request shape and
  // returns manual-review instructions, but does not mutate state or issue
  // credentials, so there is no session-bound CSRF action to protect.
  const action = getSupportedAction((await props.params).action);

  if (action === null) {
    return NextResponse.json(
      { error: 'Not Found' },
      { headers: RESPONSE_HEADERS, status: 404 }
    );
  }

  // parsedRequest merges getRecordBody(await readJson(request)) with the URL
  // action so agentAuthActionRequestSchema uses the trusted route action as
  // the union discriminator, even if a client sends an action in the body.
  const parsedRequest = agentAuthActionRequestSchema.safeParse({
    ...getRecordBody(await readJson(request)),
    action,
  });

  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'INVALID_INPUT' },
      { headers: RESPONSE_HEADERS, status: 400 }
    );
  }

  return NextResponse.json(
    buildActionResponse(buildRequestBaseUrl(request), action),
    {
      headers: RESPONSE_HEADERS,
    }
  );
}
