import '@/app/globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import AppBody from '@/components/app-body';
import { PlatformFooter } from '@/components/platform/footer';
import { PlatformHeader } from '@/components/platform/header';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'About Us - Baci',
  description: 'Learn about the mission and team behind Baci.',
};

export default function AboutPage() {
  return (
    <AppBody>
      <div className="flex flex-col min-h-screen bg-background font-sans selection:bg-accent/30">
        <PlatformHeader />
        <main className="flex-1 pt-24 pb-16">
          <section className="container px-4 md:px-6 max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                Empowering Entrepreneurship
              </h1>
              <p className="text-xl text-muted-foreground">
                We're on a mission to make e-commerce accessible to everyone in
                Africa.
              </p>
            </div>

            <div className="prose dark:prose-invert max-w-none space-y-8">
              <p className="text-lg leading-relaxed">
                Baci was founded with a simple belief:{' '}
                <strong>Technology should open doors, not close them.</strong>
              </p>
              <p className="text-lg leading-relaxed">
                For too long, starting an online business in Africa meant
                navigating complex technical barriers, expensive developer fees,
                and payment systems that didn't work for local markets. We built
                Baci to change that.
              </p>
              <p className="text-lg leading-relaxed">
                By leveraging the latest in Artificial Intelligence, we've
                automated the hardest parts of building a store. From generating
                product descriptions to designing your brand identity, Baci
                handles the heavy lifting so you can focus on what you do best:{' '}
                <strong>selling great products.</strong>
              </p>
            </div>

            <div className="mt-16 text-center">
              <h2 className="text-2xl font-bold mb-6">Ready to join us?</h2>
              <Button asChild size="lg">
                <Link href="/onboarding">Start Your Journey</Link>
              </Button>
            </div>
          </section>
        </main>
        <PlatformFooter />
      </div>
    </AppBody>
  );
}
