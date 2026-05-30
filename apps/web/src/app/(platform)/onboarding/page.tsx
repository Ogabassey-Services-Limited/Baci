import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OnboardingPageContentServer } from './onboarding-page-content-server';

export const metadata: Metadata = {
  title: 'Set Up Your Store | Baci',
  robots: { index: false, follow: false },
};

function OnboardingPageFallback() {
  return (
    <output className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Loading onboarding…
    </output>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingPageFallback />}>
      <OnboardingPageContentServer />
    </Suspense>
  );
}
