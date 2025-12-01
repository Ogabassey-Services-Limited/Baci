'use client';

import { Logo } from '@/components/logo';
import Link from 'next/link';
import { OnboardingBackground } from '@/components/onboarding/floating-benefits';
import OnboardingClient from '@/components/onboarding-client';
import { motion } from 'framer-motion';

export default function OnboardingPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Dynamic Background Elements (Matched to Login Page) */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      {/* Animated Orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />

      {/* Floating Benefits - The "Extra" Layer */}
      <OnboardingBackground />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-2xl p-4"
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl shadow-2xl">
          {/* Glass Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none" />

          <div className="relative p-8">
            <div className="flex flex-col items-center text-center mb-6">
              <Link href="/" className="mb-4 transition-transform hover:scale-105">
                <Logo />
              </Link>
            </div>

            <OnboardingClient />
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-sm text-muted-foreground mt-6"
        >
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline underline-offset-4 transition-colors">
            Log in
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
