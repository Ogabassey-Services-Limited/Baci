import { adaptCheckoutResponseToUcp } from '@/lib/agentic/ucp-response-adapters';
import {
  GET as getCheckoutSession,
  POST as postCheckoutSession,
  PUT as putCheckoutSession,
} from '../../checkout_sessions/[id]/route';

type RouteProps = Parameters<typeof getCheckoutSession>[1];

export async function GET(
  request: Parameters<typeof getCheckoutSession>[0],
  props: RouteProps
) {
  return adaptCheckoutResponseToUcp(await getCheckoutSession(request, props));
}

export async function POST(
  request: Parameters<typeof postCheckoutSession>[0],
  props: Parameters<typeof postCheckoutSession>[1]
) {
  return adaptCheckoutResponseToUcp(await postCheckoutSession(request, props));
}

export async function PUT(
  request: Parameters<typeof putCheckoutSession>[0],
  props: Parameters<typeof putCheckoutSession>[1]
) {
  return adaptCheckoutResponseToUcp(await putCheckoutSession(request, props));
}
