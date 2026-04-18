import { Suspense } from 'react';
import { OnboardingPageContentServer } from './onboarding-page-content-server';

function OnboardingPageFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
      role="status"
    >
      Loading onboarding...
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingPageFallback />}>
      <OnboardingPageContentServer />
    </Suspense>
  );
}
