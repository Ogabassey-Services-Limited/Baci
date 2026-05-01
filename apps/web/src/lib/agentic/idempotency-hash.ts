import { createHash } from 'node:crypto';

type IdempotencyRequestFingerprint = Record<
  'apiVersion' | 'body' | 'method' | 'pathname',
  string
>;

export function hashIdempotencyRequest({
  apiVersion,
  body,
  method,
  pathname,
}: IdempotencyRequestFingerprint): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        api_version: apiVersion,
        body,
        method: method.toUpperCase(),
        pathname,
      })
    )
    .digest('hex');
}
