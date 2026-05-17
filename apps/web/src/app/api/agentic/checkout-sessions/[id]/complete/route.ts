import { POST as completeCheckoutSession } from '@/app/api/agentic/checkout_sessions/[id]/complete/route';
import { adaptCheckoutResponseToUcp } from '@/lib/agentic/ucp-response-adapters';

export async function POST(
  request: Parameters<typeof completeCheckoutSession>[0],
  props: Parameters<typeof completeCheckoutSession>[1]
) {
  return adaptCheckoutResponseToUcp(
    await completeCheckoutSession(request, props)
  );
}
