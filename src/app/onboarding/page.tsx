import { Logo } from '@/components/logo';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const OnboardingForm = dynamic(() => import('@/components/onboarding-form'), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  ),
});


export default function OnboardingPage() {
  return (
    <div className="relative flex flex-col min-h-screen items-center justify-center bg-background p-4">
       <div className="absolute top-6 left-6">
        <Link href="/">
          <Logo />
        </Link>
      </div>
      <div className="w-full max-w-2xl pt-16">
        <Card className="shadow-2xl">
          <CardContent className="p-8">
            <OnboardingForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
