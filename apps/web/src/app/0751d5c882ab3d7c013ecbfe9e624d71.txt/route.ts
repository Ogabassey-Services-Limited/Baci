import { DEFAULT_INDEXNOW_KEY } from '@/lib/indexnow';

export function GET() {
  return new Response(DEFAULT_INDEXNOW_KEY, {
    headers: {
      'Cache-Control': 'public, max-age=86400, immutable',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export const HEAD = GET;
