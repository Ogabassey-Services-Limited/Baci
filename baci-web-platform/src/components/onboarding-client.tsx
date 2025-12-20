'use client';

import dynamic from 'next/dynamic';
import { Logo } from '@/components/logo';

const OnboardingForm = dynamic(
  () => import('@/components/onboarding-form').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center h-[400px]">
        <div className="animate-pulse">
          <Logo width={80} height={25} priority />
        </div>
      </div>
    ),
  }
);

export default function OnboardingClient() {
  return <OnboardingForm />;
}
