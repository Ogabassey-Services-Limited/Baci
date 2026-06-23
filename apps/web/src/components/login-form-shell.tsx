'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';

type LoginFormShellProps = {
  children: ReactNode;
  heading: string;
  subheading: string;
};

export function LoginFormShell({
  children,
  heading,
  subheading,
}: LoginFormShellProps) {
  return (
    <main
      id="main-content"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background"
    >
      {/* Static Background - removed animated orbs for performance */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] bg-center mask-[linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      {/* Simplified static orbs (no animation) */}
      <div className="absolute top-1/4 left-1/4 size-64 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 size-64 bg-accent/20 rounded-full blur-3xl" />

      {/* CSS transition instead of framer-motion */}
      <div className="relative z-10 w-full max-w-[420px] p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl shadow-2xl">
          {/* Glass Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none" />

          <div className="relative p-8">
            <div className="flex flex-col items-center text-center mb-8">
              <Link
                href="/"
                className="mb-6 transition-transform hover:scale-105"
              >
                <Logo priority />
              </Link>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
                <p className="text-sm text-muted-foreground">{subheading}</p>
              </div>
            </div>

            {children}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 animate-in fade-in duration-500 delay-300">
          By continuing, you agree to our{' '}
          <Link
            href="/terms"
            className="underline hover:text-primary transition-colors"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            className="underline hover:text-primary transition-colors"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
