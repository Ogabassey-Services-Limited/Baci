'use client';

import {
  Brain,
  Feather,
  Globe,
  Palette,
  PenTool,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnboardingUIStore } from '@/store/onboarding-ui-store';

// Color Codes (Derived from globals.css):
// Primary: hsl(239 45% 30%) - Deep Blue
// Accent: hsl(38 92% 55%) - Gold/Orange
// Background: hsl(0 0% 100%) - White
// Foreground: hsl(240 10% 3.9%) - Almost Black

// Tailwind v4 dropped `bg-opacity-*`; opacity must travel with the color
// via slash syntax. Tailwind's content scanner only detects literal class
// strings, so we map each supported color to its full pre-baked
// text/bg/dark-bg triple here. Adding a new color requires a new entry.
type BenefitColor =
  | 'purple-600'
  | 'amber-500'
  | 'orange-500'
  | 'pink-500'
  | 'blue-500'
  | 'emerald-500'
  | 'indigo-500'
  | 'cyan-500';

const BENEFIT_COLOR_CLASSES: Record<
  BenefitColor,
  { text: string; bg: string; bgDark: string }
> = {
  'purple-600': {
    text: 'text-purple-600',
    bg: 'bg-purple-600/20',
    bgDark: 'dark:bg-purple-600/10',
  },
  'amber-500': {
    text: 'text-amber-500',
    bg: 'bg-amber-500/20',
    bgDark: 'dark:bg-amber-500/10',
  },
  'orange-500': {
    text: 'text-orange-500',
    bg: 'bg-orange-500/20',
    bgDark: 'dark:bg-orange-500/10',
  },
  'pink-500': {
    text: 'text-pink-500',
    bg: 'bg-pink-500/20',
    bgDark: 'dark:bg-pink-500/10',
  },
  'blue-500': {
    text: 'text-blue-500',
    bg: 'bg-blue-500/20',
    bgDark: 'dark:bg-blue-500/10',
  },
  'emerald-500': {
    text: 'text-emerald-500',
    bg: 'bg-emerald-500/20',
    bgDark: 'dark:bg-emerald-500/10',
  },
  'indigo-500': {
    text: 'text-indigo-500',
    bg: 'bg-indigo-500/20',
    bgDark: 'dark:bg-indigo-500/10',
  },
  'cyan-500': {
    text: 'text-cyan-500',
    bg: 'bg-cyan-500/20',
    bgDark: 'dark:bg-cyan-500/10',
  },
};

interface BenefitPillProps {
  icon: React.ElementType;
  label: string;
  color: BenefitColor;
  delay: number;
  x: string;
  y: string;
  className?: string;
}

function BenefitPill({
  icon: Icon,
  label,
  color,
  delay,
  x,
  y,
  className,
}: BenefitPillProps) {
  const tones = BENEFIT_COLOR_CLASSES[color];
  return (
    <div
      className={cn(
        'absolute hidden xl:flex items-center gap-2.5 px-4 py-2.5 rounded-full',
        'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-white/40 dark:border-white/10',
        'shadow-sm dark:shadow-none z-10',
        'animate-in fade-in zoom-in duration-700', // CSS Entry Animation
        className
      )}
      style={{
        left: x,
        top: y,
        animationFillMode: 'both',
        animationDelay: `${delay}s`,
      }}
    >
      <div className={cn('p-1.5 rounded-full', tones.bg, tones.bgDark)}>
        <Icon className={cn('w-4 h-4', tones.text)} strokeWidth={2.5} />
      </div>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </span>
    </div>
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
      <path
        d="M 6 15 Q 15 25 5 38"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-purple-500 animate-in fade-in duration-1000"
        style={{ animationDelay: '0s' }}
      />
      <path
        d="M 5 38 Q 12 50 8 62"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-amber-500 animate-in fade-in duration-1000"
        style={{ animationDelay: '0.3s' }}
      />
      <path
        d="M 8 62 Q 15 75 5 85"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-orange-500 animate-in fade-in duration-1000"
        style={{ animationDelay: '0.6s' }}
      />
      <path
        d="M 5 85 Q 2 92 10 95"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-pink-500 animate-in fade-in duration-1000"
        style={{ animationDelay: '0.9s' }}
      />

      {/* Connections Right - Scattered Paths */}
      <path
        d="M 88 15 Q 80 25 82 38"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-blue-500 animate-in fade-in duration-1000"
        style={{ animationDelay: '0.2s' }}
      />
      <path
        d="M 82 38 Q 75 50 88 62"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-emerald-500 animate-in fade-in duration-1000"
        style={{ animationDelay: '0.5s' }}
      />
      <path
        d="M 88 62 Q 95 75 84 85"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-indigo-500 animate-in fade-in duration-1000"
        style={{ animationDelay: '0.8s' }}
      />
      <path
        d="M 84 85 Q 80 92 90 95"
        fill="transparent"
        stroke="url(#line-gradient)"
        strokeWidth="0.2"
        strokeDasharray="0.4 0.4"
        className="text-cyan-500 animate-in fade-in duration-1000"
        style={{ animationDelay: '1.1s' }}
      />
    </svg>
  );
}

