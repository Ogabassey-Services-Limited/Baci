
import { Logo } from '@/components/logo';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import OnboardingClient from '@/components/onboarding-client';


import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get Started - Create Your Store | Baci',
  description: 'Start your e-commerce journey with Baci. Sign up for free and let AI build your perfect online store in seconds.',
};

export default function OnboardingPage() {
  return (
    <div
      className="relative flex flex-col min-h-screen items-center justify-center bg-background p-4"
      style={{
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div className="absolute top-6 left-6">
        <Link href="/">
          <Logo />
        </Link>
      </div>
      <div className="w-full max-w-2xl pt-16">
        <Card className="glass shadow-2xl">
          <CardContent className="p-8">
            <OnboardingClient />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
