import 'server-only';
import { createHmac } from 'node:crypto';

export function buildZohoBlogContentSignature({
  contentSecret,
  postId,
}: {
  contentSecret: string;
  postId: string;
}): string {
  return createHmac('sha256', contentSecret).update(postId).digest('hex');
}
