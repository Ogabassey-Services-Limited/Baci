import type { NextRequest } from 'next/server';
import { handleAgenticCheckoutSessionComplete } from './checkout-session-complete-handler';

type SessionRouteProps = { params: Promise<{ id: string }> };

export function POST(request: NextRequest, props: SessionRouteProps) {
  return handleAgenticCheckoutSessionComplete(request, props);
}
