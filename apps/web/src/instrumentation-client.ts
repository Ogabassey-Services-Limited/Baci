import { getPostHogBrowserEnv } from '@/lib/posthog/config';
import { isPublicBlogPathname } from '@/lib/posthog/public-blog-path';

const postHogBrowserEnv = getPostHogBrowserEnv();

async function initializePostHogInstrumentation() {
  const { capturePostHogPageview, initializePostHogBrowser } = await import(
    '@/lib/posthog/browser'
  );

  initializePostHogBrowser(postHogBrowserEnv);
  capturePostHogPageview();
}

if (
  typeof window !== 'undefined' &&
  !isPublicBlogPathname(globalThis.location?.pathname)
) {
  void initializePostHogInstrumentation();
}
