import type { NextRequest } from 'next/server';
import { handleAgenticCheckoutSessionCreate } from '@/app/api/agentic/checkout_sessions/checkout-session-create-handler';
import { adaptUcpCheckoutCreateRequestBody } from '@/lib/agentic/ucp-request-adapters';
import { adaptCheckoutResponseToUcp } from '@/lib/agentic/ucp-response-adapters';

export async function POST(request: NextRequest) {
  return adaptCheckoutResponseToUcp(
    await handleAgenticCheckoutSessionCreate(request, {
      requestBodyAdapter: adaptUcpCheckoutCreateRequestBody,
    })
  );
}
