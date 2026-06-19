import {
  capturePostHogPageview,
  initializePostHogBrowser,
} from '@/lib/posthog/browser';
import { getPostHogBrowserEnv } from '@/lib/posthog/config';

const postHogBrowserEnv = getPostHogBrowserEnv();

if (typeof window !== 'undefined') {
  initializePostHogBrowser(postHogBrowserEnv);
  capturePostHogPageview();
}
