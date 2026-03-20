import {
  buildPlatformHomeMarkdown,
  markdownResponse,
} from '@/lib/llms-markdown';

export function GET(request: Request) {
  const url = new URL(request.url);
  return markdownResponse(
    buildPlatformHomeMarkdown(`${url.protocol}//${url.host}`)
  );
}
