import {
  GET as getCheckoutSession,
  handleAgenticCheckoutSessionUpdate,
} from '@/app/api/agentic/checkout_sessions/[id]/route';
import { adaptUcpCheckoutUpdateRequestBody } from '@/lib/agentic/ucp-request-adapters';
import { adaptCheckoutResponseToUcp } from '@/lib/agentic/ucp-response-adapters';

type RouteProps = Parameters<typeof getCheckoutSession>[1];

export async function GET(
  request: Parameters<typeof getCheckoutSession>[0],
  props: RouteProps
) {
  return adaptCheckoutResponseToUcp(await getCheckoutSession(request, props));
}

export async function POST(
  request: Parameters<typeof handleAgenticCheckoutSessionUpdate>[0],
  props: Parameters<typeof handleAgenticCheckoutSessionUpdate>[1]
) {
  return adaptCheckoutResponseToUcp(
    await handleAgenticCheckoutSessionUpdate(request, props, {
      requestBodyAdapter: adaptUcpCheckoutUpdateRequestBody,
    })
  );
}

export async function PUT(
  request: Parameters<typeof handleAgenticCheckoutSessionUpdate>[0],
  props: Parameters<typeof handleAgenticCheckoutSessionUpdate>[1]
) {
  return adaptCheckoutResponseToUcp(
    await handleAgenticCheckoutSessionUpdate(request, props, {
      requestBodyAdapter: adaptUcpCheckoutUpdateRequestBody,
    })
  );
}
