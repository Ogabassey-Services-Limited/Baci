'use client';

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const OnboardingForm = dynamic(
  () => import('@/components/onboarding-form').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center h-[400px]">
        <Loader2 className="h-8 w-8 motion-safe:animate-spin" />
      </div>
    ),
  }
);

export default function OnboardingClient() {
  return <OnboardingForm />;
}
