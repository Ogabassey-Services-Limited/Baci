import { DeferredPlatformInsights } from '@/components/analytics/deferred-platform-insights';
import { WebVitalsReporter } from '@/components/analytics/web-vitals-reporter';

// Keep this component independent from page children. RootLayout renders the
// page shell as a sibling so dynamic root enhancements cannot gate LCP content.
export function RootDynamicBody() {
  return (
    <>
      <WebVitalsReporter />
      <DeferredPlatformInsights />
    </>
  );
}
