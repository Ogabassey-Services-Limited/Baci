import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export function buildZohoBlogContentSignature({
  contentSecret,
  postId,
}: {
  contentSecret: string;
  postId: string;
}): string {
  return createHmac('sha256', contentSecret).update(postId).digest('hex');
}

export function isValidZohoBlogContentSignature({
  contentSecret,
  postId,
  signature,
}: {
  contentSecret: string;
  postId: string;
  signature: string | null;
}): boolean {
  if (!signature) return false;
  const expected = buildZohoBlogContentSignature({ contentSecret, postId });
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}
