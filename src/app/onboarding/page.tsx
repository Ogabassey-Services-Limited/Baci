import { Logo } from '@/components/logo';
import Link from 'next/link';
import OnboardingForm from './onboarding-form';
import { Card, CardContent } from '@/components/ui/card';

// Mark as dynamic to prevent SSG with Firebase
export const dynamic = 'force-dynamic';

export default function OnboardingPage() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <div className="flex justify-center mb-8">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <Card className="shadow-2xl">
          <CardContent className="p-8">
            <OnboardingForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
