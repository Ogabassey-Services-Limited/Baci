import { adaptCheckoutResponseToUcp } from '@/lib/agentic/ucp-response-adapters';
import { POST as postCheckoutSession } from '../checkout_sessions/route';

export async function POST(request: Parameters<typeof postCheckoutSession>[0]) {
  return adaptCheckoutResponseToUcp(await postCheckoutSession(request));
}
