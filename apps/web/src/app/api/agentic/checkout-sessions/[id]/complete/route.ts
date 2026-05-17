import { handleAgenticCheckoutSessionComplete } from '@/app/api/agentic/checkout_sessions/[id]/complete/route';
import { adaptUcpCheckoutCompleteRequestBody } from '@/lib/agentic/ucp-request-adapters';
import { adaptCheckoutResponseToUcp } from '@/lib/agentic/ucp-response-adapters';

export async function POST(
  request: Parameters<typeof handleAgenticCheckoutSessionComplete>[0],
  props: Parameters<typeof handleAgenticCheckoutSessionComplete>[1]
) {
  return adaptCheckoutResponseToUcp(
    await handleAgenticCheckoutSessionComplete(request, props, {
      requestBodyAdapter: adaptUcpCheckoutCompleteRequestBody,
    })
  );
}
