import type { NextRequest } from 'next/server';
import { handleAgenticCheckoutSessionCreate } from './checkout-session-create-handler';

export function POST(request: NextRequest) {
  return handleAgenticCheckoutSessionCreate(request);
}
