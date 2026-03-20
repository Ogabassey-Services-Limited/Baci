import {
  buildPlatformFeaturesMarkdown,
  markdownResponse,
} from '@/lib/llms-markdown';

export function GET(request: Request) {
  const url = new URL(request.url);
  return markdownResponse(
    buildPlatformFeaturesMarkdown(`${url.protocol}//${url.host}`)
  );
}
