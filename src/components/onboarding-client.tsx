
'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const OnboardingForm = dynamic(() => import('@/components/onboarding-form'), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center h-[400px]">
      <Loader2 className="h-8 w-8 motion-safe:animate-spin" />
    </div>
  ),
});

export default function OnboardingClient() {
  return <OnboardingForm />;
}
