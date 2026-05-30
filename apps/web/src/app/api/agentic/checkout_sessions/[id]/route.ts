import type { NextRequest } from 'next/server';
import { handleAgenticCheckoutSessionUpdate } from './checkout-session-update-handler';
import { handleAgenticCheckoutSessionGet } from './route-get-handler';

type SessionRouteProps = { params: Promise<{ id: string }> };

export function GET(request: NextRequest, props: SessionRouteProps) {
  return handleAgenticCheckoutSessionGet(request, props);
}

export function POST(request: NextRequest, props: SessionRouteProps) {
  return handleAgenticCheckoutSessionUpdate(request, props);
}

export function PUT(request: NextRequest, props: SessionRouteProps) {
  return handleAgenticCheckoutSessionUpdate(request, props);
}
