import { NextRequest } from 'next/server';

export const EVENT_ROUTE_MERCHANT_ID = '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235';

export function eventRouteRequest(
  overrides: Record<string, unknown> = {},
  headers: Record<string, string> = {}
) {
  return new NextRequest('https://shop.usebaci.com/api/events', {
    body: JSON.stringify({
      event_type: 'page_view',
      merchant_id: EVENT_ROUTE_MERCHANT_ID,
      ...overrides,
    }),
    headers: { host: 'shop.usebaci.com', ...headers },
    method: 'POST',
  });
}
