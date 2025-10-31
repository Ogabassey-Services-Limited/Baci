import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import Image from 'next/image';
import { Bot, Palette, Camera, Zap } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function Home() {
  const features = [
    {
      icon: <Bot className="w-8 h-8 text-primary" />,
      title: 'Intelligent Onboarding',
      description: 'Define your business and brand preferences with a simple 3-question setup, featuring AI-powered color extraction and logo creation.',
    },
    {
      icon: <Palette className="w-8 h-8 text-primary" />,
      title: 'AI Content Generation',
      description: 'Effortlessly generate compelling product descriptions with AI, tailored to your specific business category.',
    },
    {
      icon: <Camera className="w-8 h-8 text-primary" />,
      title: 'Photo Enhancement',
      description: 'Automatically enhance product photos with background removal, lighting adjustments, and optimal cropping.',
    },
    {
      icon: <Zap className="w-8 h-8 text-primary" />,
      title: 'One-Click Store Creation',
      description: 'Generate a fully functional, mobile-responsive e-commerce website in seconds from your inputs.',
    },
  ];

  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-image');

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="px-4 lg:px-6 h-16 flex items-center shadow-sm">
        <Logo />
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link href="/onboarding">
            <Button variant="outline">Sign In</Button>
          </Link>
          <Link href="/onboarding">
            <Button>Get Started</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-card">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline">
                    Build Your E-commerce Empire with AI
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    Baci is an AI-powered platform that helps you launch a professional online store in minutes. No coding, no design skills needed.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Link href="/onboarding">
                    <Button size="lg">Create Your Store for Free</Button>
                  </Link>
                </div>
              </div>
              <div className="relative w-full max-w-md mx-auto">
                 {heroImage && (
                  <Image
                    src={heroImage.imageUrl}
                    alt={heroImage.description}
                    data-ai-hint={heroImage.imageHint}
                    width={600}
                    height={400}
                    priority
                    className="object-cover rounded-xl shadow-lg w-full h-auto"
                  />
                 )}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Key Features</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Everything You Need to Succeed</h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Our AI-driven tools streamline every aspect of setting up and running your online store, from branding to product listings.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-start gap-12 py-12 lg:grid-cols-2 lg:gap-16">
              {features.map((feature) => (
                <div key={feature.title} className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-full">
                    {feature.icon}
                  </div>
                  <div className="grid gap-1">
                    <h3 className="text-lg font-bold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32 bg-card">
          <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight font-headline">Ready to Launch Your Dream Store?</h2>
              <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Start building your e-commerce business today. Let our AI be your co-pilot.
              </p>
            </div>
            <div className="mx-auto w-full max-w-sm space-y-2">
              <Link href="/onboarding">
                <Button size="lg" className="w-full">
                  Get Started Now
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground">Free to start. No credit card required.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">&copy; 2024 Baci. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  );
}
