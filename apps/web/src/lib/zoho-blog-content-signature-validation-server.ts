import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

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
  const expected = createHmac('sha256', contentSecret)
    .update(postId)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}
