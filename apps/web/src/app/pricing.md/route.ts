import {
  buildPlatformPricingMarkdown,
  markdownResponse,
} from '@/lib/llms-markdown';

export function GET(request: Request) {
  const url = new URL(request.url);
  return markdownResponse(
    buildPlatformPricingMarkdown(`${url.protocol}//${url.host}`)
  );
}
