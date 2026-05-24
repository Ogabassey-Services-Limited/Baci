'use client';

import { motion } from 'framer-motion';
import { OnboardingBackground } from '@/components/onboarding/floating-benefits';
import OnboardingClient from '@/components/onboarding-client';

export default function OnboardingPageContent() {
  return (
    <main
      id="main-content"
      className="relative min-h-dvh flex items-center justify-center overflow-hidden bg-background"
    >
      {/* Dynamic Background Elements (Matched to Login Page) - Optimized */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] bg-center mask-[linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-50 pointer-events-none" />

      {/* Animated Orbs */}
      {/* Animated Orbs - Optimized with gradients instead of heavy blur filters */}
      <div
        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[radial-gradient(circle,var(--theme-primary)_0%,transparent_70%)] opacity-20 animate-pulse pointer-events-none"
        style={{ animationDuration: '4s' }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[radial-gradient(circle,var(--theme-accent)_0%,transparent_70%)] opacity-20 animate-pulse pointer-events-none"
        style={{ animationDuration: '6s' }}
      />

      {/* Floating Benefits - The "Extra" Layer */}
      <OnboardingBackground />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full"
      >
        <OnboardingClient />
      </motion.div>
    </main>
  );
}
