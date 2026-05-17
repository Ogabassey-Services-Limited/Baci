import { adaptCheckoutResponseToUcp } from '@/lib/agentic/ucp-response-adapters';
import { POST as cancelCheckoutSession } from '../../../checkout_sessions/[id]/cancel/route';

export async function POST(
  request: Parameters<typeof cancelCheckoutSession>[0],
  props: Parameters<typeof cancelCheckoutSession>[1]
) {
  return adaptCheckoutResponseToUcp(
    await cancelCheckoutSession(request, props)
  );
}
