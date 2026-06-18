'use client';

import { initializePostHogBrowser } from '@/lib/posthog/browser';
import type { PostHogEnv } from '@/lib/posthog/config';

const postHogBrowserEnv = {
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN:
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
  NEXT_PUBLIC_POSTHOG_PROXY_PATH: process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH,
  NEXT_PUBLIC_POSTHOG_UI_HOST: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST,
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  NODE_ENV: process.env.NODE_ENV,
} satisfies PostHogEnv;

if (typeof window !== 'undefined') {
  initializePostHogBrowser(postHogBrowserEnv);
}

export function PostHogClientBootstrap() {
  return null;
}
