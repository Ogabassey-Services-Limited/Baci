'use client';

import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

export function PlatformHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-white/10 glass">
      <div
        className="container h-16 flex items-center justify-between"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <Link href="/" className="flex items-center gap-2 group">
          <Logo className="transition-transform group-hover:scale-105" />
          <span className="sr-only">Baci</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/#features"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Features
          </Link>
          <Link
            href="/#how-it-works"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <Button
            asChild
            variant="ghost"
            className="hidden sm:inline-flex hover:bg-primary/10 hover:text-primary"
          >
            <Link href="/login">Login</Link>
          </Button>
          <Button
            asChild
            className="bg-primary hover:bg-primary/90 text-primary-foreground dark:text-indigo-950 shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40 hover:-translate-y-0.5"
          >
            <Link href="/onboarding">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
