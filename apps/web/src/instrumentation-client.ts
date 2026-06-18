import posthog from 'posthog-js';
import { buildPostHogClientConfig } from '@/lib/posthog/client-config';

const postHogProjectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (postHogProjectToken) {
  posthog.init(postHogProjectToken, buildPostHogClientConfig());
} else if (process.env.NODE_ENV === 'development') {
  console.warn(
    '[PostHog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is missing; web analytics and error capture are disabled.'
  );
}
