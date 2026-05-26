import { type NextRequest, NextResponse } from 'next/server';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import { readAgenticMutationRequest } from '@/lib/agentic/mutation-request';
import { convertUcpCartToCheckout } from '@/lib/agentic/ucp-cart-checkout-conversion';
import { resolveUcpCartContext } from '@/lib/agentic/ucp-cart-route-support';
import { ucpCartRouteParamsSchema } from '@/schemas/ucp-cart-route-params';

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, props: RouteProps) {
  if (!verifyAgenticApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsedParams = ucpCartRouteParamsSchema.safeParse(await props.params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: 'Invalid route params', details: parsedParams.error.flatten() },
      { status: 400 }
    );
  }

  const mutation = await readAgenticMutationRequest({ request });
  if (!mutation.ok) return mutation.response;

  const context = await resolveUcpCartContext(request);
  if (!context.ok) return context.response;

  return convertUcpCartToCheckout({
    cartId: parsedParams.data.id,
    merchant: context.merchant,
    mutation,
    requestUrl: request.url,
    supabase: context.supabase,
  });
}
