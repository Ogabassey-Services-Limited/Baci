import {
  buildPlatformOnboardingMarkdown,
  markdownResponse,
} from '@/lib/llms-markdown';

export function GET(request: Request) {
  const url = new URL(request.url);
  return markdownResponse(
    buildPlatformOnboardingMarkdown(`${url.protocol}//${url.host}`)
  );
}
