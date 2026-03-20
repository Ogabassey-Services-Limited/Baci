import { createLlmsResponse } from '@/lib/llms';

export function GET(request: Request) {
  return createLlmsResponse(request, true);
}
