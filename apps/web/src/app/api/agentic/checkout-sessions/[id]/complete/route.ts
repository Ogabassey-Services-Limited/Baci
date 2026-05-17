import { adaptCheckoutResponseToUcp } from '@/lib/agentic/ucp-response-adapters';
import { POST as completeCheckoutSession } from '../../../checkout_sessions/[id]/complete/route';

export async function POST(
  request: Parameters<typeof completeCheckoutSession>[0],
  props: Parameters<typeof completeCheckoutSession>[1]
) {
  return adaptCheckoutResponseToUcp(
    await completeCheckoutSession(request, props)
  );
}
