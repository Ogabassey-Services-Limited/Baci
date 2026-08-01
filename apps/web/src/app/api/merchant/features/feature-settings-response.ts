import { NextResponse } from 'next/server';

const PRIVATE_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
};

export function jsonNoStore<T>(body: T, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', PRIVATE_NO_STORE_HEADERS['Cache-Control']);
  return NextResponse.json(body, { ...init, headers });
}

export function withNoStore(response: NextResponse) {
  response.headers.set(
    'Cache-Control',
    PRIVATE_NO_STORE_HEADERS['Cache-Control']
  );
  return response;
}
