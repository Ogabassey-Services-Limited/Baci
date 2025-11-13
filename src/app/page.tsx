
'use client';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import Link from 'next/link';

function BaciLandingPage() {
   const features = [
    {
      icon: '🤖',
      title: 'Intelligent Onboarding',
      description: 'Define your business and brand preferences with a simple 3-question setup, featuring AI-powered color extraction and logo creation.',
    },
    {
      icon: '🎨',
      title: 'AI Content Generation',
      description: 'Effortlessly generate compelling product descriptions with AI, tailored to your specific business category.',
    },
    {
      icon: '📸',
      title: 'Photo Enhancement',
      description: 'Automatically enhance product photos with background removal, lighting adjustments, and optimal cropping.',
    },
    {
      icon: '⚡️',
      title: 'One-Click Store Creation',
      description: 'Generate a fully functional, mobile-responsive e-commerce website in seconds from your inputs.',
    },
  ];
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="px-4 lg:px-6 h-16 flex items-center shadow-sm">
        <Link href="/" className="flex items-center justify-center">
            <Logo />
            <span className="sr-only">Baci</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Button asChild variant="outline">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild>
            <Link href="/onboarding">Get Started</Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-card">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline">
                    Build Your E-commerce Empire with AI 🚀
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    Baci is an AI-powered platform that helps you launch a professional online store in minutes. No coding, no design skills needed.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button asChild size="lg">
                    <Link href="/onboarding">Create Your Store for Free</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default function HomePage() {
    return <BaciLandingPage />;
}