export function OnboardingBackground() {
  const isLogoUploaded = useOnboardingUIStore((state) => state.isLogoUploaded);

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <NetworkLines />

      {/* Benefits - Left Side (4 items, scattered) */}
      <BenefitPill
        icon={Brain}
        label="AI Powered Design"
        color="purple-600"
        delay={0}
        x={isLogoUploaded ? '2%' : '6%'}
        y={isLogoUploaded ? '10%' : '15%'}
        className="-rotate-3"
      />
      <BenefitPill
        icon={Zap}
        label="Launch in Seconds"
        color="amber-500"
        delay={0.2}
        x={isLogoUploaded ? '2%' : '5%'}
        y={isLogoUploaded ? '30%' : '38%'}
        className="rotate-2"
      />
      <BenefitPill
        icon={PenTool}
        label="AI Descriptions"
        color="orange-500"
        delay={0.4}
        x={isLogoUploaded ? '2%' : '8%'}
        y={isLogoUploaded ? '70%' : '62%'}
        className="-rotate-2"
      />
      <BenefitPill
        icon={Palette}
        label="Auto Branding"
        color="pink-500"
        delay={0.6}
        x={isLogoUploaded ? '2%' : '5%'}
        y={isLogoUploaded ? '90%' : '85%'}
        className="rotate-3"
      />

      {/* Benefits - Right Side (4 items, scattered) */}
      <BenefitPill
        icon={Globe}
        label="Global Sales"
        color="blue-500"
        delay={0.1}
        x={isLogoUploaded ? '90%' : '88%'}
        y={isLogoUploaded ? '10%' : '15%'}
        className="rotate-3"
      />
      <BenefitPill
        icon={ShieldCheck}
        label="Secure Payments"
        color="emerald-500"
        delay={0.3}
        x={isLogoUploaded ? '90%' : '82%'}
        y={isLogoUploaded ? '30%' : '38%'}
        className="-rotate-3"
      />
      <BenefitPill
        icon={Feather}
        label="AI Blog Posts"
        color="indigo-500"
        delay={0.5}
        x={isLogoUploaded ? '90%' : '88%'}
        y={isLogoUploaded ? '70%' : '62%'}
        className="rotate-2"
      />
      <BenefitPill
        icon={TrendingUp}
        label="Built-in SEO"
        color="cyan-500"
        delay={0.7}
        x={isLogoUploaded ? '90%' : '84%'}
        y={isLogoUploaded ? '90%' : '85%'}
        className="-rotate-2"
      />

      {/* Decorative Nodes - Simplified to static or simple CSS animation */}
      <div className="absolute top-1/3 left-[15%] w-2 h-2 rounded-full bg-purple-400/50 hidden xl:block animate-pulse duration-4000" />
      <div className="absolute bottom-1/3 right-[15%] w-3 h-3 rounded-full bg-blue-400/50 hidden xl:block animate-pulse duration-5000" />
    </div>
  );
}
