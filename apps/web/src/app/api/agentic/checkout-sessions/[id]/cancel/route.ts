import { POST as cancelCheckoutSession } from '@/app/api/agentic/checkout_sessions/[id]/cancel/route';
import { adaptCheckoutResponseToUcp } from '@/lib/agentic/ucp-response-adapters';

export async function POST(
  request: Parameters<typeof cancelCheckoutSession>[0],
  props: Parameters<typeof cancelCheckoutSession>[1]
) {
  return adaptCheckoutResponseToUcp(
    await cancelCheckoutSession(request, props)
  );
}
