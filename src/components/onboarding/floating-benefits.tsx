'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Zap,
  PenTool,
  Palette,
  Globe,
  ShieldCheck,
  Feather,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Color Codes (Derived from globals.css):
// Primary: hsl(239 45% 30%) - Deep Blue
// Accent: hsl(38 92% 55%) - Gold/Orange
// Background: hsl(0 0% 100%) - White
// Foreground: hsl(240 10% 3.9%) - Almost Black

interface BenefitPillProps {
  icon: React.ElementType;
  label: string;
  color: string;
  delay: number;
  x: string;
  y: string;
  className?: string;
}

function BenefitPill({ icon: Icon, label, color, delay, x, y, className }: BenefitPillProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: [0, -10, 0],
      }}
      transition={{
        duration: 0.8,
        delay: delay,
        ease: "easeOut",
        y: {
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
          repeatType: "reverse",
          delay: delay
        }
      }}
      className={cn(
        "absolute hidden xl:flex items-center gap-2.5 px-4 py-2.5 rounded-full",
        "bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-white/40 dark:border-white/10",
        "shadow-sm dark:shadow-none z-10",
        className
      )}
      style={{ left: x, top: y }}
    >
      <div className={cn("p-1.5 rounded-full bg-opacity-10", color.replace('text-', 'bg-'))}>
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
    </motion.div>
  );
}

// Abstract Network Lines
function NetworkLines() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none opacity-50 dark:opacity-20 hidden xl:block"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Connections Left - Scattered Paths */}
      <motion.path
        d="M 6 15 Q 15 25 5 38"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-purple-500"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />
      <motion.path
        d="M 5 38 Q 12 50 8 62"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-amber-500"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, delay: 0.3, ease: "easeInOut" }}
      />
      <motion.path
        d="M 8 62 Q 15 75 5 85"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-orange-500"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, delay: 0.6, ease: "easeInOut" }}
      />
      <motion.path
        d="M 5 85 Q 2 92 10 95"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-pink-500"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, delay: 0.9, ease: "easeInOut" }}
      />

      {/* Connections Right - Scattered Paths */}
      <motion.path
        d="M 88 15 Q 80 25 82 38"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-blue-500"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, delay: 0.2, ease: "easeInOut" }}
      />
      <motion.path
        d="M 82 38 Q 75 50 88 62"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-emerald-500"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, delay: 0.5, ease: "easeInOut" }}
      />
      <motion.path
        d="M 88 62 Q 95 75 84 85"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-indigo-500"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, delay: 0.8, ease: "easeInOut" }}
      />
      <motion.path
        d="M 84 85 Q 80 92 90 95"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-cyan-500"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, delay: 1.1, ease: "easeInOut" }}
      />
    </svg>
  );
}

export function OnboardingBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <NetworkLines />

      {/* Benefits - Left Side (4 items, scattered) */}
      <BenefitPill
        icon={Brain}
        label="AI Powered Design"
        color="text-purple-600"
        delay={0}
        x="6%"
        y="15%"
        className="-rotate-3"
      />
      <BenefitPill
        icon={Zap}
        label="Launch in Seconds"
        color="text-amber-500"
        delay={0.2}
        x="5%"
        y="38%"
        className="rotate-2"
      />
      <BenefitPill
        icon={PenTool}
        label="AI Descriptions"
        color="text-orange-500"
        delay={0.4}
        x="8%"
        y="62%"
        className="-rotate-2"
      />
      <BenefitPill
        icon={Palette}
        label="Auto Branding"
        color="text-pink-500"
        delay={0.6}
        x="5%"
        y="85%"
        className="rotate-3"
      />

      {/* Benefits - Right Side (4 items, scattered) */}
      <BenefitPill
        icon={Globe}
        label="Global Sales"
        color="text-blue-500"
        delay={0.1}
        x="88%"
        y="15%"
        className="rotate-3"
      />
      <BenefitPill
        icon={ShieldCheck}
        label="Secure Payments"
        color="text-emerald-500"
        delay={0.3}
        x="82%"
        y="38%"
        className="-rotate-3"
      />
      <BenefitPill
        icon={Feather}
        label="AI Blog Posts"
        color="text-indigo-500"
        delay={0.5}
        x="88%"
        y="62%"
        className="rotate-2"
      />
      <BenefitPill
        icon={TrendingUp}
        label="Built-in SEO"
        color="text-cyan-500"
        delay={0.7}
        x="84%"
        y="85%"
        className="-rotate-2"
      />

      {/* Decorative Nodes */}
      <motion.div
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute top-1/3 left-[15%] w-2 h-2 rounded-full bg-purple-400/50 hidden xl:block"
      />
      <motion.div
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 5, repeat: Infinity, delay: 1 }}
        className="absolute bottom-1/3 right-[15%] w-3 h-3 rounded-full bg-blue-400/50 hidden xl:block"
      />
    </div>
  );
}
