import { adaptUcpCheckoutCreateRequestBody } from '@/lib/agentic/ucp-request-adapters';
import { adaptCheckoutResponseToUcp } from '@/lib/agentic/ucp-response-adapters';
import {
  handleAgenticCheckoutSessionCreate,
  type POST as postCheckoutSession,
} from '../checkout_sessions/route';

export async function POST(request: Parameters<typeof postCheckoutSession>[0]) {
  return adaptCheckoutResponseToUcp(
    await handleAgenticCheckoutSessionCreate(request, {
      requestBodyAdapter: adaptUcpCheckoutCreateRequestBody,
    })
  );
}
