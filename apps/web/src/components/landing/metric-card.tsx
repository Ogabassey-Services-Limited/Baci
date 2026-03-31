'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  className?: string;
  delay?: number;
  /** Duration of the count animation in ms (default: 2000) */
  duration?: number;
}

// Shared IntersectionObserver instance for all MetricCards
// Reduces memory usage and improves performance vs. one observer per card
let sharedObserver: IntersectionObserver | null = null;
const observerCallbacks = new Map<Element, () => void>();

function getSharedObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const callback = observerCallbacks.get(entry.target);
            if (callback) {
              callback();
              // Unobserve after triggering to prevent re-animation
              sharedObserver?.unobserve(entry.target);
              observerCallbacks.delete(entry.target);
            }
          }
        });
      },
      { threshold: 0.2 }
    );
  }
  return sharedObserver;
}

/**
 * Parses a value string like "10,000+", "$5M+", "4.9/5.0" into a numeric target
 * Returns { prefix, number, suffix } for reconstruction
 */
function parseValue(value: string): {
  prefix: string;
  number: number;
  suffix: string;
  decimals: number;
} {
  // Match patterns like "$5M+", "10,000+", "4.9/5.0"
  const match = value.match(/^([^0-9]*)([0-9,]+\.?[0-9]*)(.*)$/);

  if (!match) {
    return { prefix: '', number: 0, suffix: value, decimals: 0 };
  }

  const [, prefix, numStr, suffix] = match;
  const cleanNum = numStr.replace(/,/g, '');
  const number = Number.parseFloat(cleanNum) || 0;
  const decimals = cleanNum.includes('.')
    ? cleanNum.split('.')[1]?.length || 0
    : 0;

  return { prefix, number, suffix, decimals };
}

/**
 * Formats a number back to string with commas
 */
function formatNumber(num: number, decimals: number): string {
  if (decimals > 0) {
    return num.toFixed(decimals);
  }
  return Math.floor(num).toLocaleString();
}

/**
 * Easing function for smooth animation (ease-out cubic)
 */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function MetricCard({
  label,
  value,
  icon,
  className,
  delay = 0,
  duration = 2000,
}: MetricCardProps) {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const { prefix, number: targetNumber, suffix, decimals } = parseValue(value);
  const [displayValue, setDisplayValue] = useState(
    prefersReducedMotion ? formatNumber(targetNumber, decimals) : '0'
  );
  const [hasAnimated, setHasAnimated] = useState(prefersReducedMotion);
  const cardRef = useRef<HTMLLIElement>(null);

  const startAnimation = () => {
    const startTime = performance.now() + delay;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;

      if (elapsed < 0) {
        // Still in delay period
        requestAnimationFrame(animate);
        return;
      }

      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const currentNumber = easedProgress * targetNumber;

      setDisplayValue(formatNumber(currentNumber, decimals));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization (ADR-004)
  useEffect(() => {
    const element = cardRef.current;
    if (!element || hasAnimated) return;

    // Use shared IntersectionObserver for better performance
    const observer = getSharedObserver();

    const handleIntersection = () => {
      setHasAnimated(true);
      startAnimation();
    };

    observerCallbacks.set(element, handleIntersection);
    observer.observe(element);

    return () => {
      observer.unobserve(element);
      observerCallbacks.delete(element);
    };
  }, [hasAnimated, delay, duration, targetNumber, decimals]);

  return (
    <li
      ref={cardRef}
      className={cn(
        'glass p-6 rounded-2xl flex flex-col items-center text-center list-none',
        className
      )}
    >
      <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-4">
        {icon}
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="text-3xl font-bold text-primary tabular-nums">
          {prefix}
          {displayValue}
          {suffix}
        </p>
      </div>
    </li>
  );
}
